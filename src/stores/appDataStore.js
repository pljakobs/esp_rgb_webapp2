import { defineStore } from "pinia";
import { fetchApi } from "src/stores/storeHelpers";
import { controllersStore } from "src/stores/controllersStore";
import { storeStatus } from "src/stores/storeConstants";

export const useAppDataStore = defineStore("appData", {
  state: () => ({
    data: {
      lastColor: {},
      presets: [],
      scenes: [],
    },
    status: storeStatus.IDLE,
  }),

  actions: {
    async fetchData() {
      try {
        const { jsonData, error } = await fetchApi("presets");
        if (error) {
          console.error("error fetching presets data:", error);
          this.status = storeStatus.ERROR;
        } else {
          console.log("preset data fetched: ", JSON.stringify(jsonData));
          this.data = jsonData;
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

    /*************************************************************
     *
     * preset functions
     *
     **************************************************************/

    async addPreset(preset) {
      const controllers = controllersStore();
      let payload = { "presets[]": [preset] };
      console.log("addPreset payload: ", JSON.stringify(payload));
      try {
        console.log(
          "preset uri: ",
          `http://${controllers.currentController["ip_address"]}/data`,
        );
        console.log("preset payload: ", JSON.stringify(payload));
        const response = await fetch(
          `http://${controllers.currentController["ip_address"]}/data`,
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
    async toggleFavorite(preset) {
      const controllers = controllersStore();
      preset.favorite = !preset.favorite;
      let payload = {
        [`presets[name=${preset.name}]`]: { favorite: preset.favorite },
      };
      console.log("toggleFavorite payload: ", JSON.stringify(payload));
      try {
        console.log(
          "preset uri: ",
          `http://${controllers.currentController["ip_address"]}/data`,
        );
        console.log("preset payload: ", JSON.stringify(payload));
        const response = await fetch(
          `http://${controllers.currentController["ip_address"]}/data`,
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
      let payload = { [`presets[name=${preset.name}]`]: [] };
      console.log("deletePreset payload: ", JSON.stringify(payload));
      try {
        console.log(
          "preset uri: ",
          `http://${controllers.currentController["ip_address"]}/data`,
        );
        console.log("preset payload: ", JSON.stringify(payload));
        const response = await fetch(
          `http://${controllers.currentController["ip_address"]}/data`,
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
        this.data.presets = this.data.presets.filter(
          (p) => p.name !== preset.name,
        );
        console.log("deleted preset", preset.name);
      } catch (error) {
        console.error("error deleting preset:", error);
      }
    },

    /*************************************************************
     *
     * scene functions
     *
     **************************************************************/

    async addScene(scene) {
      const controllers = controllersStore();
      let payload = { "scenes[]": [scene] };
      console.log("addScene payload: ", JSON.stringify(payload));
      try {
        console.log(
          "scene uri: ",
          `http://${controllers.currentController["ip_address"]}/data`,
        );
        console.log("scene payload: ", JSON.stringify(payload));
        const response = await fetch(
          `http://${controllers.currentController["ip_address"]}/data`,
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

    async updateScene(name, partialScene) {
      const controllers = controllersStore();
      let payload = { [`scenes[name=${name}]`]: partialScene };
      console.log("updateScene payload: ", JSON.stringify(payload));
      try {
        console.log(
          "scene uri: ",
          `http://${controllers.currentController["ip_address"]}/data`,
        );
        console.log("scene payload: ", JSON.stringify(payload));
        const response = await fetch(
          `http://${controllers.currentController["ip_address"]}/data`,
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
          `http://${controllers.currentController["ip_address"]}/data`,
        );
        console.log("scene payload: ", JSON.stringify(payload));
        const response = await fetch(
          `http://${controllers.currentController["ip_address"]}/data`,
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
