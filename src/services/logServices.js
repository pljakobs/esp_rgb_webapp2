import { reactive } from "vue";
import useWebSocket from "src/services/websocket";

const ws = useWebSocket();
const logStore = reactive({
  logs: [],
});

export default function initializeLogService() {
  ws.onJson("log", (params) => {
    logStore.logs.push(params.message);
  });
}

export { logStore };
