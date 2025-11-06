import { Notify } from "quasar";
import useWebSocket from "src/services/websocket";

const ws = useWebSocket();

/**
 * Shows a success notification
 * @param {string} message - Notification message
 * @param {number} [timeout=3000] - Timeout in milliseconds
 */
export function notifySuccess(message, timeout = 3000) {
  Notify.create({
    message,
    color: 'positive',
    icon: 'check_circle',
    timeout
  });
}

/**
 * Shows an error notification
 * @param {string} message - Notification message
 * @param {number} [timeout=5000] - Timeout in milliseconds
 */
export function notifyError(message, timeout = 5000) {
  Notify.create({
    message,
    color: 'negative',
    icon: 'error',
    timeout
  });
}

/**
 * Shows a warning notification
 * @param {string} message - Notification message
 * @param {number} [timeout=4000] - Timeout in milliseconds
 */
export function notifyWarning(message, timeout = 4000) {
  Notify.create({
    message,
    color: 'warning',
    icon: 'warning',
    timeout
  });
}

/**
 * Shows an info notification
 * @param {string} message - Notification message
 * @param {number} [timeout=3000] - Timeout in milliseconds
 */
export function notifyInfo(message, timeout = 3000) {
  Notify.create({
    message,
    color: 'info',
    icon: 'info',
    timeout
  });
}

/**
 * Shows a generic notification
 * @param {Object} options - Notification options (passed to Quasar Notify.create)
 */
export function notify(options) {
  Notify.create(options);
}

export default function initializeNotifications() {
  ws.onJson("notification", (params) => {
    Notify.create({
      message: params.message,
      timeout: 3000,
    });
  });
}
