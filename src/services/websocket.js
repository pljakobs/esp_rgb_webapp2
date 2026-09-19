import { reactive, toRefs } from "vue";
import { useAuthStore } from "src/stores/authStore";

let requestQueue = Promise.resolve();

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
  callbacks: {},
});

const startTime = Date.now();
let lostConnectionTimeout = null;
let reconnectTimeout = null;
let reconnectAttempts = 0;
let requestId = 1;
const pendingRequests = new Map();
// Ids belonging to in-flight `authenticate` calls, so their responses bypass
// the auth-challenge auto-handler and resolve normally.
const authRequestIds = new Set();
// Single shared authentication attempt; concurrent challenges await the same one.
let authPromise = null;

export default function useWebSocket() {
  function connect(url) {
    if (url === null || url === undefined) {
      console.log("=> websocket url is null or undefined");
      return false;
    }

    if (
      state.socket &&
      state.url === url &&
      state.socket.readyState === WebSocket.OPEN
    ) {
      console.log("=> websocket is already connected");
      return state.socket;
    }

    if (
      state.socket &&
      state.url === url &&
      state.socket.readyState === WebSocket.CONNECTING
    ) {
      console.log("=> websocket is connecting");
      return false;
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

    console.log("=> opening websocket for ", state.url);
    state.status = wsStatus.CONNECTING;
    state.socket = new WebSocket(state.url);

    state.socket.onopen = () => {
      console.log("=> websocket opened");
      state.status = wsStatus.CONNECTED;
      reconnectAttempts = 0;
    };

    function handleKeepAlive(message) {
      console.log("=> keep alive at time", (Date.now() - startTime) / 1000);
      console.log("==> websocket is: ", state.status);
      send("keep_alive", { id: message.id });
      clearTimeout(lostConnectionTimeout);
      resetLostConnectionTimeout();
    }

    function resetLostConnectionTimeout() {
      lostConnectionTimeout = setTimeout(() => {
        console.log("=> websocket keep_alive timeout");
        state.status = wsStatus.FAILED;
        state.socket.close();
        reconnect();
      }, 125000);
    }

    function reconnect() {
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }

      let delay =
        reconnectAttempts < 5 ? 5000 : reconnectAttempts < 25 ? 10000 : 20000;

      if (state.url != null && state.status === wsStatus.FAILED) {
        reconnectTimeout = setTimeout(() => {
          reconnectTimeout = null;
          connect(state.url);
        }, delay);
      }

      reconnectAttempts++;
    }

    state.socket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      state.data = message;
      const key = message.method;
      const id = message.id;

      if (id !== undefined && pendingRequests.has(id)) {
        const pending = pendingRequests.get(id);

        const isAuthResponse = authRequestIds.has(id);
        const challenge =
          typeof message.error?.challenge === "string"
            ? message.error.challenge
            : null;
        const needsAuth =
          !isAuthResponse &&
          challenge &&
          message.error &&
          message.error.code === -32001;

        if (needsAuth) {
          pendingRequests.delete(id);
          clearTimeout(pending.timeoutHandle);
          authenticateThenRetry(pending, challenge);
        } else {
          pendingRequests.delete(id);
          authRequestIds.delete(id);
          clearTimeout(pending.timeoutHandle);
          pending.resolve(message.params ?? message.result ?? message);
        }
      }

      if (key === "keep_alive") {
        handleKeepAlive(message);
      } else if (state.callbacks[key]) {
        state.callbacks[key].forEach((callback) => callback(message.params));
      } else {
        console.log(
          `=> websocket message '${key}' has no subscriber, discarding`,
        );
      }
    };

    state.socket.onerror = () => {
      if (state.status !== wsStatus.DISCONNECTED) {
        state.status = wsStatus.FAILED;
      }
    };

    state.socket.onclose = () => {
      console.log("=> websocket closing");
      const wasFailed = state.status !== wsStatus.DISCONNECTED;
      state.socket = null;

      if (wasFailed) {
        state.status = wsStatus.FAILED;
        reconnect();
      }
    };
  }

  function destroy() {
    console.log("=> websocket closing by destroy()");
    if (state.socket && state.socket.readyState === WebSocket.OPEN) {
      state.socket.close();
    }
    state.status = wsStatus.DISCONNECTED;

    clearTimeout(lostConnectionTimeout);
    clearTimeout(reconnectTimeout);
    state.url = null;
    state.socket = null;
  }

  const send = (method, params) => {
    if (
      state.status === wsStatus.CONNECTED &&
      state.socket?.readyState === WebSocket.OPEN
    ) {
      state.socket.send(JSON.stringify({ jsonrpc: "2.0", method, params }));
    }
  };

  const request = (method, params = {}, timeoutMs = 1500) => {
    requestQueue = requestQueue.then(async () => {
      if (
        state.status !== wsStatus.CONNECTED ||
        state.socket?.readyState !== WebSocket.OPEN
      ) {
        throw new Error("websocket not connected");
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
    });

    return requestQueue;
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

  const onJson = (key, callback) => {
    console.log("=> registering callback for ", key);
    if (!state.callbacks[key]) {
      state.callbacks[key] = [];
    }
    console.log("registered callback for ", key);
    state.callbacks[key].push(callback);

    return () => {
      offJson(key, callback);
    };
  };

  const offJson = (key, callback) => {
    const list = state.callbacks[key];
    if (!list || !list.length) {
      return;
    }
    state.callbacks[key] = list.filter((cb) => cb !== callback);
    if (!state.callbacks[key].length) {
      delete state.callbacks[key];
    }
  };

  return {
    ...toRefs(state),
    send,
    request,
    connect,
    destroy,
    onJson,
    offJson,
  };
}
