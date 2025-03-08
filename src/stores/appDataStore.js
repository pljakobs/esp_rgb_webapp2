import { defineStore } from "pinia";
import { fetchApi } from "src/stores/storeHelpers";
import { useControllersStore } from "src/stores/controllersStore";
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
        const { jsonData, error } = await fetchApi("data");
        if (error) {
          console.error("error fetching app-data:", error);
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
        console.error("error fetching app-data:", error);
        this.status = storeStatus.ERROR;
      }
    },

    /*************************************************************
     *
     * preset functions
     *
     **************************************************************/

    async addPreset(preset) {
      const controllers = useControllersStore();
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
      const controllers = useControllersStore();
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
      const controllers = useControllersStore();
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
     * group functions
     *
     **************************************************************/

    async addGroup(group) {
      const controllers = useControllersStore();
      let payload = { "groups[]": [group] };
      console.log("addGroup payload: ", JSON.stringify(payload));
      try {
        console.log(
          "group uri: ",
          `http://${controllers.currentController["ip_address"]}/data`,
        );
        console.log("group payload: ", JSON.stringify(payload));
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
        this.data.groups.push(group);
        console.log("added group", group.name, "with id", group.id);
      } catch (error) {
        console.error("error adding group:", error);
      }
    },
    async updateGroup(name, partialGroup) {
      const controllers = useControllersStore();
      let payload = { [`groups[name=${name}]`]: partialGroup };
      console.log("updateGroup payload: ", JSON.stringify(payload));
      try {
        console.log(
          "group uri: ",
          `http://${controllers.currentController["ip_address"]}/data`,
        );
        console.log("group payload: ", JSON.stringify(payload));
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
        const groupIndex = this.data.groups.findIndex((s) => s.name === name);
        if (groupIndex !== -1) {
          this.data.groups[groupIndex] = {
            ...this.data.groups[groupIndex],
            ...partialGroup,
          };
          console.log("updated group", name);
        }
      } catch (error) {
        console.error("error updating group:", error);
      }
    },
    async deleteGroup(group) {
      const controllers = useControllersStore();
      console.log("appDataStore deleteGroup group: ", group);

      let payload = { [`groups[group_id=${group.group_id}]`]: [] };
      console.log("deleteGroup payload: ", JSON.stringify(payload));
      try {
        console.log(
          "group uri: ",
          `http://${controllers.currentController["ip_address"]}/data`,
        );
        console.log("group payload: ", JSON.stringify(payload));
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
        this.data.groups = this.data.groups.filter(
          (s) => s.group_id !== group.group_id,
        );
        console.log("deleted group", group.name);
      } catch (error) {
        console.error("error deleting scene:", error);
      }
    },

    /*************************************************************
     *
     * scene functions
     *
     **************************************************************/

    async addScene(scene) {
      const controllers = useControllersStore();
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
      const controllers = useControllersStore();
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
      const controllers = useControllersStore();
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
