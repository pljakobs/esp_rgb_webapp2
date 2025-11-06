/**
 * Composable for common dialog operations
 * Simplifies dialog creation and management
 */
import { Dialog } from "quasar";

/**
 * Returns dialog helper functions
 * @returns {Object} Dialog helper functions
 */
export function useDialogs() {
  /**
   * Shows a confirmation dialog
   * @param {Object} options - Dialog options
   * @param {string} options.title - Dialog title
   * @param {string} options.message - Dialog message
   * @param {string} [options.okLabel='OK'] - OK button label
   * @param {string} [options.cancelLabel='Cancel'] - Cancel button label
   * @param {boolean} [options.persistent=false] - Whether dialog persists on background click
   * @returns {Promise<boolean>} Resolves to true if OK clicked, false if cancelled
   */
  function confirm({
    title,
    message,
    okLabel = "OK",
    cancelLabel = "Cancel",
    persistent = false,
  }) {
    return new Promise((resolve) => {
      Dialog.create({
        title,
        message,
        ok: {
          label: okLabel,
          flat: true,
        },
        cancel: {
          label: cancelLabel,
          flat: true,
        },
        persistent,
      })
        .onOk(() => resolve(true))
        .onCancel(() => resolve(false))
        .onDismiss(() => resolve(false));
    });
  }

  /**
   * Shows a prompt dialog for text input
   * @param {Object} options - Dialog options
   * @param {string} options.title - Dialog title
   * @param {string} options.message - Dialog message
   * @param {string} [options.model=''] - Initial input value
   * @param {string} [options.placeholder=''] - Input placeholder
   * @param {string} [options.okLabel='OK'] - OK button label
   * @param {string} [options.cancelLabel='Cancel'] - Cancel button label
   * @returns {Promise<string|null>} Resolves to input value or null if cancelled
   */
  function prompt({
    title,
    message,
    model = "",
    placeholder = "",
    okLabel = "OK",
    cancelLabel = "Cancel",
  }) {
    return new Promise((resolve) => {
      Dialog.create({
        title,
        message,
        prompt: {
          model,
          type: "text",
          placeholder,
        },
        ok: {
          label: okLabel,
          flat: true,
        },
        cancel: {
          label: cancelLabel,
          flat: true,
        },
      })
        .onOk((value) => resolve(value))
        .onCancel(() => resolve(null))
        .onDismiss(() => resolve(null));
    });
  }

  /**
   * Shows a component dialog
   * @param {Object} options - Dialog options
   * @param {*} options.component - Vue component to display
   * @param {Object} [options.componentProps={}] - Props to pass to component
   * @param {boolean} [options.persistent=false] - Whether dialog persists on background click
   * @returns {Promise<*>} Resolves to value from onOk, null if cancelled
   */
  function componentDialog({
    component,
    componentProps = {},
    persistent = false,
  }) {
    return new Promise((resolve) => {
      Dialog.create({
        component,
        componentProps,
        persistent,
      })
        .onOk((data) => resolve(data))
        .onCancel(() => resolve(null))
        .onDismiss(() => resolve(null));
    });
  }

  /**
   * Shows a delete confirmation dialog
   * @param {Object} options - Dialog options
   * @param {string} options.itemName - Name of item to delete
   * @param {string} [options.itemType='item'] - Type of item (e.g., 'preset', 'scene')
   * @returns {Promise<boolean>} Resolves to true if delete confirmed
   */
  function confirmDelete({ itemName, itemType = "item" }) {
    return confirm({
      title: `Delete ${itemType}`,
      message: `Are you sure you want to delete "${itemName}"?`,
      okLabel: "Delete",
      cancelLabel: "Cancel",
      persistent: true,
    });
  }

  return {
    confirm,
    prompt,
    componentDialog,
    confirmDelete,
  };
}
