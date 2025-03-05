import { defineStore } from "pinia";
import { storeStatus } from "./storeConstants";
import { fetchApi } from "src/stores/storeHelpers";

export const infoDataStore = defineStore("infoDataStore", {
  state: () => ({
    data: null,
    status: storeStatus.LOADING,
    http_response_status: null,
  }),
  actions: {
    async fetchData() {
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
