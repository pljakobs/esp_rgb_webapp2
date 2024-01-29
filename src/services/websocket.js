import { reactive, toRefs } from "vue";

const state = reactive({
  data: null,
  error: null,
  socket: null,
  isOpen: false,
  lostConnection: false,
  callbacks: {},
});

const startTime = Date.now();
let lostConnectionTimeout = null;
let reconnectTimeout = null;
let reconnectAttempts = 0;
let manualClose = false;
let currentSocket = null;

export default function useWebSocket() {
  function connect(url) {
    if (state.isOpen || url === null || url === undefined) {
      return currentSocket;
    }
    console.log("websocket.isOpen: ", state.isOpen ? "true" : "false");
    console.log(
      "websocket.lostConnection: ",
      state.lostConnection ? "true" : "false",
    );

    if (state.isOpen && !state.lostConnection) {
      console.log("=> websocket already exists");
      return;
    }
    console.log("=> opening websocket for ", url);
    state.socket = new WebSocket(url);

    state.socket.onopen = () => {
      console.log("=> websocket opened");
      manualClose = false;
      state.isOpen = true;
      state.lostConnection = false;
    };

    function handleKeepAlive(message) {
      console.log("=> keep alive at time", (Date.now() - startTime) / 1000);
      console.log("==> websocket.isOpen: ", state.isOpen ? "true" : "false");
      console.log(
        "==> websocket.lostConnection: ",
        state.lostConnection ? "true" : "false",
      );
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
      lostConnectionTimeout = setTimeout(() => {
        console.log("=> websocket keep_alive timeout");
        manualClose = false;
        state.isOpen = false;
        state.lostConnection = true;
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

      if (url != null && !manualClose) {
        setTimeout(() => {
          connect(url);
        }, delay);
      }

      reconnectAttempts++;
    }

    state.socket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      state.data = message;
      const key = message.method;
      console.log("=> websocket message", key, message.params);
      if (key === "keep_alive") {
        handleKeepAlive(message);
      }
      if (state.callbacks[key]) {
        state.callbacks[key].forEach((callback) => callback(message.params));
      }
    };

    state.socket.onerror = () => {
      reconnect();
    };

    state.socket.onclose = () => {
      console.log("=> websocket closing");
      state.isOpen = false;
      state.lostConnection = false;

      // Try to reconnect after 5 seconds
      if (url != null && !manualClose) {
        setTimeout(connect, 5000);
      }
    };
  }

  function destroy() {
    console.log("=> closing websocket");
    if (state.socket.readyState === WebSocket.OPEN) {
      state.socket.close();
    }
    state.socket.close();
    state.isOpen = false;
    state.lostConnection = false;
    manualClose = true;
    clearTimeout(lostConnectionTimeout);
    clearTimeout(reconnectTimeout);
    url = null;
    currentSocket = null;
  }

  const send = (method, params) => {
    if (state.isOpen) {
      state.socket.send(JSON.stringify({ jsonrpc: "2.0", method, params }));
    }
  };

  const onJson = (key, callback) => {
    if (!state.callbacks[key]) {
      state.callbacks[key] = [];
    }
    console.log("registered callback for ", key);
    state.callbacks[key].push(callback);
  };

  // Call connect to open the WebSocket
  currentSocket = { ...toRefs(state), send, connect, destroy, onJson };
  return currentSocket;
}