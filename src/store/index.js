import { defineStore } from "pinia";
import { watch } from "vue";
import useWebSocket from "src/services/websocket.js";

const localhost = {
  hostname: "localhost",
  ip_address:
    process.env.NODE_ENV === "development"
      ? "192.168.29.69"
      : window.location.hostname,
};
const storeStatus = {
  LOADING: "loading",
  READY: "ready",
  ERROR: "error",
};

export const controllersStore = defineStore({
  id: "controllersStore",

  state: () => ({
    status: storeStatus.LOADING,
    currentController: localhost,

    data: [localhost],
  }),
  actions: {
    async fetchData() {
      try {
        //console.log("controllers start fetching data");
        const response = await fetch(`http://${localhost["ip_address"]}/hosts`);
        const jsonData = await response.json();
        this.data = jsonData["hosts"];
        this.data = jsonData["hosts"].map((host) => {
          return {
            ...host,
            ip_address: host.ip_address.trim(),
          };
        }); //removing leading and trailing whitespaces from the ip address
        this.status = storeStatus.READY;
        //console.log("hosts data fetched: ", jsonData);
      } catch (error) {
        this.status = storeStatus.ERROR;
        this.error = error;
        console.error("Error fetching preset data:", error);
      }
    },
    selectController(controller) {
      this.currentController = controller;
      console.log(
        "selected controller: ",
        currentController["hostname"],
        "with ip address ",
        currentController["ip_address"],
      );
    },
  },
});

export const presetDataStore = defineStore({
  id: "presetDataStore",

  state: () => ({
    data: null,
    status: storeStatus.LOADING,
  }),
  actions: {
    async fetchData() {
      const controllers = controllersStore(); // Add this line
      try {
        console.log("preset start fetching data");
        const response = await fetch(
          `http://${controllers.currentController["ip_address"]}/presets.json`,
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
    async addPreset(preset) {
      const controllers = controllersStore(); // Add this line
      this.data["presets"].push(preset);
      let payload = { filename: "presets.json", data: this.data };
      console.log("addPreset payload: ", JSON.stringify(payload));
      try {
        const response = await fetch(
          `http://${controllers.currentController["ip_address"]}/storage`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
          },
        );
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        console.log("Preset added successfully");
      } catch (error) {
        console.error("Error adding preset:", error);
      }
    },
  },
});

/**
 * Groups Store
 *
 * one goal for this release is for the app to have a notion of controller groups that can be used to control multiple lights at once
 *
 * for now, this is implemented as a simple stored file on the controller that can be accessed by <controllers.currentController["ip_address"]>/groups.json and
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
      const controllers = controllersStore();

      try {
        console.log(
          "preset start fetching data from controller:",
          controllers.currentController["ip_address"],
        );
        const response = await fetch(
          `http://${controllers.currentController["ip_address"]}/groups.json`,
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
      const controllers = controllersStore();

      try {
        console.log("info start fetching data");
        const response = await fetch(
          `http://${controllers.currentController["ip_address"]}/info`, // correct string interpolation
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
    data: {
      raw: { r: 0, g: 0, b: 0, cw: 0, ww: 0 },
      hsv: { h: 0, s: 0, v: 0, ct: 0 },
    },
    status: storeStatus.LOADING,
    change_by: "load",
  }),
  actions: {
    async fetchData() {
      const controllers = controllersStore();
      const { onJson, isOpen } = useWebSocket();

      try {
        console.log("color start fetching data");
        const response = await fetch(
          `http://${controllers.currentController["ip_address"]}/color`,
        );
        const jsonData = await response.json();
        this.data = jsonData;
        this.status = storeStatus.READY;
        console.log("color data fetched: ", jsonData);

        watch(isOpen, (newIsOpen) => {
          if (newIsOpen) {
            onJson("color_event", (params) => {
              this.change_by = "websocket";
              console.log("params mode: ", params.mode);
              if (params.mode === "hsv") {
                console.log("updating hsv color data", params.hsv);

                this.data.hsv = params.hsv;
              } else if (params.mode === "raw") {
                console.log("updating raw color data", params.raw);
                this.data.raw = params.raw;
              }

              console.log(
                "color store updated by websocket message to ",
                JSON.stringify(this),
              );
              this.change_by = null;
            });
          }
        });
      } catch (error) {
        this.status = storeStatus.ERROR;
        this.error = error;
        console.error("Error fetching color data:", error);
      }
    },
    updateData(field, value) {
      console.log("updatData called, change by: ", this.change_by);
      if (this.change_by != "websocket" && this.change_by != "load") {
        const controllers = controllersStore();

        console.log("color update for field: ", field, "value: ", value);
        if (field === "hsv") {
          this.data.hsv = value;
        } else if (field === "raw") {
          const [[key, val]] = Object.entries(value);
          this.data.raw[key] = val;
        }

        const path = field.split(".");
        let current = this;

        for (let i = 0; i < path.length - 1; i++) {
          current = current[path[i]];
        }

        current[path[path.length - 1]] = value;
        let payload = {};
        payload[field] = value;
        console.log("color update payload: ", JSON.stringify(payload));
        console.log(
          "sending update to controller: ",
          controllers.currentController["ip_address"],
        );
        fetch(`http://${controllers.currentController["ip_address"]}/color`, {
          // Use controllers.currentController here
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
      const controllers = controllersStore();

      try {
        console.log("config start fetching data");
        const response = await fetch(
          `http://${controllers.currentController["ip_address"]}/config`,
        ); // Use controllers.currentController here
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
      fetch(`http://${controllers.currentController["ip_address"]}/config`, {
        // Use controllers.currentController here
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
export { storeStatus };
