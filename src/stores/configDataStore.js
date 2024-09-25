import { defineStore } from "pinia";
//import Ajv from "ajv";
//import { configDataSchema } from "src/stores/app-data-cfbdb.json";
import { storeStatus } from "src/stores/storeConstants";
import { controllersStore } from "src/stores/controllersStore";
import { fetchApi } from "src/stores/storeHelpers";
import { safeStringify } from "src/stores/storeHelpers";
import ColorSlider from "src/components/ColorSlider.vue";

// Initialize AJV and compile the schema
//const ajv = new Ajv();
//const validate = ajv.compile(configDataSchema);

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

      const minimalUpdate = {};
      let tempObject = minimalUpdate;
      currentObject = this.data;

      for (let i = 0; i < fieldParts.length - 1; i++) {
        const key = fieldParts[i];
        tempObject[key] = Array.isArray(currentObject[key]) ? [] : {};
        tempObject = tempObject[key];
        currentObject = currentObject[key];
      }

      tempObject[fieldParts[fieldParts.length - 1]] = value;

      // Validate the updated state
      //    if (!validate(this.$state)) {
      //      console.error("Invalid state update:", validate.errors);
      //      return;
      //    }

      console.log("minimalUpdate: ", safeStringify(minimalUpdate));
      if (update) {
        this.updateApi(minimalUpdate);
      }
    },
    updateApi(minimalUpdate) {
      console.log("updateApi called with: ", safeStringify(minimalUpdate));
      const controllers = controllersStore();
      fetch(`http://${controllers.currentController["ip_address"]}/config`, {
        // Use controllers.currentController here
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(minimalUpdate),
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
