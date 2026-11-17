import { DEMO_HOST } from "./demoMode";

const clone = (value) => JSON.parse(JSON.stringify(value));
const initialColor = () => ({
  hsv: { h: 35, s: 75, v: 65, ct: 3000 },
  raw: { r: 665, g: 350, b: 100, ww: 300, cw: 0 },
});

export function createDemoController() {
  const host = { id: "demo-controller", hostname: "demo", ip_address: DEMO_HOST, visible: true, online: true };
  const lights = [
    { id: "demo-light", index: 0, name: "Living room", type: "RGBWWCW", pins: [1, 2, 3, 4, 5], is_default: true },
    { id: "demo-desk", index: 1, name: "Desk", type: "RGBWWCW", pins: [6, 7, 8, 9, 10], is_default: false },
  ];
  const board = {
    id: "demo-board", revision: 1, name: "Simulated ESP32 board", soc: "esp32",
    reserved_gpios: [],
    implemented_pins: Array.from({ length: 16 }, (_, index) => ({
      id: `pwm-${index + 1}`, label: `GPIO ${index + 1}`, gpio: index + 1, allowed_functions: ["light.pwm"],
    })),
  };
  const config = {
    general: { device_name: "Demo controller", current_pin_config_name: "Demo", supported_color_models: ["RGB", "RGBWW", "RGBCW", "RGBWWCW"], allow_web_icons: false, pin_config_url: "", UI: { dark_mode: false } },
    color: { color_mode: 3, outputmode: 3, hsv: { model: 1, red: 0, yellow: 0, green: 0, cyan: 0, blue: 0, magenta: 0 }, brightness: { red: 100, green: 100, blue: 100, ww: 100, cw: 100 }, colortemp: { ww: 2700, cw: 6500 }, startup: { mode: "LAST", color: null }, startup_color: "last" },
    network: {
      connection: { ip: "192.0.2.10", netmask: "255.255.255.0", gateway: "192.0.2.1", dhcp: true },
      mqtt: { enabled: false, server: "mqtt.example", port: 1883, username: "", password: "", topic_base: "home/", homeassistant: { enable: false, discovery_prefix: "homeassistant", node_id: "" } },
      rsyslog: { enabled: false, host: "", port: 514 },
      telemetry: { statsEnabled: false, logEnabled: false, url: "", user: "", password: "", numReboots: 0 },
      ap: { ssid: "Lightinator Demo", secured: false, password: "" },
      mdns: { enabled: true, name: "demo" },
      ntp: { enabled: false, server: "pool.ntp.org", interval: 3600 },
    },
    security: { api_secured: false, username: "", password: "" },
    ota: { url: "" },
    webapp: { enabled: true },
    hardware: {
      pinconfigs: [{ name: "Demo", soc: "esp32", model: "rgbww", channels: [{ name: "red", pin: 1 }, { name: "green", pin: 2 }, { name: "blue", pin: 3 }, { name: "warmwhite", pin: 4 }, { name: "coldwhite", pin: 5 }] }],
      available_pins: [{ soc: "esp32", pins: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16] }],
      pwm: { timer: { speed_mode: "LOW", frequency: 1000, resolution: 10, number: 0 }, spreadSpectrum: { mode: "OFF", width: 0, subsampling: 1 }, phaseShift: { mode: "OFF" } },
      configuration: { lights, soc: "esp32", revision: 1, board_id: board.id, board_revision: board.revision, board_profile: board, buttons: [], buses: [] },
    },
  };
  const info = {
    version: 2,
    device: { deviceid: host.id, soc: "esp32" },
    app: { git_version: "V5.1-1-develop", build_type: "release", webapp_version: "Demo" },
    connection: { connected: true, ssid: "Simulated Wi-Fi", mac: "02:00:00:00:00:01", dhcp: true, ip: "192.0.2.10", netmask: "255.255.255.0", gateway: "192.0.2.1" },
    runtime: { uptime: 0, heap_free: 100000, cpu_usage_percent: 0 },
    rgbww: { preset_light_favorites: true },
  };
  const data = {
    "last-color": {},
    "sync-lock": null,
    controllers: [{ id: host.id, name: "Demo controller" }],
    presets: [
      { id: "demo-warm", name: "Warm evening", favorite: true, icon: "palette", ts: 1, color: { hsv: { h: 30, s: 75, v: 65, ct: 3000 } } },
      { id: "demo-blue", name: "Blue", favorite: false, icon: "palette", ts: 1, color: { hsv: { h: 220, s: 85, v: 70, ct: 4000 } } },
    ],
    groups: [{ id: "demo-group", name: "Living room", controller_ids: [host.id], ts: 1 }],
    scenes: [{ id: "demo-scene", name: "Evening", group_id: "demo-group", ts: 1, settings: [{ controller_id: host.id, pos: 0, color: { hsv: { h: 30, s: 75, v: 65 } } }] }],
  };
  const colors = new Map(lights.map((light) => [light.index, initialColor()]));
  const previousColors = new Map();
  const sensorConfig = {
    "current-1": { extension_id: "current-1", available: true, enabled: true, address: 64, shunt_ohms: 0.1, interval_ms: 1000 },
    "spectrum-1": { extension_id: "spectrum-1", available: true, enabled: true, atime: 29, astep: 599, gain: 5, interval_ms: 1000 },
  };
  let spectrumMeasured = false;
  const response = (value, status = 200) =>
    new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
  const error = (message, status = 400) => response({ success: false, error: message }, status);

  function merge(target, patch) {
    for (const [key, value] of Object.entries(patch)) {
      if (value && typeof value === "object" && !Array.isArray(value)) {
        if (!target[key] || typeof target[key] !== "object" || Array.isArray(target[key])) target[key] = {};
        merge(target[key], value);
      } else {
        target[key] = clone(value);
      }
    }
  }

  function updateData(patch) {
    if (!patch || typeof patch !== "object" || Array.isArray(patch)) throw new Error("Invalid data update");
    const updated = clone(data);
    for (const [key, value] of Object.entries(patch)) {
      if (key === "sync-lock" || key === "last-color") {
        if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`Invalid ${key}`);
        updated[key] = clone(value);
        continue;
      }
      const match = /^(presets|groups|scenes|controllers)(?:\[(?:id=([^\]]+))?\])?$/.exec(key);
      if (!match) throw new Error(`Unsupported data field: ${key}`);
      const [, collection, id] = match;
      if (key.endsWith("[]")) {
        if (!Array.isArray(value) || value.some((item) => !item?.id)) throw new Error("Invalid collection append");
        updated[collection].push(...clone(value));
      } else if (id) {
        const index = updated[collection].findIndex((item) => String(item.id) === id);
        if (index < 0) throw new Error("BadSelector");
        if (Array.isArray(value) && value.length === 0) updated[collection].splice(index, 1);
        else if (value && typeof value === "object" && !Array.isArray(value)) updated[collection][index] = { ...updated[collection][index], ...clone(value) };
        else throw new Error("Invalid collection update");
      } else {
        if (!Array.isArray(value)) throw new Error("Invalid collection");
        updated[collection] = clone(value);
      }
    }
    Object.assign(data, updated);
  }

  function updateColor(index, body) {
    const color = colors.get(index);
    if (!color) throw new Error("Unknown light");
    if (!body || typeof body !== "object") throw new Error("Invalid color");
    if (Array.isArray(body.cmds)) {
      if (!body.cmds.length) throw new Error("Empty color sequence");
      for (const item of body.cmds) updateColor(index, item);
      return;
    }
    if (body.hsv && typeof body.hsv === "object") {
      for (const [key, value] of Object.entries(body.hsv)) {
        if (!["h", "s", "v", "ct"].includes(key) || !Number.isFinite(Number(value))) throw new Error("Invalid HSV value");
        color.hsv[key] = Number(value);
      }
    } else if (body.raw && typeof body.raw === "object") {
      const channels = Array.isArray(body.raw) ? body.raw : Object.values(body.raw);
      if (channels.some((value) => !Number.isFinite(Number(value)) || Number(value) < 0 || Number(value) > 1023)) throw new Error("Invalid RAW value");
      color.raw = clone(body.raw);
      color.hsv.v = Math.round(Math.max(0, ...channels.map(Number)) * 100 / 1023);
    } else throw new Error("Unsupported color command");
  }

  async function handle(url, options = {}) {
    const method = (options.method || "GET").toUpperCase();
    const path = url.pathname;
    let body;
    try {
      body = options.body ? JSON.parse(options.body) : {};
      const sensor = /^\/extensions\/(current-1|spectrum-1)\/(config|readings|start_measurement)$/.exec(path);
      if (sensor) {
        const [, id, resource] = sensor;
        if (resource === "config" && method === "GET") return response(sensorConfig[id]);
        if (resource === "config" && method === "POST") {
          merge(sensorConfig[id], body);
          return response(sensorConfig[id]);
        }
        if (resource === "start_measurement" && method === "POST" && id === "spectrum-1") {
          spectrumMeasured = true;
          return response({ extension_id: id, success: true });
        }
        if (resource === "readings" && method === "GET") {
          if (id === "current-1") return response({ extension_id: id, valid: true, error: "", age_ms: 0, current_a: 0.35, voltage_v: 12, power_w: 4.2 });
          return response({ extension_id: id, valid: spectrumMeasured, error: "", age_ms: 0, state: spectrumMeasured ? "complete" : "idle", data: { f1: 120, f2: 220, f3: 340, f4: 560, f5: 650, f6: 800, f7: 600, f8: 350, clear_low: 800, clear_high: 1200, nir_low: 100, nir_high: 150 } });
        }
      }
      if (method === "GET") {
        if (path === "/hosts") return response({ hosts: [host] });
        if (path === "/info") return response(info);
        if (path === "/config") return response(config);
        if (path === "/catalog") return response({ schema_version: 1, version: 1, boards: [board], templates: [] });
        if (path === "/data") return response(data);
        if (path === "/ping" || path === "/api/ping") return response({ ping: "pong" });
        if (path === "/networks") return response({ networks: [{ ssid: "Simulated Wi-Fi", rssi: -45, encryption: 3 }] });
        if (path === "/color") {
          const index = Number(url.searchParams.get("light") ?? 0);
          return colors.has(index) ? response(colors.get(index)) : error("Unknown light", 404);
        }
      } else if (method === "POST") {
        if (path === "/config") {
          if (!body || typeof body !== "object" || Array.isArray(body)) return error("Invalid configuration");
          merge(config, body);
          if (body.color?.outputmode !== undefined) config.color.color_mode = body.color.outputmode;
          if (body.hardware?.configuration) {
            const indexes = new Set((config.hardware.configuration.lights ?? []).map((light) => light.index));
            for (const index of colors.keys()) {
              if (!indexes.has(index)) {
                colors.delete(index);
                previousColors.delete(index);
              }
            }
            for (const light of config.hardware.configuration.lights ?? []) {
              if (!colors.has(light.index)) colors.set(light.index, initialColor());
            }
          }
          return response({ success: true });
        }
        if (path === "/system" && body.cmd === "restart") return response({ success: true, simulated: true });
        if (path === "/system" && body.cmd === "demo_update_firmware") {
          info.app.git_version = "V5.1-2-develop";
          return response({ success: true, simulated: true });
        }
        if (path === "/webapp_check") return response({ state: "idle", last_status: "no_update", version: "Demo" });
        if (path === "/data") {
          updateData(body);
          return response({ success: true });
        }
        const index = Number(url.searchParams.get("light") ?? body.light ?? 0);
        if (path === "/color") {
          updateColor(index, body);
          return response({ success: true });
        }
        if (path === "/on" || path === "/off") {
          const color = colors.get(index);
          if (!color) return error("Unknown light", 404);
          if (path === "/off") {
            if (color.hsv.v > 0) previousColors.set(index, clone(color));
            color.hsv.v = 0;
            color.raw = Array.isArray(color.raw)
              ? color.raw.map(() => 0)
              : Object.fromEntries(Object.keys(color.raw).map((key) => [key, 0]));
          } else if (previousColors.has(index)) {
            colors.set(index, clone(previousColors.get(index)));
          } else if (color.hsv.v === 0) {
            color.hsv.v = 65;
          }
          return response({ success: true });
        }
      }
      return error(`Not available in demo: ${method} ${path}`, 404);
    } catch (exception) {
      return error(exception.message);
    }
  }

  return { handle };
}

export function installDemoTransport(target = window) {
  const nativeFetch = target.fetch.bind(target);
  const controller = createDemoController();
  target.fetch = (input, options = {}) => {
    const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url, target.location.href);
    if (url.hostname === DEMO_HOST && url.protocol === "http:") return controller.handle(url, options);
    const assetRoot = new URL(".", target.location.href);
    if ((options.method || "GET").toUpperCase() === "GET" && url.origin === target.location.origin && url.href.startsWith(assetRoot.href) && url.pathname.endsWith("/icons/iconsSprite.svg")) {
      return nativeFetch(input, options);
    }
    console.error("Blocked network request in demo mode:", url.href);
    return Promise.reject(new Error("Network requests are disabled in demo mode"));
  };
}
