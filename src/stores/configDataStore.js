import { defineStore } from "pinia";
import { storeStatus } from "src/stores/storeConstants";
import { controllersStore } from "src/stores/controllersStore";
import { fetchApi } from "src/stores/storeHelpers";
import { safeStringify } from "src/stores/storeHelpers";

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
          console.error("error fetching config data:", error);
          this.status = storeStatus.ERROR;
        } else {
          console.log("config data fetched: ", JSON.stringify(jsonData));
          this.data = jsonData;
          // add the pinConfigUrl - that will be provided by the api from the controller later
          this.status = storeStatus.READY;
          console.log("new configData(this): ", this);
        }
      });
    },
    updateData(field, value, update = true) {
      console.log(
        "updateConfigData called for field: ",
        field,
        "value: ",
        value,
      );
      console.log("updating config data: ", this.data);
      const controllers = controllersStore();

      const fieldParts = field.split(".");
      let currentObject = this.data;
      for (let i = 0; i < fieldParts.length - 1; i++) {
        currentObject = currentObject[fieldParts[i]];
      }

      currentObject[fieldParts[fieldParts.length - 1]] = value;
      if (update) {
        this.updateApi();
      }
    },
    updateApi() {
      const controllers = controllersStore();
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
