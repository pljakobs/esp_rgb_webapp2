import { Notify } from "quasar";
import useWebSocket from "src/services/websocket";

const ws = useWebSocket();
export default function initializeNotifications() {
  ws.onJson("notification", (params) => {
    Notify.create({
      message: params.message,
      timeout: 3000, // Optional: Customize the notification duration
    });
  });
}
