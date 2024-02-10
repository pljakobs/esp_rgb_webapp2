import { defineStore } from "pinia";
import {
  localhost,
  storeStatus,
  maxRetries,
  retryDelay,
} from "./storeConstants";
import { safeStringify, fetchApi } from "./storeHelpers";
import { controllersStore } from "./controllersStore";

export const infoDataStore = defineStore({
  id: "infoDataStore",
  state: () => ({
    data: null,
    status: storeStatus.LOADING,
  }),
  actions: {
    async fetchData(retryCount = 0) {
      const controllers = controllersStore();

      fetchApi("info").then(({ jsonData, error }) => {
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
  },
});
