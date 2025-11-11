import { reactive, toRefs } from "vue";

export const wsStatus = {
  CONNECTING: "connecting",
  CONNECTED: "connected",
  DISCONNECTED: "disconnected",
  FAILED: "failed",
  CLOSED: "closed",
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
//let manualClose = false;

export default function useWebSocket() {
  function connect(url) {
    state.url = url;
    if (url === null || url === undefined) {
      console.log("=> websocket url is null or undefined");
      return false;
    } else if (state.status === wsStatus.CONNECTED) {
      console.log("=> websocket is already connected");
      return state.socket;
    } else if (state.status === wsStatus.CONNECTING) {
      console.log("=> websocket is connecting");
      return false;
    }

    // Clean up any existing socket
    if (state.socket) {
      state.socket.close();
      state.socket = null;
    }

    // Clear any existing timeouts
    clearTimeout(lostConnectionTimeout);
    clearTimeout(reconnectTimeout);

    console.log("=> opening websocket for ", state.url);
    state.status = wsStatus.CONNECTING;

    try {
      state.socket = new WebSocket(state.url);
    } catch (error) {
      console.error("=> websocket creation failed:", error);
      state.status = wsStatus.FAILED;
      scheduleReconnect();
      return false;
    }

    state.socket.onopen = () => {
      console.log("=> websocket opened");
      state.status = wsStatus.CONNECTED;
      reconnectAttempts = 0; // Reset reconnect attempts on successful connection
      clearTimeout(reconnectTimeout); // Clear any pending reconnect
      resetLostConnectionTimeout(); // Start keep-alive monitoring
    };

    function handleKeepAlive(message) {
      console.log("=> keep alive at time", (Date.now() - startTime) / 1000);
      console.log("==> websocket is: ", state.status);
      const response = {
        id: message.id,
        method: "keep_alive",
        params: {},
      };
      send(JSON.stringify(response));
      clearTimeout(lostConnectionTimeout);
      resetLostConnectionTimeout();
    }

    function resetLostConnectionTimeout() {
      clearTimeout(lostConnectionTimeout); // Clear any existing timeout
      lostConnectionTimeout = setTimeout(() => {
        console.log("=> websocket keep_alive timeout");
        state.status = wsStatus.FAILED;
        if (state.socket) {
          state.socket.close();
        }
        scheduleReconnect();
      }, 125000); // This is the timeout for the keep_alive message
    }

    function scheduleReconnect() {
      // Clear any existing reconnect timeout
      clearTimeout(reconnectTimeout);

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

      console.log(
        `=> scheduling reconnect attempt #${reconnectAttempts + 1} in ${delay}ms`,
      );

      reconnectTimeout = setTimeout(() => {
        if (
          state.url != null &&
          (state.status === wsStatus.FAILED || state.status === wsStatus.CLOSED)
        ) {
          reconnectAttempts++;
          connect(state.url);
        }
      }, delay);
    }

    state.socket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      state.data = message;
      const key = message.method;
      const id = message.id;
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
      }
      if (state.callbacks[key]) {
        state.callbacks[key].forEach((callback) => callback(message.params));
      }
    };

    state.socket.onerror = (error) => {
      console.log("=> websocket error:", error);
      // Don't immediately reconnect on error - let onclose handle it
      state.status = wsStatus.FAILED;
    };

    state.socket.onclose = (event) => {
      console.log(
        "=> websocket closing, code:",
        event.code,
        "reason:",
        event.reason,
      );
      clearTimeout(lostConnectionTimeout); // Stop keep-alive monitoring

      // Determine if this was a manual close or connection failure
      if (state.status === wsStatus.DISCONNECTED) {
        console.log("=> websocket manually disconnected");
        return; // Don't reconnect if manually disconnected
      }

      console.log("=> websocket connection lost, will attempt to reconnect");
      state.status = wsStatus.CLOSED;

      // Schedule reconnection if we have a URL
      if (state.url != null) {
        scheduleReconnect();
      }
    };
  }

  function destroy() {
    console.log("=> websocket closing by destroy()");

    // Clear all timeouts
    clearTimeout(lostConnectionTimeout);
    clearTimeout(reconnectTimeout);

    // Mark as manually disconnected to prevent reconnection
    state.status = wsStatus.DISCONNECTED;

    // Close the socket if it exists and is open
    if (state.socket && state.socket.readyState === WebSocket.OPEN) {
      state.socket.close(1000, "Manual disconnect"); // Normal closure
    }

    // Clean up state
    state.url = null;
    state.socket = null;
    reconnectAttempts = 0;
  }

  const send = (method, params) => {
    if (state.status === wsStatus.CONNECTED) {
      state.socket.send(JSON.stringify({ jsonrpc: "2.0", method, params }));
    }
  };

  const onJson = (key, callback) => {
    console.log("=> registering callback for ", key);
    if (!state.callbacks[key]) {
      state.callbacks[key] = [];
    }
    console.log("registered callback for ", key);
    state.callbacks[key].push(callback);
  };

  console.log("=> useWebsocket state: ", JSON.stringify(state));
  // Call connect to open the WebSocket
  let currentSocket = { ...toRefs(state), send, connect, destroy, onJson };
  return currentSocket;
}
