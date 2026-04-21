import { useControllersStore } from "./controllersStore";
import { requestTimeout } from "./storeConstants";
import { apiService } from "src/services/api.js";

export function safeStringify(obj) {
  const cache = new Set();
  return JSON.stringify(obj, (key, value) => {
    if (typeof value === "object" && value !== null) {
      if (cache.has(value)) {
        // Duplicate reference found, discard key
        return;
      }
      // Store value in our set
      cache.add(value);
    }
    return value;
  });
}

export async function fetchApi(
  endpoint,
  retryCount = 0,
  timeoutMs = requestTimeout,
  options = {},
) {
  // Delegate to apiService to benefit from queue management, chunking, and retry handling.
  return apiService.fetchApi(endpoint, null, options, retryCount, timeoutMs);
}
