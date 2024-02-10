import { controllersStore } from "./controllersStore";
import {
  maxRetries,
  retryDelay,
  localhost,
  storeStatus,
} from "./storeConstants";

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

export async function fetchApi(endpoint, retryCount = 0) {
  const controllers = controllersStore();
  let error = null;
  let jsonData = null;

  try {
    console.log(endpoint, " start fetching data");
    const response = await fetch(
      `http://${controllers.currentController["ip_address"]}/${endpoint}`
    );
    if (response.status === 429 && retryCount < maxRetries) {
      // Too many requests, retry after a delay
      console.log(
        `Request limit reached, retrying after ${
          retryDelay * 2 ** retryCount
        }ms...`
      );
      setTimeout(
        () => fetchApi(endpoint, retryCount + 1),
        retryDelay * 2 ** retryCount
      );
      return;
    }
    jsonData = await response.json();
    console.log(endpoint, " data fetched: ", JSON.stringify(jsonData));
  } catch (err) {
    console.error("Error fetching color data:", err);
    error = err;
    if (retryCount < maxRetries) {
      setTimeout(
        () => fetchApi(endpoint, retryCount + 1),
        retryDelay * 2 ** retryCount
      );
    }
  }

  return { jsonData, error };
}
