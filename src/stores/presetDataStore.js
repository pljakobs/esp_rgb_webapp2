// filepath: /home/pjakobs/devel/esp_rgb_webapp2/src/stores/presetDataStore.js
import { defineStore } from "pinia";
import { fetchApi } from "src/stores/storeHelpers";
import { controllersStore } from "src/stores/controllersStore";
import { storeStatus } from "src/stores/storeConstants";

export const presetDataStore = defineStore("presetData", {
  state: () => ({
    data: {
      lastColor: null,
      presets: [],
    },
    status: storeStatus.IDLE,
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
        this.data["presets"].push(preset);
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
    async updatePreset(name, partialPreset) {
      const controllers = controllersStore();
      let payload = { [`presets[name=${name}]`]: partialPreset };
      console.log("updatePreset payload: ", JSON.stringify(payload));
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
        const presetIndex = this.data.presets.findIndex((p) => p.name === name);
        if (presetIndex !== -1) {
          this.data.presets[presetIndex] = {
            ...this.data.presets[presetIndex],
            ...partialPreset,
          };
          console.log("updated preset", name);
        }
      } catch (error) {
        console.error("error updating preset:", error);
      }
    },
    async deletePreset(name) {
      const controllers = controllersStore();
      let payload = { [`presets[name=${name}]`]: [] };
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
        this.data.presets = this.data.presets.filter((p) => p.name !== name);
        console.log("deleted preset", name);
      } catch (error) {
        console.error("error deleting preset:", error);
      }
    },
    async updateScene(name, partialScene) {
      const controllers = controllersStore();
      let payload = { [`scenes[name=${name}]`]: partialScene };
      console.log("updateScene payload: ", JSON.stringify(payload));
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
        const sceneIndex = this.data.scenes.findIndex((s) => s.name === name);
        if (sceneIndex !== -1) {
          this.data.scenes[sceneIndex] = {
            ...this.data.scenes[sceneIndex],
            ...partialScene,
          };
          console.log("updated scene", name);
        }
      } catch (error) {
        console.error("error updating scene:", error);
      }
    },
    async deleteScene(name) {
      const controllers = controllersStore();
      let payload = { [`scenes[name=${name}]`]: [] };
      console.log("deleteScene payload: ", JSON.stringify(payload));
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
        this.data.scenes = this.data.scenes.filter((s) => s.name !== name);
        console.log("deleted scene", name);
      } catch (error) {
        console.error("error deleting scene:", error);
      }
    },
  },
});
