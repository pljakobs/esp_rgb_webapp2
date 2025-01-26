import { defineStore } from "pinia";
import { storeStatus } from "./storeConstants";
import { controllersStore } from "src/stores/controllersStore";
import { fetchApi } from "src/stores/storeHelpers";

export const presetDataStore = defineStore({
  id: "presetDataStore",

  state: () => ({
    data: {
      lastColor: {},
      presets: [],
      scenes: [],
    },
    status: storeStatus.LOADING,
    http_response_status: null,
  }),

  actions: {
    async fetchData() {
      try {
        const { jsonData, error } = await fetchApi("presets");
        if (error) {
          console.error("error fetching presets data:", error);
          this.status = storeStatus.ERROR;
        } else {
          console.log("presets data fetched: ", JSON.stringify(jsonData));
          this.data.lastColor = jsonData["last-color"];
          this.data.presets = jsonData.presets;
          this.data.scenes = jsonData.scenes;
          this.status = storeStatus.READY;

          console.log("lastColor data: ", JSON.stringify(this.data.lastColor));
          console.log("presets data: ", JSON.stringify(this.data.presets));
          console.log("scenes data: ", JSON.stringify(this.data.scenes));
        }
      } catch (error) {
        console.error("error fetching presets data:", error);
        this.status = storeStatus.ERROR;
      }
    },
    async addPreset(preset) {
      const controllers = controllersStore();
      let payload = { "presets[]": [preset] };
      console.log("addPreset payload: ", JSON.stringify(payload));
      try {
        console.log(
          "preset uri: ",
          `http://${controllers.currentController["ip_address"]}/presets`,
        );
        console.log("preset payload: ", JSON.stringify(payload));
        const response = await fetch(
          `http://${controllers.currentController["ip_address"]}/presets`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
          },
        );
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        this.data.presets.push(preset);
        console.log("added preset", preset.name, "with id", preset.id);
      } catch (error) {
        console.error("error adding preset:", error);
      }
    },
    async addScene(scene) {
      const controllers = controllersStore();
      let payload = { "scenes[]": [scene] };
      console.log("addScene payload: ", JSON.stringify(payload));
      try {
        console.log(
          "scene uri: ",
          `http://${controllers.currentController["ip_address"]}/presets`,
        );
        console.log("scene payload: ", JSON.stringify(payload));
        const response = await fetch(
          `http://${controllers.currentController["ip_address"]}/presets`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
          },
        );
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        this.data.scenes.push(scene);
        console.log("added scene", scene.name, "with id", scene.id);
      } catch (error) {
        console.error("error adding scene:", error);
      }
    },
    async toggleFavorite(preset) {
      const controllers = controllersStore();
      preset.favorite = !preset.favorite;
      let payload = { "presets[]": [preset] };
      console.log("toggleFavorite payload: ", JSON.stringify(payload));
      try {
        console.log(
          "preset uri: ",
          `http://${controllers.currentController["ip_address"]}/presets`,
        );
        console.log("preset payload: ", JSON.stringify(payload));
        const response = await fetch(
          `http://${controllers.currentController["ip_address"]}/presets`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
          },
        );
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        console.log("toggled favorite for preset", preset.name);
      } catch (error) {
        console.error("error toggling favorite:", error);
      }
    },
    async deletePreset(preset) {
      const controllers = controllersStore();
      let payload = { "presets[]": [preset] };
      console.log("deletePreset payload: ", JSON.stringify(payload));
      try {
        console.log(
          "preset uri: ",
          `http://${controllers.currentController["ip_address"]}/presets`,
        );
        console.log("preset payload: ", JSON.stringify(payload));
        const response = await fetch(
          `http://${controllers.currentController["ip_address"]}/presets`,
          {
            method: "DELETE",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
          },
        );
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        this.data.presets = this.data.presets.filter((p) => p.id !== preset.id);
        console.log("deleted preset", preset.name);
      } catch (error) {
        console.error("error deleting preset:", error);
      }
    },
  },
});
