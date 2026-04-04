const localOverrideModules = import.meta.glob("../config/localOverrides.js", {
  eager: true,
});

const localOverrides =
  localOverrideModules["../config/localOverrides.js"]?.default ?? {};

const localhostOverride = localOverrides.localhost ?? {};

export const localhost = {
  hostname: localhostOverride.hostname ?? "localhost",
  ip_address: import.meta.env.DEV
    ? (localhostOverride.ip_address ?? "127.0.0.1")
    : window.location.hostname,
};

export const storeStatus = {
  // New two-status system
  store: {
    IDLE: "idle",
    LOADING: "loading",
    READY: "ready",
    ERROR: "error",
  },
  sync: {
    NOT_STARTED: "not_started",
    RUNNING: "running",
    COMPLETED: "completed",
    FAILED: "failed",
  },

  // Legacy single-status system (deprecated)
  IDLE: "idle",
  LOADING: "loading",
  READY: "ready",
  ERROR: "error",
  SYNCING: "syncing",
  SYNCED: "synced",
};

export const maxRetries = 3; // Maximum number of retries
export const retryDelay = 500; // Delay for the first retry in milliseconds
export const requestTimeout = 2000;
