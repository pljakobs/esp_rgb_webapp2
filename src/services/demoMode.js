export const DEMO_HOST = "demo.invalid";

export function isDemoMode(location = globalThis.location) {
  return Boolean(location && new URLSearchParams(location.search).get("demo") === "1");
}
