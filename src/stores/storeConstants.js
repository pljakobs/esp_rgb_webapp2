export const localhost = {
  hostname: "localhost",
  ip_address:
    process.env.NODE_ENV === "development"
      ? "led-so2.fritz.box"
      : window.location.hostname,
};

export const storeStatus = {
  LOADING: "loading",
  READY: "ready",
  ERROR: "error",
};

export const maxRetries = 5; // Maximum number of retries
export const retryDelay = 1000; // Delay for the first retry in milliseconds
