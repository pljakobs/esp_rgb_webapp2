import { defineStore } from "pinia";
import { watch } from "vue";

// Define controllerIpAddress as a constant
const controllerIpAddress = "192.168.29.38";
//const controllerIpAddress = "led-ku.fritz.box";
const storeStatus = {
  LOADING: "loading",
  READY: "ready",
  ERROR: "error",
};

export const presetDataStore = defineStore({
  id: "presetDataStore",

  state: () => ({
    data: null,
    status: storeStatus.LOADING,
  }),
  actions: {
    async fetchData() {
      try {
        console.log("preset start fetching data");
        const response = await fetch(
          `http://${controllerIpAddress}/presets.json`, // correct string interpolation
        );
        const jsonData = await response.json();
        this.data = jsonData;
        this.status = storeStatus.READY;
        console.log("preset data fetched: ", jsonData);
      } catch (error) {
        this.status = storeStatus.ERROR;
        this.error = error;
        console.error("Error fetching preset data:", error);
      }
    },
  },
});

/**
 * Groups Store
 *
 * one goal for this release is for the app to have a notion of controller groups that can be used to control multiple lights at once
 *
 * for now, this is implemented as a simple stored file on the controller that can be accessed by <controllerIpAddress>/groups.json and
 * written to using the /storage api call that expects a json object with filename: at the top level, followed by data: and the object
 * to write to flash
 */
export const groupsDataStore = defineStore({
  id: "groupsDataStore",
  state: () => ({
    data: null,
    status: storeStatus.LOADING,
  }),
  actions: {
    async fetchData() {
      try {
        console.log("preset start fetching data");
        const response = await fetch(
          `http://${controllerIpAddress}/groups.json`, // correct string interpolation
        );
        const jsonData = await response.json();
        this.data = jsonData;
        this.status = storeStatus.READY;
        console.log("groups data fetched: ", jsonData);
      } catch (error) {
        this.status = storeStatus.ERROR;
        this.error = error;
        console.error("Error fetching groups data:", error);
      }
    },
  },
});

export const infoDataStore = defineStore({
  id: "infoDataStore",
  state: () => ({
    data: null,
    status: storeStatus.LOADING,
  }),
  actions: {
    async fetchData() {
      try {
        console.log("info start fetching data");
        const response = await fetch(
          `http://${controllerIpAddress}/info`, // correct string interpolation
        );
        const jsonData = await response.json();
        this.data = jsonData;
        this.status = storeStatus.READY;
        console.log(
          "infoData status: ",
          this.status,
          "\ninfoData fetched: ",
          this.data,
        );
      } catch (error) {
        this.status = storeStatus.ERROR;
        this.error = error;
        console.error("Error fetching info data:", error);
      }
    },
  },
});

export const colorDataStore = defineStore({
  id: "colorDataStore",
  state: () => ({
    data: null,
    status: storeStatus.LOADING,
    change_by: "load",
    raw: { r: 0, g: 0, b: 0, cw: 0, ww: 0 },
    hsv: { h: 0, s: 0, v: 0, ct: 0 },
  }),
  actions: {
    async fetchData() {
      try {
        console.log("color start fetching data");
        const response = await fetch(`http://${controllerIpAddress}/color`);
        const jsonData = await response.json();
        this.data = jsonData;
        this.status = storeStatus.READY;
        console.log("color data fetched: ", jsonData);
      } catch (error) {
        this.status = storeStatus.ERROR;
        this.error = error;
        console.error("Error fetching color data:", error);
      }
    },
    setupWebSocket(webSocketState) {
      watch(webSocketState.data, (newData) => {
        if (newData.method === "color_event") {
          if (newData.params.mode === "hsv") {
            this.data.hsv = newData.params.hsv;
          } else if (newData.params.mode === "raw") {
            this.data.hsv = newData.params.hsv;
          }
          this.change_by = "websocket";
          console.log(
            "color store updated by websocket message",
            JSON.stringify(this.data),
          );
        } else if (newData.method === "keep_alive") {
          //keepalive message
          console.log("keepalive message received");
        }
      });
    },
    updateData(field, value) {
      if (this.change_by != "websocket" && this.change_by != "load") {
        console.log("color update for field: ", field, "value: ", value);

        const path = field.split(".");
        let current = this;

        for (let i = 0; i < path.length - 1; i++) {
          current = current[path[i]];
        }

        current[path[path.length - 1]] = value;
        let payload = {};
        payload[field] = value;
        console.log("color update payload: ", JSON.stringify(payload));
        fetch(`http://${controllerIpAddress}/color`, {
          // Use controllerIpAddress here
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        })
          .then((response) => {
            if (!response.ok) {
              throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
          })
          .then((data) => {})
          .catch((error) => {
            console.error(
              "There was a problem with the fetch operation:",
              error,
            );
          });
      }
    },
  },
});

export const configDataStore = defineStore({
  id: "configDataStore",
  state: () => ({
    status: storeStatus.LOADING,
  }),
  actions: {
    async fetchData() {
      try {
        console.log("config start fetching data");
        const response = await fetch(`http://${controllerIpAddress}/config`); // Use controllerIpAddress here
        const jsonData = await response.json();
        this.data = jsonData;
        this.status = storeStatus.READY;
        console.log("config data fetched: ", jsonData);
      } catch (error) {
        this.status = storeStatus.ERROR;
        this.error = error;
        console.error("Error fetching config data:", error);
      }
    },
    updateData(field, value) {
      console.log(
        "updateConfigData called for field: ",
        field,
        "value: ",
        value,
      );
      // Make a PUT request to the API endpoint
      fetch(`http://${controllerIpAddress}/config`, {
        // Use controllerIpAddress here
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(this.data),
      })
        .then((response) => {
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          return response.json();
        })
        .then((data) => {})
        .catch((error) => {
          console.error("There was a problem with the fetch operation:", error);
        });
    },
  },
});
export { storeStatus, controllerIpAddress };
