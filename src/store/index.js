import { defineStore } from "pinia";

// Define controllerIpAddress as a constant
const controllerIpAddress = "192.168.29.38";

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
    updateData(field, value) {
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

export const configDataStore = defineStore({
  id: "configDataStore",
  state: () => ({
    status: storeStatus.LOADING,
  }),
  actions: {
    async fetchData() {
      this.isLoading = true;
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
export { storeStatus };
