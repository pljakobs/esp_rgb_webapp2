import { defineStore } from "pinia";
import { storeStatus } from "src/stores/storeConstants";
import { apiService } from "src/services/api.js";

export const infoDataStore = defineStore("infoDataStore", {
  state: () => ({
    data: null,
    status: storeStatus.LOADING,
    error: null,
    http_response_status: null,
  }),
  actions: {
    async fetchData() {
      this.status = storeStatus.LOADING;
      this.error = null; // Clear previous errors
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
        this.error = err.message || "Failed to fetch info data";
        this.status = storeStatus.ERROR;
        console.error("error fetching info data:", err);
        throw err;
      }
    },
  },
});
