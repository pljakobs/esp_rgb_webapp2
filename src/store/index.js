import { defineStore } from "pinia";
import { computed } from "vue";

// Define controllerIpAddress as a constant
const controllerIpAddress = "192.168.29.38";

// Helper function to get a nested property by a dot-separated path
function getNestedProperty(obj, path) {
  const keys = path.split(".");
  let current = obj;

  for (let i = 0; i < keys.length; i++) {
    if (!current) {
      return undefined;
    }
    console.log("current: ", current, "keys[i]=" + keys[i]);
    current = current[keys[i]];
  }

  return current;
}

export function createComputedProperties(store, fields) {
  const computedProperties = {};
  let current = computedProperties;

  fields.forEach((field) => {
    const keys = field.split(".");
    const lastKey = keys.pop();

    keys.forEach((key) => {
      current[key] = current[key] || {};
      current = current[key];
    });

    current[lastKey] = computed({
      get: () => getNestedProperty(store.state.data, field),
      set: (value) => store.updateData(field, value),
    });

    current = computedProperties;
  });

  return computedProperties;
}

import { defineComponent } from "vue";

export const colorStore = defineStore({
  id: "color",
  state: () => ({
    data: null,
    hsv: { h: 0, s: 0, v: 0, ct: 0 },
  }),
  actions: {
    async fetchData() {
      try {
        const response = await fetch(`http://${controllerIpAddress}/color`);
        const jsonData = await response.json();
        this.data = jsonData;
        console.log("data fetched: ", jsonData);
      } catch (error) {
        console.error("Error fetching color data:", error);
      }
    },
    updateData(field, value) {
      console.log("color update for field: ", field, "value: ", value);
      this.hsv = { ...this.hsv, [field]: value };
    },
  },
});

export const configDataStore = defineStore({
  id: "configData",
  state: () => ({
    isLoading: true,
  }),
  actions: {
    async fetchData() {
      this.isLoading = true;
      try {
        console.log("start fetching data");
        const response = await fetch(`http://${controllerIpAddress}/config`); // Use controllerIpAddress here
        const jsonData = await response.json();
        this.data = jsonData;
        console.log("data fetched: ", jsonData);
      } catch (error) {
        console.error("Error fetching config data:", error);
      } finally {
        this.isLoading = false;
      }
    },
    updateData(field, value) {
      console.log(
        "updateConfigData called for field: ",
        field,
        "value: ",
        value,
      );
      const path = field.split(".");
      let current = this.data;

      for (let i = 0; i < path.length - 1; i++) {
        current = current[path[i]];
      }

      current[path[path.length - 1]] = value;

      // Construct the payload to only include the updated property
      let payload = {};
      let payloadCurrent = payload;

      for (let i = 0; i < path.length - 1; i++) {
        payloadCurrent[path[i]] = {};
        payloadCurrent = payloadCurrent[path[i]];
      }

      payloadCurrent[path[path.length - 1]] = value;
      console.log("calling api with payload: ", JSON.stringify(payload));
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
