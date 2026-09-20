import useWebSocket from "src/services/websocket";

const ws = useWebSocket();
export default function initializeAppCommands() {
  ws.onNotification("webapp_cmd", (params) => {
    if (params.message === "reload") {
      setTimeout(() => {
        location.reload();
      }, 10000);
    }
  });
}
