import { reactive, toRefs } from "vue";
import { useAuthStore } from "src/stores/authStore";

/**
 * Compute a lowercase-hex SHA-256 digest of `input` using the Web Crypto API.
 * Must match the firmware: SHA256(challenge + ":" + password).
 * @param {string} input
 * @returns {Promise<string>}
 */
async function sha256Hex(input) {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export const wsStatus = {
  CONNECTING: "connecting",
  CONNECTED: "connected",
  DISCONNECTED: "disconnected",
  FAILED: "failed",
};

const state = reactive({
  data: null,
  error: null,
  socket: null,
  url: null,
  status: wsStatus.DISCONNECTED,
});

let lostConnectionTimeout = null;
let reconnectTimeout = null;
let reconnectAttempts = 0;
let requestId = 1;

// Stores for Request/Response handling
const pendingRequests = new Map();
const authRequestIds = new Set();
let authPromise = null;

// Registry for Server-Pushed Notifications (Method -> Set of Callbacks)
const notificationListeners = new Map();

export default function useWebSocket() {
  function handleIncomingMessage(event) {
    console.log("websocket: received incoming message:", event.data);
    let message;
    try {
      message = JSON.parse(event.data);
    } catch (err) {
      console.error("=> websocket failed to parse incoming JSON:", err);
      return;
    }

    const { id, method, params, result, error } = message;

    // 1. JSON-RPC Response Handling (Client-initiated requests)
    if (id !== undefined && id !== null) {
      if (pendingRequests.has(id)) {
        const pending = pendingRequests.get(id);
        const isAuthResponse = authRequestIds.has(id);
        const challenge =
          typeof error?.challenge === "string" ? error.challenge : null;
        const needsAuth =
          !isAuthResponse && challenge && error?.code === -32001;

        if (needsAuth) {
          pendingRequests.delete(id);
          clearTimeout(pending.timeoutHandle);
          authenticateThenRetry(pending, challenge);
        } else {
          pendingRequests.delete(id);
          authRequestIds.delete(id);
          clearTimeout(pending.timeoutHandle);

          if (error) {
            pending.reject(error);
          } else {
            pending.resolve(result ?? params ?? message);
          }
        }
      } else {
        console.warn(
          `=> websocket received response for unknown request ID: ${id}`,
        );
      }
      return;
    }

    // 2. Server-Pushed Notifications (JSON-RPC Notifications omit 'id')
    if (method) {
      dispatchNotification(method, params);
      return;
    }

    console.warn(
      "=> websocket received unhandled or malformed JSON-RPC message:",
      message,
    );
  }

  function dispatchNotification(method, params) {
    const listeners = notificationListeners.get(method);
    console.log(
      `websocket: dispatching notification for method '${method}' to ${listeners?.size || 0} listeners`,
    );
    if (listeners && listeners.size > 0) {
      listeners.forEach((callback) => {
        try {
          callback(params);
        } catch (err) {
          console.error(
            `=> error in notification callback for method '${method}':`,
            err,
          );
        }
      });
    } else {
      console.log(
        `=> websocket notification '${method}' has no active subscribers`,
      );
    }
  }

  function connect(url) {
    if (url === null || url === undefined) {
      console.log("=> websocket url is null or undefined");
      return false;
    }

    if (
      state.socket &&
      state.url === url &&
      (state.socket.readyState === WebSocket.OPEN ||
        state.socket.readyState === WebSocket.CONNECTING)
    ) {
      console.log("=> websocket is already connected or connecting");
      return state.socket;
    }

    if (state.socket && state.url && state.url !== url) {
      console.log(
        "=> websocket target changed, reconnecting from",
        state.url,
        "to",
        url,
      );
      destroy();
    }

    state.url = url;

    console.log("=> websocket connecting to", state.url);
    state.status = wsStatus.CONNECTING;
    state.socket = new WebSocket(state.url);

    state.socket.onopen = () => {
      console.log("=> websocket opened");
      state.status = wsStatus.CONNECTED;
      reconnectAttempts = 0;
    };

    function reconnect() {
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }

      const delay =
        reconnectAttempts < 5 ? 5000 : reconnectAttempts < 25 ? 10000 : 20000;

      if (state.url != null && state.status === wsStatus.FAILED) {
        reconnectTimeout = setTimeout(() => {
          reconnectTimeout = null;
          connect(state.url);
        }, delay);
      }

      reconnectAttempts++;
    }

    state.socket.onmessage = handleIncomingMessage;

    state.socket.onerror = () => {
      if (state.status !== wsStatus.DISCONNECTED) {
        console.log("websocket encountered an error, resetting connection");
        state.status = wsStatus.FAILED;
      }
    };

    state.socket.onclose = () => {
      console.log("=> websocket closing");
      const wasFailed = state.status !== wsStatus.DISCONNECTED;
      state.socket = null;
      rejectAllPending("websocket closed");
      if (wasFailed) {
        console.log("websocket connection failed, attempting to reconnect");
        state.status = wsStatus.FAILED;
        reconnect();
      }
    };
  }

  function rejectAllPending(reason) {
    for (const [, pending] of pendingRequests.entries()) {
      clearTimeout(pending.timeoutHandle);
      pending.reject(new Error(reason));
    }
    pendingRequests.clear();
    authRequestIds.clear();
  }

  function destroy() {
    console.log("=> websocket closing by destroy()");
    if (state.socket) {
      state.socket.onopen = null;
      state.socket.onmessage = null;
      state.socket.onerror = null;
      state.socket.onclose = null;
      if (
        state.socket.readyState === WebSocket.OPEN ||
        state.socket.readyState === WebSocket.CONNECTING
      ) {
        state.socket.close();
      }
    }
    state.status = wsStatus.DISCONNECTED;
    rejectAllPending("websocket destroyed");
    clearTimeout(lostConnectionTimeout);
    clearTimeout(reconnectTimeout);
    state.url = null;
    state.socket = null;
  }

  // Outbound JSON-RPC Notification (Client -> Server, no ID)
  const notify = (method, params) => {
    if (
      state.status === wsStatus.CONNECTED &&
      state.socket?.readyState === WebSocket.OPEN
    ) {
      state.socket.send(JSON.stringify({ jsonrpc: "2.0", method, params }));
    }
  };

  // Outbound JSON-RPC Request (Client -> Server, expects Response matching ID)
  const request = (method, params = {}, timeoutMs = 1500) => {
    if (
      state.status !== wsStatus.CONNECTED ||
      !state.socket ||
      state.socket.readyState !== WebSocket.OPEN
    ) {
      return Promise.reject(new Error("websocket not connected"));
    }

    const id = requestId++;
    const payload = { jsonrpc: "2.0", id, method, params };

    return new Promise((resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        pendingRequests.delete(id);
        reject(new Error(`websocket request timeout for method '${method}'`));
      }, timeoutMs);

      pendingRequests.set(id, {
        resolve,
        reject,
        timeoutHandle,
        method,
        params,
        timeoutMs,
      });

      state.socket.send(JSON.stringify(payload));
    });
  };

  const sendAuthenticate = (hash) => {
    const id = requestId++;
    authRequestIds.add(id);
    const payload = {
      jsonrpc: "2.0",
      id,
      method: "authenticate",
      params: { hash },
    };

    return new Promise((resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        pendingRequests.delete(id);
        authRequestIds.delete(id);
        reject(new Error("authenticate timeout"));
      }, 3000);

      pendingRequests.set(id, {
        resolve,
        reject,
        timeoutHandle,
        method: "authenticate",
        params: { hash },
        timeoutMs: 3000,
      });

      if (
        state.status !== wsStatus.CONNECTED ||
        state.socket?.readyState !== WebSocket.OPEN
      ) {
        clearTimeout(timeoutHandle);
        pendingRequests.delete(id);
        authRequestIds.delete(id);
        reject(new Error("websocket not connected"));
        return;
      }
      state.socket.send(JSON.stringify(payload));
    });
  };

  async function doAuthenticate(initialChallenge) {
    const auth = useAuthStore();
    let challenge = initialChallenge;

    for (let attempt = 0; attempt < 3; attempt++) {
      if (!auth.hasCredentials) {
        await auth.promptLogin();
      }

      const hash = await sha256Hex(`${challenge}:${auth.password}`);
      const res = await sendAuthenticate(hash);

      if (res && res.authenticated === true) {
        auth.setAuthError(null);
        return;
      }

      const nextChallenge =
        typeof res?.error?.challenge === "string" ? res.error.challenge : null;
      auth.setAuthError("authentication failed");
      auth.clear();
      if (!nextChallenge) {
        throw new Error("authentication failed");
      }
      challenge = nextChallenge;
      await auth.promptLogin();
    }
    throw new Error("authentication failed");
  }

  function ensureAuthenticated(challenge) {
    if (!authPromise) {
      authPromise = doAuthenticate(challenge).finally(() => {
        authPromise = null;
      });
    }
    return authPromise;
  }

  async function authenticateThenRetry(pending, challenge) {
    try {
      await ensureAuthenticated(challenge);
      const result = await request(
        pending.method,
        pending.params,
        pending.timeoutMs,
      );
      pending.resolve(result);
    } catch (err) {
      pending.reject(err);
    }
  }

  // Subscribe to server-pushed notifications
  const onNotification = (method, callback) => {
    console.log(
      `websocket: subscribing to notifications for method '${method}'`,
    );
    if (!notificationListeners.has(method)) {
      notificationListeners.set(method, new Set());
    }
    notificationListeners.get(method).add(callback);

    // Teardown unsubscribe function
    return () => {
      offNotification(method, callback);
    };
  };

  // Unsubscribe from server-pushed notifications
  const offNotification = (method, callback) => {
    const listeners = notificationListeners.get(method);
    if (listeners) {
      listeners.delete(callback);
      if (listeners.size === 0) {
        notificationListeners.delete(method);
      }
    }
  };

  return {
    ...toRefs(state),
    notify,
    send: notify,
    request,
    connect,
    destroy,
    onNotification,
    offNotification,
    // Aliases for legacy compatibility
    onJson: onNotification,
    offJson: offNotification,
  };
}
