import { defineStore } from "pinia";
import { localhost, storeStatus } from "./storeConstants";
import { fetchApi } from "./storeHelpers";

export const controllersStore = defineStore({
  id: "controllersStore",

  state: () => ({
    status: storeStatus.LOADING,
    currentController: localhost,
    http_response_status: null,
    data: [localhost],
  }),

  actions: {
    async fetchData(retryCount = 0) {
      try {
        console.log("controllers start fetching data");
        const { jsonData, error } = await fetchApi("hosts", retryCount);
        if (error) {
          throw error;
        }
        this.data = jsonData["hosts"]
          .filter((host) => host.ip_address)
          .map((host) => {
            return {
              ...host,
              ip_address: host.ip_address.trim(),
            };
          }); // Removing leading and trailing whitespaces from the IP address
        console.log("store: ", JSON.stringify(this.data));
        this.status = storeStatus.READY;
        console.log("controllers data fetched: ", JSON.stringify(this.data));
      } catch (error) {
        this.status = storeStatus.ERROR;
        this.error = error;
        console.error("Error fetching controllers data:", error);
      }
    },

    selectController(controller) {
      this.currentController = controller;
      console.log(
        "selected controller: ",
        controller["hostname"],
        "with IP address ",
        controller["ip_address"],
      );
    },
  },
});
