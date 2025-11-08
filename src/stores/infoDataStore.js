import { defineStore } from "pinia";
import { storeStatus } from "src/stores/storeConstants";
import { apiService } from "src/services/api.js";

export const infoDataStore = defineStore("infoDataStore", {
  state: () => ({
    data: null,
    status: storeStatus.LOADING,
    http_response_status: null,
  }),
  actions: {
    async fetchData() {
      this.status = storeStatus.LOADING;
      try {
        const { jsonData, error } = await apiService.getInfo();
        if (error) {
          throw error;
        }
        console.log("info data fetched: ", JSON.stringify(jsonData));
        this.data = jsonData;
        this.status = storeStatus.READY;
        return jsonData;
      } catch (err) {
        this.status = storeStatus.ERROR;
        console.error("error fetching info data:", err);
        throw err;
      }
    },
  },
});
