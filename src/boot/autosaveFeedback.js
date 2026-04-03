import { boot } from "quasar/wrappers";

const FLASH_CLASS = "q-field--autosave-flash";
const TRACKED_INPUT_TYPES = new Set([
  "",
  "text",
  "search",
  "url",
  "tel",
  "email",
  "password",
  "number",
]);

const baselineForElement = new WeakMap();
const flashTimers = new WeakMap();

function isTrackedElement(element) {
  if (!(element instanceof HTMLElement)) {
    return false;
  }

  if (
    element instanceof HTMLTextAreaElement ||
    (element instanceof HTMLInputElement &&
      TRACKED_INPUT_TYPES.has(element.type))
  ) {
    return (
      !element.disabled && !element.readOnly && !!element.closest(".q-field")
    );
  }

  return false;
}

function flashSavedState(fieldElement) {
  const previousTimer = flashTimers.get(fieldElement);
  if (previousTimer) {
    clearTimeout(previousTimer);
  }

  fieldElement.classList.remove(FLASH_CLASS);
  void fieldElement.offsetWidth;
  fieldElement.classList.add(FLASH_CLASS);

  const timer = setTimeout(() => {
    fieldElement.classList.remove(FLASH_CLASS);
    flashTimers.delete(fieldElement);
  }, 900);

  flashTimers.set(fieldElement, timer);
}

function handleFocusIn(event) {
  const target = event.target;
  if (!isTrackedElement(target)) {
    return;
  }

  baselineForElement.set(target, target.value ?? "");
}

function handleFocusOut(event) {
  const target = event.target;
  if (!isTrackedElement(target)) {
    return;
  }

  const baseline = baselineForElement.get(target);
  baselineForElement.delete(target);

  if (baseline === undefined || baseline === (target.value ?? "")) {
    return;
  }

  const fieldElement = target.closest(".q-field");
  if (!fieldElement) {
    return;
  }

  flashSavedState(fieldElement);
}

export default boot(() => {
  document.addEventListener("focusin", handleFocusIn, true);
  document.addEventListener("focusout", handleFocusOut, true);
});
