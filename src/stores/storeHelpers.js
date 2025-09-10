import { useControllersStore } from "./controllersStore";
import { retryDelay, requestTimeout } from "./storeConstants";

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
) {
  const controllers = useControllersStore();
  const maxRetries = 10;
  let error = null;
  let jsonData = null;
  let status = null;

  try {
    console.log(endpoint, " start fetching data");
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(
      `http://${controllers.currentController["ip_address"]}/${endpoint}`,
      { signal: controller.signal }, // Add signal to fetch
    );

    clearTimeout(timeoutId); // Clear timeout on successful response
    status = response.status;

    if (response.status === 429 && retryCount < maxRetries) {
      // Too many requests, retry after a delay
      console.log("429 error", response.status, response.statusText);
      console.log(
        `Request limit reached, retrying after ${
          retryDelay * 2 ** retryCount
        }ms...`,
      );
      return new Promise((resolve) =>
        setTimeout(
          () => resolve(fetchApi(endpoint, retryCount + 1)),
          retryDelay * 2 ** retryCount,
        ),
      );
    } else if (response.status === 404) {
      // this endpoint does not exist, bail out without retry
      console.log("404 error", response.status, response.statusText);
      return {
        jsonData,
        error: { status: response.status, statusText: response.statusText },
        status,
      };
    }
    jsonData = await response.json();
    console.log(endpoint, " data fetched: ", JSON.stringify(jsonData));
  } catch (err) {
    console.error("Error fetching data:", err);

    // Check if it's a timeout error
    if (err.name === "AbortError") {
      console.log(`Request timed out after ${timeoutMs}ms`);
      error = { ...err, isTimeout: true };
    } else {
      error = err;
    }

    if (retryCount < maxRetries) {
      return new Promise((resolve) =>
        setTimeout(
          () => resolve(fetchApi(endpoint, retryCount + 1, timeoutMs)),
          retryDelay * 2 ** retryCount,
        ),
      );
    }
  }

  return { jsonData, error, status };
}
