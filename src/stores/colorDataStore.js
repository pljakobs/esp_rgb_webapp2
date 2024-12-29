import { defineStore } from "pinia";
import { storeStatus } from "./storeConstants";
import { fetchApi } from "./storeHelpers";
import { controllersStore } from "./controllersStore";
import useWebSocket from "src/services/websocket.js";

export const colorDataStore = defineStore({
  id: "colorDataStore",
  state: () => ({
    data: {
      raw: { r: 0, g: 0, b: 0, cw: 0, ww: 0 },
      hsv: { h: 0, s: 0, v: 0, ct: 0 },
    },
    status: storeStatus.LOADING,
    http_response_status: null,
    change_by: "load",
  }),
  actions: {
    async fetchData() {
      const ws = useWebSocket();
      console.log("colorDataStore before fetch:", this);

      fetchApi("color").then(({ jsonData, error }) => {
        console.log(
          "colorDataStore fetchApi callback, error: ",
          error,
          "data: ",
          JSON.stringify(jsonData),
        );
        console.log("colorDataStore entering callback", this);

        if (error) {
          console.error("error fetching color data:", error);
          this.status = storeStatus.ERROR;
        } else {
          console.log("color data fetched: ", jsonData);
          this.data = jsonData;
          console.log("colorDataStore after fetch:", this);
          this.status = storeStatus.READY;
        }
        console.log("colorDataStore after fetch if clause:", this);
      });
      //
      // Subscribe to color events
      //

      ws.onJson("color_event", (params) => {
        this.change_by = "websocket";
        console.log("params mode: ", params.mode);
        console.log("existing color data: ", this);
        if (params.mode === "hsv") {
          console.log("updating hsv color data", JSON.stringify(params.hsv));
          console.log("old hsv color          ", JSON.stringify(this.data.hsv));
          this.data.hsv = params.hsv;
          console.log("new hsv color          ", JSON.stringify(this.data.hsv));
        } else if (params.mode === "raw") {
          console.log("updating raw color data", params.raw);
          this.data.raw = params.raw;
        }

        console.log("color store updated by websocket message to ", this);
        this.change_by = null;
      });
    },
    updateData(field, value) {
      console.log("updatData called, change by: ", this.change_by, field);
      if (this.change_by != "websocket" && this.change_by != "load") {
        const controllers = controllersStore();

        console.log("color update for field: ", field, "value: ", value);
        console.log("old colorData(this): ", this);
        if (field === "hsv") {
          this.data.hsv = value;
          console.log("store updateData for hsv, new store: ", this);
        } else if (field === "raw") {
          const [[key, val]] = Object.entries(value);
          console.log("key: ", key, " value: ", val);
          this.data.raw[key] = val;
        }
        console.log(
          "store updateData for hsv, before creating payload: ",
          this.data,
        );

        let payload = {};
        payload[field] = value;
        console.log("color update payload: ", JSON.stringify(payload));
        console.log(
          "sending update to controller: ",
          controllers.currentController["ip_address"],
        );
        console.log("store updateData for hsv, before api call: ", this);
        fetch(`http://${controllers.currentController["ip_address"]}/color`, {
          // Use controllers.currentController here
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        })
          .then((response) => {
            if (!response.ok) {
              throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
          })
          .then(() => {})
          .catch((error) => {
            console.error(
              "There was a problem with the fetch operation:",
              error,
            );
          });
        console.log("color update request sent");
        console.log("store updateData for hsv, after api call: ", this);
      }
    },
  },
});
