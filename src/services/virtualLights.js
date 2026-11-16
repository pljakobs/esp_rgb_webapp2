import { makeID } from "src/services/tools";

export const LIGHT_CHANNELS = Object.freeze({
  RGB: ["r", "g", "b"],
  RGBWW: ["r", "g", "b", "ww"],
  RGBCW: ["r", "g", "b", "cw"],
  RGBWWCW: ["r", "g", "b", "ww", "cw"],
  WWCW: ["ww", "cw"],
  WW: ["ww"],
  CW: ["cw"],
  SINGLE: ["output"],
});

export function supportsVirtualLights(version) {
  return /^V?5\.1(?:[.-]|$)/i.test(version ?? "");
}

export function lightProfile(light) {
  const channels = LIGHT_CHANNELS[light?.type] ?? [];
  return {
    channels,
    rgb: light?.type?.startsWith("RGB") ?? false,
    ct: light?.type === "WWCW" || light?.type === "RGBWWCW",
    colortemp: light?.color?.colortemp ?? { ww: 2700, cw: 6000 },
  };
}

export function createLight(lights, id = makeID()) {
  const index = Math.max(-1, ...lights.map((light) => light.index)) + 1;
  if (index >= 65535) throw new Error("No unused light index available.");
  return {
    id,
    index,
    name: "New light",
    type: "SINGLE",
    pins: [null],
    is_default: lights.length === 0,
  };
}

export function validateLightConfiguration(configuration, board = null) {
  const errors = [];
  const lights = configuration.lights ?? [];
  if (lights.length && !board) {
    errors.push("Select a board profile before configuring PWM lights.");
  }
  const claimed = new Set(board?.reserved_gpios ?? []);
  const ids = new Set();
  const indexes = new Set();
  const claim = (gpio, label) => {
    if (!Number.isInteger(gpio) || gpio < 0 || gpio > 255) {
      errors.push(`${label}: select a GPIO.`);
    } else if (claimed.has(gpio)) {
      errors.push(`${label}: GPIO ${gpio} is already assigned or reserved.`);
    } else {
      claimed.add(gpio);
    }
  };
  if (configuration.system?.clear_config_enabled) {
    claim(configuration.system.clear_config_pin, "Clear input");
  }
  for (const button of configuration.buttons ?? []) claim(button.pin, "Button");
  for (const bus of configuration.buses ?? []) {
    claim(bus.sda, "I2C SDA");
    claim(bus.scl, "I2C SCL");
  }
  if (lights.length > 16) errors.push("At most 16 lights are supported.");
  if (lights.length && lights.filter((light) => light.is_default).length !== 1) {
    errors.push("Select exactly one default light.");
  }
  for (const light of lights) {
    const label = light.name || light.id || "Light";
    if (!light.id || light.id.length > 64 || ids.has(light.id)) {
      errors.push(`${label}: invalid or duplicate light ID.`);
    }
    ids.add(light.id);
    if (!Number.isInteger(light.index) || light.index < 0 || light.index >= 65535 || indexes.has(light.index)) {
      errors.push(`${label}: invalid or duplicate light index.`);
    }
    indexes.add(light.index);
    if (!light.name?.trim() || light.name.length > 64) errors.push(`${label}: enter a name of at most 64 characters.`);
    const channels = LIGHT_CHANNELS[light.type];
    if (!channels || light.pins?.length !== channels.length) {
      errors.push(`${label}: pins must match the color model's channel count.`);
      continue;
    }
    for (const gpio of light.pins) {
      claim(gpio, label);
      if (board && !board.implemented_pins?.some((pin) => pin.gpio === gpio && pin.allowed_functions?.includes("light.pwm"))) {
        errors.push(`${label}: GPIO ${gpio} is not a board PWM output.`);
      }
    }
  }
  return errors;
}
