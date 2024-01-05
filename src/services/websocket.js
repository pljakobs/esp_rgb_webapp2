import { reactive, toRefs } from "vue";

export default function useWebSocket(url) {
  const state = reactive({
    data: null,
    error: null,
    socket: null,
    isOpen: false,
  });

  function connect() {
    state.socket = new WebSocket(url);

    state.socket.onopen = () => {
      state.isOpen = true;
    };

    state.socket.onmessage = (event) => {
      state.data = JSON.parse(event.data);
    };

    state.socket.onerror = (error) => {
      state.error = error;
    };

    state.socket.onclose = () => {
      state.isOpen = false;
      // Try to reconnect after 5 seconds
      setTimeout(connect, 5000);
    };
  }

  function destroy() {
    if (state.socket) {
      state.socket.close();
      state.socket = null;
    }
    url = null;
  }

  const send = (method, params) => {
    if (state.isOpen) {
      state.socket.send(JSON.stringify({ jsonrpc: "2.0", method, params }));
    }
  };

  // Call connect to open the WebSocket
  connect();

  return { ...toRefs(state), send, connect, destroy };
}
