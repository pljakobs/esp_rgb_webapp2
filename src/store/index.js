import { defineStore } from "pinia";

// Define controllerIpAddress as a constant
const controllerIpAddress = "192.168.29.38";

export const configDataStore = defineStore("configData", {
  state: () => ({
    data: {},
    isLoading: false,
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
    updateConfigData(field, value) {
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
