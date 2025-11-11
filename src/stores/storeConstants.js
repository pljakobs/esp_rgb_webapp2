export const localhost = {
  hostname: "localhost",
  ip_address:
    process.env.NODE_ENV === "development"
      ? "192.168.29.31"
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
