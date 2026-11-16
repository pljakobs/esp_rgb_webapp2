import { apiService } from "./api.js";

export const sensorDefinitions = [
  {
    id: "current-1",
    name: "current",
    fields: [
      { key: "address", min: 64, max: 79, step: 1 },
      { key: "shunt_ohms", min: 0.00001, max: 1, step: "any" },
      { key: "interval_ms", min: 200, max: 3600000, step: 1 },
    ],
  },
  {
    id: "spectrum-1",
    name: "spectral",
    fields: [
      { key: "atime", min: 0, max: 255, step: 1 },
      { key: "astep", min: 0, max: 65535, step: 1 },
      { key: "gain", min: 0, max: 10, step: 1 },
      { key: "interval_ms", min: 200, max: 3600000, step: 1 },
    ],
  },
];

export const wavelengths = [415, 445, 480, 515, 555, 590, 630, 680];

export async function sensorRequest(id, resource, controller, body) {
  const result = await apiService.fetchApi(
    `extensions/${id}/${resource}`,
    controller,
    body === undefined ? {} : { method: "POST", body, atomic: true },
  );
  if (result.error) {
    const error = new Error(
      result.jsonData?.error ||
        result.error.message ||
        `HTTP ${result.status ?? "connection error"}`,
    );
    error.status = result.status;
    throw error;
  }
  if (!result.jsonData || typeof result.jsonData !== "object") {
    throw new Error("Invalid sensor response");
  }
  const data = result.jsonData;
  const definition = sensorDefinitions.find((sensor) => sensor.id === id);
  if (
    data.extension_id !== id ||
    (resource === "config" &&
      (!definition ||
        !validSettings(definition, data) ||
        typeof data.available !== "boolean")) ||
    (resource === "readings" && !validReading(id, data))
  ) {
    throw new Error("Invalid sensor response");
  }
  return result.jsonData;
}

function validReading(id, reading) {
  if (
    typeof reading.valid !== "boolean" ||
    typeof reading.error !== "string" ||
    !Number.isInteger(reading.age_ms) ||
    reading.age_ms < 0
  )
    return false;
  if (id === "current-1") {
    return (
      !reading.valid ||
      ["current_a", "voltage_v", "power_w"].every((key) =>
        Number.isFinite(reading[key]),
      )
    );
  }
  if (
    !["idle", "measuring", "complete", "error"].includes(reading.state) ||
    reading.valid !== (reading.state === "complete")
  )
    return false;
  return (
    !reading.valid ||
    [
      ...wavelengths.map((_, i) => `f${i + 1}`),
      "clear_low",
      "clear_high",
      "nir_low",
      "nir_high",
    ].every(
      (key) =>
        Number.isInteger(reading.data?.[key]) &&
        reading.data[key] >= 0 &&
        reading.data[key] <= 65535,
    )
  );
}

export function validSettings(definition, draft) {
  return (
    typeof draft.enabled === "boolean" &&
    definition.fields.every(({ key, min, max, step }) => {
      const value = draft[key];
      return (
        typeof value === "number" &&
        Number.isFinite(value) &&
        value >= min &&
        value <= max &&
        (step !== 1 || Number.isInteger(value))
      );
    })
  );
}

export function settingsPayload(definition, draft) {
  if (!validSettings(definition, draft)) {
    throw new Error("Invalid sensor settings");
  }
  return Object.fromEntries(
    ["enabled", ...definition.fields.map(({ key }) => key)].map((key) => [
      key,
      draft[key],
    ]),
  );
}

// Monotone cubic Hermite interpolation: fits every channel without negative
// lobes or overshoot between the uncalibrated measurements.
export function spectralCurve(data) {
  const points = wavelengths.map((x, i) => ({ x, y: data?.[`f${i + 1}`] }));
  if (points.some(({ y }) => !Number.isFinite(y) || y < 0)) return [];
  const slopes = points
    .slice(1)
    .map((p, i) => (p.y - points[i].y) / (p.x - points[i].x));
  const tangents = points.map((point, i) => {
    if (i === 0) return slopes[0];
    if (i === points.length - 1) return slopes[i - 1];
    const left = slopes[i - 1];
    const right = slopes[i];
    if (left * right <= 0) return 0;
    const h0 = point.x - points[i - 1].x;
    const h1 = points[i + 1].x - point.x;
    const w0 = 2 * h1 + h0;
    const w1 = h1 + 2 * h0;
    return (w0 + w1) / (w0 / left + w1 / right);
  });
  const curve = [];
  points.slice(1).forEach((right, i) => {
    const left = points[i];
    const width = right.x - left.x;
    for (let j = 0; j < 16; j++) {
      const t = j / 16;
      const y =
        (2 * t ** 3 - 3 * t ** 2 + 1) * left.y +
        (t ** 3 - 2 * t ** 2 + t) * width * tangents[i] +
        (-2 * t ** 3 + 3 * t ** 2) * right.y +
        (t ** 3 - t ** 2) * width * tangents[i + 1];
      curve.push({ x: left.x + width * t, y });
    }
  });
  curve.push(points.at(-1));
  return curve;
}

export function graphGeometry(points, { minX, maxX, minY = 0 } = {}) {
  const valid = points.filter(({ y }) => Number.isFinite(y));
  if (!valid.length) return { path: "", points: [], minY: 0, maxY: 1 };
  minX ??= Math.min(...valid.map(({ x }) => x));
  maxX ??= Math.max(...valid.map(({ x }) => x));
  minY = Math.min(minY, ...valid.map(({ y }) => y));
  const maxY = Math.max(minY + 0.001, ...valid.map(({ y }) => y));
  const project = ({ x, y }) => ({
    x: 52 + ((x - minX) / (maxX - minX || 1)) * 520,
    y: 170 - ((y - minY) / (maxY - minY)) * 140,
  });
  let connected = false;
  const path = points
    .map((point) => {
      if (!Number.isFinite(point.y)) {
        connected = false;
        return "";
      }
      const p = project(point);
      const command = `${connected ? "L" : "M"}${p.x.toFixed(2)},${p.y.toFixed(2)}`;
      connected = true;
      return command;
    })
    .join(" ");
  return { path, points: valid.map(project), minY, maxY };
}
