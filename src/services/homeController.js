export function homeControllerFromLocation(location) {
  const params = new URLSearchParams(location.search);
  if (!params.has("home")) return null;
  const value = params.get("home");
  if (!value || !/^[a-zA-Z0-9.-]+$/.test(value) || value.length > 253 ||
      value.split(".").some((part) => !part || part.length > 63 || !/^[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?$/.test(part))) {
    throw new Error("Invalid home controller address in URL");
  }
  if (/^[0-9.]+$/.test(value)) {
    const parts = value.split(".");
    if (parts.length !== 4 || parts.some((part) => Number(part) > 255 || (part.length > 1 && part.startsWith("0")))) {
      throw new Error("Invalid home controller address in URL");
    }
  }
  return value;
}
