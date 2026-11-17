// Shared vitest setup: polyfill browser APIs missing from jsdom.

// Quasar components (e.g. QTabs) observe element sizes via ResizeObserver,
// which jsdom does not implement.
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
