import { defineStore } from "pinia";

// Persistent ("keep me logged in") credentials live in localStorage with an
// expiry; session-only credentials live in sessionStorage and are dropped when
// the browser/tab is closed. Both are inherently per-browser.
const STORAGE_KEY = "rgbww.credentials";
const SESSION_KEY = "rgbww.credentials.session";
// Maximum lifetime of a "keep me logged in" credential: 30 days.
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

function loadStoredCredentials() {
  // Prefer a persistent credential, honouring its expiry.
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const password =
        typeof parsed.password === "string" ? parsed.password : "";
      const expiresAt =
        typeof parsed.expiresAt === "number" ? parsed.expiresAt : 0;
      if (password && expiresAt > Date.now()) {
        return { password, remember: true };
      }
      // Expired or malformed — discard it.
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // ignore
  }

  // Fall back to a session-only credential.
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const password =
        typeof parsed.password === "string" ? parsed.password : "";
      if (password) {
        return { password, remember: false };
      }
    }
  } catch {
    // ignore
  }

  return { password: "", remember: false };
}

// Module-level resolver bridging the login dialog and callers that awaited
// promptLogin(). Only one prompt can be pending at a time; concurrent callers
// share the same promise.
let pendingResolve = null;
let pendingReject = null;
let pendingPromise = null;

/**
 * Holds the API credentials used for both HTTP Basic auth and the WebSocket
 * challenge-response handshake, and coordinates the login dialog.
 *
 * Credentials can be persisted across browser restarts ("keep me logged in",
 * localStorage, max 30 days) or kept only for the current browser session
 * (sessionStorage). Either way this is per-browser. This is a LAN
 * administration UI where the password is a shared secret with the controller;
 * treat the storing device as trusted.
 */
export const useAuthStore = defineStore("authStore", {
  state: () => {
    const stored = loadStoredCredentials();
    return {
      password: stored.password,
      remember: stored.remember,
      showLoginDialog: false,
      authError: null,
    };
  },

  getters: {
    hasCredentials: (state) => state.password.length > 0,

    /** HTTP `Authorization` header value, or null when no password is set. */
    basicAuthHeader: (state) => {
      if (state.password.length === 0) {
        return null;
      }
      // The firmware validates the password only (username is ignored), so an
      // empty username is sent in the Basic credentials.
      return "Basic " + btoa(`:${state.password}`);
    },
  },

  actions: {
    /**
     * Store the API password. When `remember` is true it is persisted across
     * browser restarts (localStorage) for up to 30 days; otherwise it is kept
     * only for the current browser session (sessionStorage).
     * @param {string} password
     * @param {boolean} [remember=true]
     */
    setCredentials(password, remember = true) {
      this.password = password ?? "";
      this.remember = !!remember;

      // Always clear both stores first so the two modes never coexist.
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        // ignore
      }
      try {
        sessionStorage.removeItem(SESSION_KEY);
      } catch {
        // ignore
      }

      if (this.password.length === 0) {
        return;
      }

      try {
        if (this.remember) {
          localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({
              password: this.password,
              expiresAt: Date.now() + MAX_AGE_MS,
            }),
          );
        } else {
          sessionStorage.setItem(
            SESSION_KEY,
            JSON.stringify({ password: this.password }),
          );
        }
      } catch {
        // Storage unavailable (private mode / quota) — keep in-memory only.
      }
    },

    clear() {
      this.password = "";
      this.remember = false;
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        // ignore
      }
      try {
        sessionStorage.removeItem(SESSION_KEY);
      } catch {
        // ignore
      }
    },

    setAuthError(message) {
      this.authError = message ?? null;
    },

    /**
     * Show the login dialog and resolve once the user submits credentials.
     * Concurrent callers share a single dialog/promise. Rejects if cancelled.
     * @returns {Promise<void>}
     */
    promptLogin() {
      if (pendingPromise) {
        return pendingPromise;
      }
      this.showLoginDialog = true;
      pendingPromise = new Promise((resolve, reject) => {
        pendingResolve = resolve;
        pendingReject = reject;
      });
      return pendingPromise;
    },

    /** Called by the login dialog on submit. */
    submitLogin(password, remember = false) {
      this.setCredentials(password, remember);
      this.authError = null;
      this.showLoginDialog = false;
      const resolve = pendingResolve;
      pendingResolve = null;
      pendingReject = null;
      pendingPromise = null;
      if (resolve) {
        resolve();
      }
    },

    /** Called by the login dialog on cancel. */
    cancelLogin() {
      this.showLoginDialog = false;
      const reject = pendingReject;
      pendingResolve = null;
      pendingReject = null;
      pendingPromise = null;
      if (reject) {
        reject(new Error("login cancelled"));
      }
    },
  },
});
