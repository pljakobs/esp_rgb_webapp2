export const localhost = {
  hostname: "localhost",
  ip_address:
    process.env.NODE_ENV === "development"
      ? "192.168.29.71"
      : window.location.hostname,
};

export const storeStatus = {
  LOADING: "loading",
  READY: "ready",
  ERROR: "error",
  SYNCING: "syncing",
  SYNCED: "synced",
};

export const maxRetries = 3; // Maximum number of retries
export const retryDelay = 500; // Delay for the first retry in milliseconds
export const requestTimeout = 2000;
