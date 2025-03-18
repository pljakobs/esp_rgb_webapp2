import { defineStore } from "pinia";
import { storeStatus } from "./storeConstants";
import { fetchApi } from "./storeHelpers";
import { useControllersStore } from "./controllersStore";
import useWebSocket from "src/services/websocket.js";

export const useColorDataStore = defineStore("colorDataStore", {
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
          let value = {
            h: Math.round(params.hsv.h * 100) / 100,
            s: Math.round(params.hsv.s * 100) / 100,
            v: Math.round(params.hsv.v * 100) / 100,
          };
          console.log("rounded hsv color:     ", JSON.stringify(value));
          console.log("old hsv color          ", JSON.stringify(this.data.hsv));
          this.data.hsv = value;
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
        const controllers = useControllersStore();
        console.log(
          "updateData for field: ",
          field,
          "value: ",
          JSON.stringify(value),
        );
        try {
          if (field === "hsv") {
            console.log("processing hsv update");

            value = {
              h: Math.round(value.h * 100) / 100,
              s: Math.round(value.s * 100) / 100,
              v: Math.round(value.v * 100) / 100,
            };

            console.log("updateData sanitized hsv", JSON.stringify(value));

            this.data.hsv = value;

            console.log(
              "store updateData for hsv, new store: ",
              JSON.stringify(this.data),
            );
          } else if (field === "raw") {
            console.log("processing raw update");
            const [[key, val]] = Object.entries(value);
            console.log("key: ", key, " value: ", val);
            this.data.raw[key] = val;
          } else {
            console.error("Invalid field in updateData: ", field);
          }

          let payload = {};
          payload[field] = value;
          console.log("color update payload: ", JSON.stringify(payload));
          console.log(
            "sending update to controller: ",
            controllers.currentController["ip_address"],
          );
          console.log("store updateData for hsv, before api call: ", this);
          fetch(`http://${controllers.currentController["ip_address"]}/color`, {
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
            .then(() => {
              console.log("color update request sent");
            })
            .catch((error) => {
              console.error(
                "There was a problem with the fetch operation:",
                error,
              );
            });
          console.log(
            "store updateData for hsv, before creating payload: ",
            this.data,
          );

          console.log("store updateData for hsv, after api call: ", this);
        } catch (error) {
          console.error("Error in updateData method:", error);
        }
      }
    },
  },
});
