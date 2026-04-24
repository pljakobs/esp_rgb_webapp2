import { useControllersStore } from "../stores/controllersStore";
import { retryDelay, requestTimeout, maxRetries } from "../stores/storeConstants";
import useWebSocket, { wsStatus } from "./websocket.js";

export class ApiService {
  constructor() {
    this._controllersStore = null;
    // Track active requests per controller to prevent overwhelming them
    this._activeRequests = new Map(); // ip_address -> Set of active request promises
    this._requestQueue = new Map(); // ip_address -> Array of queued requests

    // Keep payloads below a conservative MTU budget to reduce pressure on ESP8266.
    this._chunking = {
      maxPayloadBytes: 1200,
      interChunkDelayMs: 75,
    };
  }

  get controllersStore() {
    if (!this._controllersStore) {
      this._controllersStore = useControllersStore();
    }
    return this._controllersStore;
  }

  /**
   * Ensure only one request per controller at a time
   */
  async _queueRequest(controllerIp, requestFn) {
    // If no active requests for this controller, execute immediately
    if (
      !this._activeRequests.has(controllerIp) ||
      this._activeRequests.get(controllerIp).size === 0
    ) {
      this._activeRequests.set(controllerIp, new Set());

      const promise = requestFn();
      this._activeRequests.get(controllerIp).add(promise);

      try {
        const result = await promise;
        return result;
      } finally {
        this._activeRequests.get(controllerIp).delete(promise);
        // Process next queued request if any
        this._processQueue(controllerIp);
      }
    } else {
      // Queue the request and wait
      return new Promise((resolve, reject) => {
        if (!this._requestQueue.has(controllerIp)) {
          this._requestQueue.set(controllerIp, []);
        }
        this._requestQueue
          .get(controllerIp)
          .push({ requestFn, resolve, reject });
      });
    }
  }

  _processQueue(controllerIp) {
    const queue = this._requestQueue.get(controllerIp);
    if (!queue || queue.length === 0) return;

    const { requestFn, resolve, reject } = queue.shift();

    const promise = requestFn();
    if (!this._activeRequests.has(controllerIp)) {
      this._activeRequests.set(controllerIp, new Set());
    }
    this._activeRequests.get(controllerIp).add(promise);

    promise
      .then(resolve)
      .catch(reject)
      .finally(() => {
        this._activeRequests.get(controllerIp).delete(promise);
        this._processQueue(controllerIp);
      });
  }

  /**
   * Unified API fetch method with controller selection and retry logic
   * @param {string} endpoint - The API endpoint to call
   * @param {Object|null} controller - Specific controller to use, defaults to currentController
   * @param {Object} options - Request options (method, body, headers, etc.)
   * @param {number} retryCount - Current retry count (internal use)
   * @param {number} timeoutMs - Request timeout in milliseconds
   * @returns {Promise<{jsonData: any, error: any, status: number}>}
   */
  async fetchApi(
    endpoint,
    controller = null,
    options = {},
    retryCount = 0,
    timeoutMs = requestTimeout,
  ) {
    const targetController =
      controller || this.controllersStore.currentController;

    if (!targetController) {
      return {
        jsonData: null,
        error: { message: "No controller available" },
        status: null,
      };
    }

    // Queue requests to prevent overwhelming individual controllers
    const controllerIp = targetController.ip_address;
    return this._queueRequest(controllerIp, () =>
      this._executeApi(
        endpoint,
        targetController,
        options,
        retryCount,
        timeoutMs,
      ),
    );
  }

  _getEndpointPath(endpoint) {
    if (!endpoint) return "";
    return String(endpoint).split("?")[0];
  }

  _isChunkableEndpoint(endpoint) {
    const path = this._getEndpointPath(endpoint);
    return path === "data" || path === "config";
  }

  _jsonSizeBytes(value) {
    return new TextEncoder().encode(JSON.stringify(value)).length;
  }

  _splitArrayValueBySize(key, arr, maxPayloadBytes) {
    const chunks = [];
    let current = [];

    for (const item of arr) {
      const candidate = [...current, item];
      const candidatePayload = { [key]: candidate };

      if (
        current.length > 0 &&
        this._jsonSizeBytes(candidatePayload) > maxPayloadBytes
      ) {
        chunks.push({ [key]: current });
        current = [item];
      } else {
        current = candidate;
      }
    }

    if (current.length > 0) {
      chunks.push({ [key]: current });
    }

    return chunks;
  }

  _buildSparseDataUnits(payload, maxPayloadBytes = Infinity) {
    const units = [];

    for (const [key, value] of Object.entries(payload || {})) {
      if (Array.isArray(value)) {
        const isAppend = key.endsWith("[]");

        if (value.length === 0) {
          // Clear / empty-array operation — keep as-is.
          units.push({ [key]: value });
        } else if (isAppend) {
          // Key already carries append semantics (e.g. "scenes[]").
          // Split into size-limited batches to avoid oversized payloads;
          // the firmware will append each batch in turn.
          const batches = this._splitArrayValueBySize(
            key,
            value,
            maxPayloadBytes,
          );
          units.push(...batches);
        } else {
          // Regular array key — convert each item to a sparse selector patch.
          for (const item of value) {
            const id = item?.id;
            if (id !== undefined && id !== null && id !== "") {
              units.push({ [`${key}[id=${id}]`]: item });
            } else {
              // Fallback for entries without id: append semantics.
              units.push({ [`${key}[]`]: [item] });
            }
          }
        }
      } else {
        units.push({ [key]: value });
      }
    }

    return units;
  }

  _buildPayloadChunks(payload, maxPayloadBytes, endpointPath = "") {
    if (
      !payload ||
      typeof payload !== "object" ||
      Array.isArray(payload) ||
      this._jsonSizeBytes(payload) <= maxPayloadBytes
    ) {
      return [payload];
    }

    const units =
      endpointPath === "data"
        ? this._buildSparseDataUnits(payload, maxPayloadBytes)
        : Object.entries(payload).flatMap(([key, value]) => {
            if (Array.isArray(value) && value.length > 1) {
              return this._splitArrayValueBySize(key, value, maxPayloadBytes);
            }
            return [{ [key]: value }];
          });

    const payloads = [];
    let current = {};

    for (const unit of units) {
      const candidate = { ...current, ...unit };
      if (
        Object.keys(current).length > 0 &&
        this._jsonSizeBytes(candidate) > maxPayloadBytes
      ) {
        payloads.push(current);
        current = { ...unit };
      } else {
        current = candidate;
      }
    }

    if (Object.keys(current).length > 0) {
      payloads.push(current);
    }

    return payloads;
  }

  _sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  _canUseWebSocketForController(controller = null) {
    if (!controller) {
      return true;
    }

    const current = this.controllersStore.currentController;
    if (!current?.ip_address || !controller?.ip_address) {
      return false;
    }

    return String(current.ip_address) === String(controller.ip_address);
  }

  async fetchJsonRpc(method, params = {}, controller = null, timeoutMs = 1500) {
    if (!this._canUseWebSocketForController(controller)) {
      return {
        jsonData: null,
        error: { message: "websocket controller mismatch" },
        status: null,
      };
    }

    const ws = useWebSocket();
    if (ws.status?.value !== wsStatus.CONNECTED || typeof ws.request !== "function") {
      return {
        jsonData: null,
        error: { message: "websocket not connected" },
        status: null,
      };
    }

    try {
      const payload = await ws.request(method, params, timeoutMs);
      const jsonData = payload?.message ?? payload;
      if (!jsonData || typeof jsonData !== "object") {
        return {
          jsonData: null,
          error: { message: "invalid websocket payload" },
          status: null,
        };
      }

      return { jsonData, error: null, status: null };
    } catch (error) {
      return { jsonData: null, error, status: null };
    }
  }

  async _dispatchAction(
    method,
    params = {},
    controller = null,
    options = {},
  ) {
    const {
      timeoutMs = 1200,
      preferWebSocket = true,
      allowHttpFallback = true,
      httpEndpoint = method,
      httpMethod = "POST",
    } = options;

    if (preferWebSocket) {
      const wsResponse = await this.fetchJsonRpc(
        method,
        params,
        controller,
        timeoutMs,
      );

      if (!wsResponse.error && wsResponse.jsonData) {
        return wsResponse;
      }

      if (!allowHttpFallback) {
        return wsResponse;
      }
    }

    if (!allowHttpFallback) {
      return {
        jsonData: null,
        error: {
          message: `No HTTP endpoint available for action '${method}'`,
        },
        status: null,
      };
    }

    return this.fetchApi(httpEndpoint, controller, {
      method: httpMethod,
      body: params,
    });
  }

  async _executeChunkedPost(
    endpoint,
    targetController,
    options,
    retryCount,
    timeoutMs,
  ) {
    const endpointPath = this._getEndpointPath(endpoint);
    const payloads = this._buildPayloadChunks(
      options.body,
      this._chunking.maxPayloadBytes,
      endpointPath,
    );

    if (payloads.length <= 1) {
      return this._executeFetchApi(
        endpoint,
        targetController,
        options,
        retryCount,
        timeoutMs,
      );
    }

    let lastResult = { jsonData: null, error: null, status: null };

    for (let i = 0; i < payloads.length; i++) {
      const chunkOptions = {
        ...options,
        body: payloads[i],
      };

      lastResult = await this._executeFetchApi(
        endpoint,
        targetController,
        chunkOptions,
        retryCount,
        timeoutMs,
      );

      if (lastResult.error || (lastResult.status && lastResult.status >= 400)) {
        return {
          ...lastResult,
          error: {
            ...(lastResult.error || {}),
            chunkIndex: i,
            chunkCount: payloads.length,
          },
        };
      }

      if (i < payloads.length - 1 && this._chunking.interChunkDelayMs > 0) {
        await this._sleep(this._chunking.interChunkDelayMs);
      }
    }

    return {
      ...lastResult,
      jsonData: lastResult.jsonData || {
        success: true,
        chunks: payloads.length,
      },
    };
  }

  async _executeApi(
    endpoint,
    targetController,
    options,
    retryCount,
    timeoutMs,
  ) {
    const method = (options?.method || "GET").toUpperCase();
    const canChunk =
      method === "POST" &&
      this._isChunkableEndpoint(endpoint) &&
      options?.body &&
      typeof options.body === "object";

    if (canChunk) {
      return this._executeChunkedPost(
        endpoint,
        targetController,
        options,
        retryCount,
        timeoutMs,
      );
    }

    return this._executeFetchApi(
      endpoint,
      targetController,
      options,
      retryCount,
      timeoutMs,
    );
  }

  /**
   * Backward-compatible config payload normalization.
   * Legacy clients may still send telemetry at top-level.
   */
  normalizeConfigPayload(data) {
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return data;
    }

    const normalized = { ...data };
    if (
      normalized.telemetry &&
      typeof normalized.telemetry === "object" &&
      !Array.isArray(normalized.telemetry)
    ) {
      normalized.network = {
        ...(normalized.network || {}),
        telemetry: {
          ...((normalized.network && normalized.network.telemetry) || {}),
          ...normalized.telemetry,
        },
      };
      delete normalized.telemetry;
    }

    return normalized;
  }

  async _executeFetchApi(
    endpoint,
    targetController,
    options,
    retryCount,
    timeoutMs,
  ) {
    let error = null;
    let jsonData = null;
    let status = null;

    const { method = "GET", body = null, headers = {} } = options;

    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), timeoutMs);

    try {
      console.log(endpoint, " start fetching data");

      const requestOptions = {
        signal: abortController.signal,
        method,
        headers: {
          ...headers,
        },
      };

      // Add Content-Type header and body for non-GET requests
      if (body && method !== "GET") {
        requestOptions.headers["Content-Type"] = "application/json";
        requestOptions.body = JSON.stringify(body);
      }

      const response = await fetch(
        `http://${targetController.ip_address}/${endpoint}`,
        requestOptions,
      );

      clearTimeout(timeoutId); // Clear timeout on successful response
      status = response.status;

      if (response.status === 429 && retryCount < maxRetries) {
        // Too many requests, retry after a delay
        console.log("429 error", response.status, response.statusText);
        console.log(
          `Request limit reached, retrying after ${
            retryDelay * 2 ** retryCount
          }ms...`,
        );
        return new Promise((resolve) =>
          setTimeout(
            () =>
              resolve(
                this._executeFetchApi(
                  endpoint,
                  targetController,
                  options,
                  retryCount + 1,
                  timeoutMs,
                ),
              ),
            retryDelay * 2 ** retryCount,
          ),
        );
      } else if (response.status === 404) {
        // this endpoint does not exist, bail out without retry
        console.log("404 error", response.status, response.statusText);
        return {
          jsonData,
          error: { status: response.status, statusText: response.statusText },
          status,
        };
      } else if (response.status >= 400) {
        // Any other non-2xx response (400, 500, …) is a hard error.
        // The firmware returns JSON with an error description for 400.
        // Note: we check status explicitly rather than response.ok because
        // test mocks may not set the ok property.
        let errorBody = null;
        try {
          errorBody = await response.json();
        } catch (_) {
          try {
            errorBody = await response.text();
          } catch (_) {}
        }
        console.error(
          `HTTP ${response.status} error on ${endpoint}:`,
          errorBody,
        );
        return {
          jsonData: errorBody,
          error: {
            message: `HTTP ${response.status}`,
            status: response.status,
          },
          status,
        };
      }

      jsonData = await response.json();
      console.log(endpoint, " data fetched: ", JSON.stringify(jsonData));
    } catch (err) {
      clearTimeout(timeoutId); // Clear timeout on error to prevent timer leak
      console.error("Error fetching data:", err);

      // Check if it's a timeout error
      if (err.name === "AbortError") {
        console.log(`Request timed out after ${timeoutMs}ms`);
        error = { ...err, isTimeout: true };
      } else {
        error = err;
      }

      if (retryCount < maxRetries) {
        return new Promise((resolve) =>
          setTimeout(
            () =>
              resolve(
                this._executeFetchApi(
                  endpoint,
                  targetController,
                  options,
                  retryCount + 1,
                  timeoutMs,
                ),
              ),
            retryDelay * 2 ** retryCount,
          ),
        );
      }
    }

    return { jsonData, error, status };
  }

  // Convenience methods for common API endpoints
  async requestToController(endpoint, controller = null) {
    return this.fetchApi(endpoint, controller);
  }

  async getAppData(controller = null) {
    return this.fetchApi("data", controller);
  }

  async getChannelData(controller = null) {
    return this.fetchApi("channels", controller);
  }

  async getColorData(controller = null) {
    const wsResponse = await this.fetchJsonRpc("color", {}, controller);
    if (!wsResponse.error && wsResponse.jsonData) {
      return wsResponse;
    }

    return this.fetchApi("color", controller);
  }

  async getNetworkData(controller = null) {
    const wsResponse = await this.fetchJsonRpc("networks", {}, controller);
    if (!wsResponse.error && wsResponse.jsonData) {
      return wsResponse;
    }

    return this.fetchApi("networks", controller);
  }

  async getWifiData(controller = null) {
    return this.getNetworkData(controller);
  }

  async getSystemData(controller = null) {
    // /system is POST-only for commands, use /info for system information
    return this.fetchApi("info?v=2", controller);
  }

  async getAnimationData(controller = null) {
    // No direct animation endpoint, but there are individual commands
    return {
      jsonData: null,
      error: { message: "No animation data endpoint available" },
      status: null,
    };
  }

  async getToggles(controller = null) {
    // No toggles endpoint in webserver.cpp
    return {
      jsonData: null,
      error: { message: "No toggles endpoint available" },
      status: null,
    };
  }

  async getTransition(controller = null) {
    // No transition endpoint in webserver.cpp
    return {
      jsonData: null,
      error: { message: "No transition endpoint available" },
      status: null,
    };
  }

  async getScheduler(controller = null) {
    // No scheduler endpoint in webserver.cpp
    return {
      jsonData: null,
      error: { message: "No scheduler endpoint available" },
      status: null,
    };
  }

  async getConfig(controller = null) {
    const wsResponse = await this.fetchJsonRpc("config", {}, controller);
    if (!wsResponse.error && wsResponse.jsonData) {
      return wsResponse;
    }

    return this.fetchApi("config", controller);
  }

  async getNtpData(controller = null) {
    // No NTP endpoint, this would be part of config
    return {
      jsonData: null,
      error: { message: "No NTP endpoint available, check config" },
      status: null,
    };
  }

  async getChannelData(controller = null) {
    // No channels endpoint, this would be part of config
    return {
      jsonData: null,
      error: { message: "No channels endpoint available, check config" },
      status: null,
    };
  }

  // Additional real endpoints from webserver.cpp
  async scanNetworks(controller = null) {
    return this._dispatchAction("scan_networks", {}, controller, {
      httpEndpoint: "scan_networks",
    });
  }

  async connect(data, controller = null) {
    return this.fetchApi("connect", controller, { method: "POST", body: data });
  }

  async systemCommand(data, controller = null) {
    return this._dispatchAction("system", data, controller, {
      httpEndpoint: "system",
    });
  }

  async toggleOn(data, controller = null) {
    return this.setOn(data, controller);
  }

  async toggleOff(data, controller = null) {
    return this.setOff(data, controller);
  }

  async setColor(data, controller = null) {
    return this._dispatchAction("color", data, controller, {
      httpEndpoint: "color",
    });
  }

  async stopAction(data = {}, controller = null) {
    return this._dispatchAction("stop", data, controller, {
      httpEndpoint: "stop",
    });
  }

  async skipAction(data = {}, controller = null) {
    return this._dispatchAction("skip", data, controller, {
      httpEndpoint: "skip",
    });
  }

  async pauseAction(data = {}, controller = null) {
    return this._dispatchAction("pause", data, controller, {
      httpEndpoint: "pause",
    });
  }

  async continueAction(data = {}, controller = null) {
    return this._dispatchAction("continue", data, controller, {
      httpEndpoint: "continue",
    });
  }

  async blinkAction(data = {}, controller = null) {
    return this._dispatchAction("blink", data, controller, {
      httpEndpoint: "blink",
    });
  }

  async toggleAction(data = {}, controller = null) {
    return this._dispatchAction("toggle", data, controller, {
      httpEndpoint: "toggle",
    });
  }

  async directAction(data = {}, controller = null) {
    // There is no HTTP /direct endpoint; this action is JSON-RPC-only.
    return this._dispatchAction("direct", data, controller, {
      allowHttpFallback: false,
    });
  }

  async setOn(data = {}, controller = null) {
    return this._dispatchAction("on", data, controller, {
      httpEndpoint: "on",
    });
  }

  async setOff(data = {}, controller = null) {
    return this._dispatchAction("off", data, controller, {
      httpEndpoint: "off",
    });
  }

  async getAllData(controller = null) {
    return this.fetchApi("data", controller);
  }

  async getInfo(controller = null) {
    const v2Response = await this.fetchApi("info?v=2", controller);

    // Transitional compatibility: prefer /info?v=2 but fall back to /info when
    // older firmware does not support the versioned endpoint.
    if (
      v2Response?.error?.status === 404 ||
      (!v2Response?.jsonData && v2Response?.error)
    ) {
      return this.fetchApi("info", controller);
    }

    return v2Response;
  }

  async getData(controller = null) {
    return this.fetchApi("data", controller);
  }

  // POST methods - only for existing endpoints
  async postAppData(data, controller = null) {
    return this.fetchApi("data", controller, {
      method: "POST",
      body: data,
    });
  }

  async postChannelData(data, controller = null) {
    // No channels endpoint, return error
    return {
      jsonData: null,
      error: { message: "No channels endpoint available" },
      status: null,
    };
  }

  async postColorData(data, controller = null) {
    return this.setColor(data, controller);
  }

  async postNetworkData(data, controller = null) {
    // No POST to networks, might be part of config or connect
    return {
      jsonData: null,
      error: { message: "Use connect endpoint for network operations" },
      status: null,
    };
  }

  async postWifiData(data, controller = null) {
    // Use connect endpoint for WiFi operations
    return this.fetchApi("connect", controller, {
      method: "POST",
      body: data,
    });
  }

  async postSystemData(data, controller = null) {
    return this.systemCommand(data, controller);
  }

  async postConfig(data, controller = null) {
    const normalizedData = this.normalizeConfigPayload(data);
    return this.fetchApi("config", controller, {
      method: "POST",
      body: normalizedData,
    });
  }

  // Legacy method support
  async getDataFromController(ipAddress, options = {}) {
    const controller = { ip_address: ipAddress };
    const { timeout, ...requestOptions } = options;
    return this.fetchApi(
      "data",
      controller,
      requestOptions,
      0,
      timeout || requestTimeout,
    );
  }

  async getHosts(showAll = false) {
    return this.fetchApi(`hosts?all=${showAll}`);
  }

  async updateDataOnController(ipAddress, data, options = {}) {
    const controller = { ip_address: ipAddress };
    const { timeout, ...requestOptions } = options;
    return this.fetchApi(
      "data",
      controller,
      {
        method: "POST",
        body: data,
        ...requestOptions,
      },
      0,
      timeout || requestTimeout,
    );
  }

  async getColorFromController(ipAddress, options = {}) {
    const controller = { ip_address: ipAddress };
    return this.fetchApi("color", controller, options);
  }
}

// Create and export a singleton instance
export const apiService = new ApiService();

// Export individual methods for backward compatibility
export const {
  fetchApi,
  requestToController,
  getAppData,
  getChannelData,
  getColorData,
  getNetworkData,
  getWifiData,
  getSystemData,
  getAnimationData,
  getToggles,
  getTransition,
  getScheduler,
  getConfig,
  getNtpData,
  getAllData,
  getInfo,
  getData,
  postAppData,
  postChannelData,
  postColorData,
  postNetworkData,
  postWifiData,
  postSystemData,
  postConfig,
  setColor,
  stopAction,
  skipAction,
  pauseAction,
  continueAction,
  blinkAction,
  toggleAction,
  directAction,
  setOn,
  setOff,
} = apiService;
