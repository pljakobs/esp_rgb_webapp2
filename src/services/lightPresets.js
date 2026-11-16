import { LIGHT_CHANNELS } from "./virtualLights";

export function isLightFavorite(preset, light = null) {
  if (!light) return preset.favorite === true;
  const override = preset.light_favorites?.find(
    (item) => item.light_id === light.id,
  );
  return override
    ? override.favorite === true
    : light.is_default === true && preset.favorite === true;
}

export function withLightFavorite(preset, light, favorite) {
  if (!light) return { ...preset, favorite };
  return {
    ...preset,
    light_favorites: [
      ...(preset.light_favorites ?? []).filter(
        (item) => item.light_id !== light.id,
      ),
      { light_id: light.id, favorite },
    ],
  };
}

export function presetColor(preset, light = null) {
  if (preset.raw_channels?.length) {
    if (
      !light ||
      light.type !== preset.light_type ||
      preset.raw_channels.length !== LIGHT_CHANNELS[light.type]?.length ||
      preset.raw_channels.some(
        (value) => !Number.isInteger(value) || value < 0 || value > 1023,
      )
    ) {
      throw new Error("This RAW preset requires a matching light profile.");
    }
    return { raw: [...preset.raw_channels] };
  }
  if (preset.color?.hsv) {
    const hsv = preset.color.hsv;
    return {
      hsv: { h: hsv.h ?? 0, s: hsv.s ?? 0, v: hsv.v ?? 0, ct: hsv.ct ?? 0 },
    };
  }
  if (preset.color?.raw) {
    if (!light || light.type.startsWith("RGB"))
      return {
        raw: Object.fromEntries(
          ["r", "g", "b", "ww", "cw"].map((channel) => [
            channel,
            preset.color.raw[channel] ?? 0,
          ]),
        ),
      };
    const channels = LIGHT_CHANNELS[light.type];
    if (!channels || channels.includes("output")) {
      throw new Error(
        "This named RAW preset is not compatible with this light.",
      );
    }
    return { raw: channels.map((channel) => preset.color.raw[channel] ?? 0) };
  }
  throw new Error("Preset has no supported colour.");
}
