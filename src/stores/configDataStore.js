import { defineStore } from "pinia";
import { storeStatus } from "src/stores/storeConstants";
import { controllersStore } from "src/stores/controllersStore";
import { fetchApi } from "src/stores/storeHelpers";

export const configDataStore = defineStore({
  id: "configDataStore",
  state: () => ({
    status: storeStatus.LOADING,
  }),
  actions: {
    async fetchData(retryCount = 0) {
      const controllers = controllersStore();

      fetchApi("config").then(({ jsonData, error }) => {
        if (error) {
          console.error("error fetching info data:", error);
          this.status = storeStatus.ERROR;
        } else {
          console.log("info data fetched: ", JSON.stringify(jsonData));
          this.data = jsonData;
          this.status = storeStatus.READY;
        }
      });
    },
    updateData(field, value) {
      console.log(
        "updateConfigData called for field: ",
        field,
        "value: ",
        value
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
