import { useControllersStore } from "../stores/controllersStore";
import { retryDelay, requestTimeout } from "../stores/storeConstants";

export class ApiService {
  constructor() {
    this._controllersStore = null;
    // Track active requests per controller to prevent overwhelming them
    this._activeRequests = new Map(); // ip_address -> Set of active request promises
    this._requestQueue = new Map();   // ip_address -> Array of queued requests
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
    if (!this._activeRequests.has(controllerIp) || this._activeRequests.get(controllerIp).size === 0) {
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
        this._requestQueue.get(controllerIp).push({ requestFn, resolve, reject });
      });
    }
  }

  _processQueue(controllerIp) {
    const queue = this._requestQueue.get(controllerIp);
    if (!queue || queue.length === 0) return;

    const { requestFn, resolve, reject } = queue.shift();
    
    const promise = requestFn();
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
    timeoutMs = requestTimeout
  ) {
    const targetController = controller || this.controllersStore.currentController;

    if (!targetController) {
      return {
        jsonData: null,
        error: { message: "No controller available" },
        status: null
      };
    }

    // Queue requests to prevent overwhelming individual controllers
    const controllerIp = targetController.ip_address;
    return this._queueRequest(controllerIp, () => 
      this._executeFetchApi(endpoint, targetController, options, retryCount, timeoutMs)
    );
  }

  async _executeFetchApi(endpoint, targetController, options, retryCount, timeoutMs) {
    const maxRetries = 10;
    let error = null;
    let jsonData = null;
    let status = null;

    const {
      method = 'GET',
      body = null,
      headers = {},
    } = options;

    try {
      console.log(endpoint, " start fetching data");
      const abortController = new AbortController();
      const timeoutId = setTimeout(() => abortController.abort(), timeoutMs);

      const requestOptions = {
        signal: abortController.signal,
        method,
        headers: {
          ...headers
        }
      };

      // Add Content-Type header and body for non-GET requests
      if (body && method !== 'GET') {
        requestOptions.headers['Content-Type'] = 'application/json';
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
            () => resolve(this._executeFetchApi(endpoint, targetController, options, retryCount + 1, timeoutMs)),
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
      }
      
      jsonData = await response.json();
      console.log(endpoint, " data fetched: ", JSON.stringify(jsonData));
    } catch (err) {
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
            () => resolve(this._executeFetchApi(endpoint, targetController, options, retryCount + 1, timeoutMs)),
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
    return this.fetchApi("color", controller);
  }

  async getNetworkData(controller = null) {
    return this.fetchApi("networks", controller);
  }

  async getWifiData(controller = null) {
    return this.fetchApi("networks", controller);
  }

  async getSystemData(controller = null) {
    // /system is POST-only for commands, use /info for system information
    return this.fetchApi("info", controller);
  }

  async getAnimationData(controller = null) {
    // No direct animation endpoint, but there are individual commands
    return { jsonData: null, error: { message: "No animation data endpoint available" }, status: null };
  }

  async getToggles(controller = null) {
    // No toggles endpoint in webserver.cpp
    return { jsonData: null, error: { message: "No toggles endpoint available" }, status: null };
  }

  async getTransition(controller = null) {
    // No transition endpoint in webserver.cpp  
    return { jsonData: null, error: { message: "No transition endpoint available" }, status: null };
  }

  async getScheduler(controller = null) {
    // No scheduler endpoint in webserver.cpp
    return { jsonData: null, error: { message: "No scheduler endpoint available" }, status: null };
  }

  async getConfig(controller = null) {
    return this.fetchApi("config", controller);
  }

  async getNtpData(controller = null) {
    // No NTP endpoint, this would be part of config
    return { jsonData: null, error: { message: "No NTP endpoint available, check config" }, status: null };
  }

  async getChannelData(controller = null) {
    // No channels endpoint, this would be part of config  
    return { jsonData: null, error: { message: "No channels endpoint available, check config" }, status: null };
  }

  // Additional real endpoints from webserver.cpp
  async scanNetworks(controller = null) {
    return this.fetchApi("scan_networks", controller, { method: 'POST' });
  }

  async connect(data, controller = null) {
    return this.fetchApi("connect", controller, { method: 'POST', body: data });
  }

  async systemCommand(data, controller = null) {
    return this.fetchApi("system", controller, { method: 'POST', body: data });
  }

  async toggleOn(data, controller = null) {
    return this.fetchApi("on", controller, { method: 'POST', body: data });
  }

  async toggleOff(data, controller = null) {
    return this.fetchApi("off", controller, { method: 'POST', body: data });
  }

  async getAllData(controller = null) {
    return this.fetchApi("data", controller);
  }

  async getInfo(controller = null) {
    return this.fetchApi("info", controller);
  }

  async getData(controller = null) {
    return this.fetchApi("data", controller);
  }

  // POST methods - only for existing endpoints
  async postAppData(data, controller = null) {
    return this.fetchApi("data", controller, {
      method: 'POST',
      body: data
    });
  }

  async postChannelData(data, controller = null) {
    // No channels endpoint, return error
    return { jsonData: null, error: { message: "No channels endpoint available" }, status: null };
  }

  async postColorData(data, controller = null) {
    return this.fetchApi("color", controller, {
      method: 'POST',
      body: data
    });
  }

  async postNetworkData(data, controller = null) {
    // No POST to networks, might be part of config or connect
    return { jsonData: null, error: { message: "Use connect endpoint for network operations" }, status: null };
  }

  async postWifiData(data, controller = null) {
    // Use connect endpoint for WiFi operations
    return this.fetchApi("connect", controller, {
      method: 'POST',
      body: data
    });
  }

  async postSystemData(data, controller = null) {
    return this.fetchApi("system", controller, {
      method: 'POST',
      body: data
    });
  }

  async postConfig(data, controller = null) {
    return this.fetchApi("config", controller, {
      method: 'POST',
      body: data
    });
  }

  // Legacy method support
  async getDataFromController(ipAddress, options = {}) {
    const controller = { ip_address: ipAddress };
    const { timeout, ...requestOptions } = options;
    return this.fetchApi("data", controller, requestOptions, 0, timeout || requestTimeout);
  }

  async getHosts(showAll = false) {
    return this.fetchApi(`hosts?all=${showAll}`);
  }

  async updateDataOnController(ipAddress, data, options = {}) {
    const controller = { ip_address: ipAddress };
    return this.fetchApi("data", controller, {
      method: 'POST',
      body: data,
      ...options
    });
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
  postConfig
} = apiService;