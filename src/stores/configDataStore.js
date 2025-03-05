import { defineStore } from "pinia";
import { storeStatus } from "src/stores/storeConstants";
import { useControllersStore } from "src/stores/controllersStore";
import { fetchApi, safeStringify } from "src/stores/storeHelpers";

export const configDataStore = defineStore("configDataStore", {
  state: () => ({
    status: storeStatus.LOADING,
    http_response_status: null,
    data: {
      color: {
        color_mode: 0,
        // other properties...
      },
      // other properties...
    },
  }),
  actions: {
    async fetchData() {
      fetchApi("config").then(({ jsonData, error }) => {
        if (error) {
          console.error("error fetching config data:", error);
          this.status = storeStatus.ERROR;
        } else {
          console.log("config data fetched: ", JSON.stringify(jsonData));
          this.data = jsonData;
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

      const fieldParts = field.split(".");
      let currentObject = this.data;
      for (let i = 0; i < fieldParts.length - 1; i++) {
        currentObject = currentObject[fieldParts[i]];
      }

      currentObject[fieldParts[fieldParts.length - 1]] = value;

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

      console.log("minimalUpdate: ", safeStringify(minimalUpdate));
      if (update) {
        this.updateApi(minimalUpdate);
      }
    },
    updateApi(minimalUpdate) {
      console.log("updateApi called with: ", safeStringify(minimalUpdate));
      const controllers = useControllersStore();
      fetch(`http://${controllers.currentController["ip_address"]}/config`, {
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
        .then(() => {})
        .catch((error) => {
          console.error("There was a problem with the fetch operation:", error);
        });
    },
  },
});
