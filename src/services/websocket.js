import { reactive, toRefs } from "vue";

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

    console.log("=> opening websocket for ", state.url);
    state.status = wsStatus.CONNECTING;
    state.socket = new WebSocket(state.url);

    state.socket.onopen = () => {
      console.log("=> websocket opened");
      state.status = wsStatus.CONNECTED;
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

      if (state.url != null && state.status === wsStatus.CLOSED) {
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

      console.log(
        "=> websocket message",
        key,
        id,
        JSON.stringify(message.params),
      );

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
      if (state.status !== wsStatus.DISCONNECTED) {
        console.log(
          "=> websocket was not disconnected -> probably lost connection",
        );
        state.status = wsStatus.FAILED;
      }

      // Try to reconnect after 5 seconds
      if (state.url != null && state.status === wsStatus.FAILED) {
        console.log("=> websocket reconnecting");
        setTimeout(connect, 5000);
      }
    };
  }

  function destroy() {
    console.log("=> websocket closing by destroy()");
    if (state.socket.readyState === WebSocket.OPEN) {
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
