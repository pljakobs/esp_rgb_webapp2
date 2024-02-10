import { defineStore } from "pinia";
import { storeStatus } from "./storeConstants";
import { safeStringify, fetchApi } from "./storeHelpers";
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
    change_by: "load",
  }),
  actions: {
    async fetchData(retryCount = 0) {
      const controllers = controllersStore();
      const ws = useWebSocket();

      fetchApi("color").then(({ jsonData, error }) => {
        if (error) {
          console.error("error fetching color data:", error);
          this.status = storeStatus.ERROR;
        } else {
          console.log("color data fetched: ", JSON.stringify(jsonData));
          this.data = jsonData;
          this.status = storeStatus.READY;
        }
      });
      //
      // Subscribe to color events
      //
      ws.onJson("color_event", (params) => {
        const colorData = colorDataStore();
        colorData.change_by = "websocket";
        console.log("params mode: ", params.mode);
        console.log("existing color data: ", JSON.stringify(colorData));
        if (params.mode === "hsv") {
          console.log("updating hsv color data", JSON.stringify(params.hsv));
          console.log(
            "old hsv color          ",
            JSON.stringify(colorData.data.hsv)
          );
          //console.log("colorDataStore.data.hsv: ", JSON.stringify(colorData));
          //console.log("params.hsv: ", params.hsv);
          colorData.data.hsv = params.hsv;
          console.log(
            "new hsv color          ",
            JSON.stringify(colorData.data.hsv)
          );
        } else if (params.mode === "raw") {
          console.log("updating raw color data", params.raw);
          colorData.data.raw = params.raw;
        }

        console.log(
          "color store updated by websocket message to ",
          JSON.stringify(colorData)
        );
        colorData.change_by = null;
      });
    },
    updateData(field, value) {
      console.log("updatData called, change by: ", this.change_by);
      if (this.change_by != "websocket" && this.change_by != "load") {
        const controllers = controllersStore();

        console.log("color update for field: ", field, "value: ", value);
        //console.log("old colorData: ", JSON.stringify(this));
        console.log("old colorData(s): ", safeStringify(this));
        if (field === "hsv") {
          console.log(
            "store updateData for hsv, old store: ",
            JSON.stringify(this)
          );
          this.data.hsv = value;
          console.log(
            "store updateData for hsv, new store: ",
            JSON.stringify(this)
          );
        } else if (field === "raw") {
          console.log("key: ", key, " value: ", val);
          const [[key, val]] = Object.entries(value);
          this.data.raw[key] = val;
        }
        console.log(
          "store updateData for hsv, before creating payload: ",
          JSON.stringify(this)
        );
        /* somewhere here is the error that causes the color store to get messed up
        *****************************************************************************+
        const path = field.split(".");
        let current = this;

        for (let i = 0; i < path.length - 1; i++) {
          current = current[path[i]];
        }

        current[path[path.length - 1]] = value;
        */
        let payload = {};
        payload[field] = value;
        console.log("color update payload: ", JSON.stringify(payload));
        console.log(
          "sending update to controller: ",
          controllers.currentController["ip_address"]
        );
        console.log(
          "store updateData for hsv, before api call: ",
          JSON.stringify(this)
        );
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
          .then((data) => {})
          .catch((error) => {
            console.error(
              "There was a problem with the fetch operation:",
              error
            );
          });
        console.log("color update request sent");
        console.log(
          "store updateData for hsv, after api call: ",
          JSON.stringify(this)
        );
      }
    },
  },
});
