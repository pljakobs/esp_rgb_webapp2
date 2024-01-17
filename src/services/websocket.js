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
      let manualClose = false;
      state.isOpen = true;
    };

    state.socket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      state.data = message;
      const key = message.method;
      console.log("=> websocket message", key, message.params);
      if (key === "keep_alive") {
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
        lostConnectionTimeout = setTimeout(() => {
          console.log("=> websocket keep_alive timeout");
          state.isOpen = false;
          state.lostConnection = true;

          // Try to reconnect after 65 seconds
          clearTimeout(reconnectTimeout);
          reconnectTimeout = setTimeout(
            () => {
              console.log("=> trying to reconnect");
              connect();
            },
            Math.min(1000 * 2 ** reconnectAttempts, 30000),
          ); // Exponential backoff
          reconnectAttempts += 1;
        }, 65000); // 65 seconds
      }
      if (state.callbacks[key]) {
        state.callbacks[key].forEach((callback) => callback(message.params));
      }
    };

    state.socket.onerror = (error) => {
      console.log("=> websocket error", error);
      state.error = error;
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
