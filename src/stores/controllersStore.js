import { defineStore } from "pinia";
import {
  maxRetries,
  retryDelay,
  localhost,
  storeStatus,
} from "./storeConstants";

export const controllersStore = defineStore({
  id: "controllersStore",

  state: () => ({
    status: storeStatus.LOADING,
    currentController: localhost,

    data: [localhost],
  }),
  actions: {
    async fetchData(retryCount = 0) {
      try {
        console.log("controllers start fetching data");
        const response = await fetch(`http://${localhost["ip_address"]}/hosts`);
        const jsonData = await response.json();
        this.data = jsonData["hosts"];
        console.log("controllers data fetched: ", jsonData["hosts"]);
        this.data = jsonData["hosts"]
          .filter((host) => host.ip_address)
          .map((host) => {
            return {
              ...host,
              ip_address: host.ip_address.trim(),
            };
          }); //removing leading and trailing whitespaces from the ip address
        this.status = storeStatus.READY;
        console.log("hosts data fetched: ", JSON.stringify(this.data));
      } catch (error) {
        this.status = storeStatus.ERROR;
        this.error = error;
        console.error("Error fetching preset data:", error);
      }
    },
    selectController(controller) {
      this.currentController = controller;
      console.log(
        "selected controller: ",
        currentController["hostname"],
        "with ip address ",
        currentController["ip_address"]
      );
    },
  },
});
