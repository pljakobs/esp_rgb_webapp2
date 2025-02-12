import { reactive } from "vue";
import useWebSocket from "src/services/websocket";

const ws = useWebSocket();
const logStore = reactive({
  logs: [],
});

const MAX_LOG_SIZE = 4 * 1024 * 1024; // 4MB in bytes

function getLogSize() {
  return new Blob(logStore.logs.map((log) => JSON.stringify(log))).size;
}

function trimLogStore() {
  while (getLogSize() > MAX_LOG_SIZE) {
    logStore.logs.shift(); // Remove the oldest log entry
  }
}

function parseLogMessage(message) {
  const timestamp = new Date().toLocaleTimeString();
  let location = "";
  let logMessage = message;

  if (message.startsWith("[")) {
    const endIndex = message.indexOf("]");
    if (endIndex !== -1) {
      location = message.substring(1, endIndex);
      logMessage = message.substring(endIndex + 1).trim();
    }
  }

  return {
    time: timestamp,
    location: location,
    message: logMessage,
  };
}

export default function initializeLogService() {
  ws.onJson("log", (params) => {
    const logEntry = parseLogMessage(params.message);
    logStore.logs.push(logEntry);
    trimLogStore(); // Check and trim the log store if necessary
  });
}

export { logStore };
