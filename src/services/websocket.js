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
//let manualClose = false;

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
      }, 125000); // This is the timeout for the keep_alive message
    }

    function reconnect() {
      // Try to reconnect after 5 seconds for the first 5 attempts
      // Then try to reconnect after 10 seconds for the next 20 attempts
      // Then try to reconnect after 20 seconds for all subsequent attempts
      let delay;
      if (reconnectAttempts < 5) {
        delay = 5000;
      } else if (reconnectAttempts < 25) {
        delay = 10000;
      } else {
        delay = 20000;
      }

      if (state.url != null && state.status === wsStatus.FAILED) {
        setTimeout(() => {
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
          typeof message.challenge === "string" ? message.challenge : null;
        const needsAuth =
          !isAuthResponse &&
          challenge &&
          message.error &&
          message.error.code === -32001;

        if (needsAuth) {
          // Hold this request, authenticate, then transparently retry it.
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
      /*
      console.log(
        "=> websocket message",
        key,
        id,
        JSON.stringify(message.params),
      );
      */
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
      reconnect();
    };

    state.socket.onclose = () => {
      console.log("=> websocket closing");
      state.socket = null;
      if (state.status !== wsStatus.DISCONNECTED) {
        console.log(
          "=> websocket was not disconnected -> probably lost connection",
        );
        state.status = wsStatus.FAILED;
      }

      // Try to reconnect using progressive backoff
      if (state.url != null && state.status === wsStatus.FAILED) {
        console.log("=> websocket reconnecting");
        reconnect();
      }
    };
  }

  function destroy() {
    console.log("=> websocket closing by destroy()");
    if (state.socket && state.socket.readyState === WebSocket.OPEN) {
      //if socket was open, close
      state.socket.close();
    }
    //state.socket.close();
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
    // Chain the new request onto the existing queue
    requestQueue = requestQueue.then(async () => {
      // Standard connection check
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

  // Send an `authenticate` message and resolve with the firmware's response.
  // Bypasses the auto-challenge handler via authRequestIds so failures (which
  // carry a fresh challenge) can be inspected by the caller.
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

      // Firmware returns a fresh challenge alongside the failure.
      const nextChallenge =
        typeof res?.challenge === "string" ? res.challenge : null;
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

  // Call connect to open the WebSocket
  let currentSocket = {
    ...toRefs(state),
    send,
    request,
    connect,
    destroy,
    onJson,
    offJson,
  };
  return currentSocket;
}
