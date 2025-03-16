import { defineStore } from "pinia";
import { fetchApi } from "src/stores/storeHelpers";
import { useControllersStore } from "src/stores/controllersStore";
import { storeStatus } from "src/stores/storeConstants";
import { makeID } from "src/services/tools";

export const useAppDataStore = defineStore("appData", {
  state: () => ({
    data: {
      lastColor: {},
      presets: [],
      scenes: [],
      groups: [],
    },
    status: storeStatus.IDLE,
    abortSaveOperation: false,
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
          console.log("groups data: ", JSON.stringify(this.data.groups));
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

    async savePreset(preset, progressCallback) {
      const controllers = useControllersStore();
      this.abortSaveOperation = false;

      // Generate an ID if one doesn't exist
      if (!preset.id) {
        preset.id = makeID();
      }

      // Add or update timestamp
      preset.ts = Date.now();

      // Store the favorite status and temporarily remove it from the preset
      // so it doesn't get synchronized to other controllers
      const isFavorite = preset.favorite;
      const presetToSync = { ...preset };
      delete presetToSync.favorite;

      const existingPresetIndex = this.data.presets.findIndex(
        (p) => p.id === preset.id,
      );

      let payload;

      try {
        let completed = 0;
        for (const controller of controllers.data) {
          if (this.abortSaveOperation) {
            console.log("Save operation aborted");
            return; // Exit early
          }

          // Check if the controller already has this preset
          const existingDataResponse = await fetch(
            `http://${controller.ip_address}/data`,
          );
          const existingData = await existingDataResponse.json();
          const existingPreset = existingData.presets.find(
            (p) => p.id === preset.id,
          );

          if (existingPreset) {
            // Update existing preset
            payload = { [`presets[id=${preset.id}]`]: presetToSync };
            console.log("updatePreset payload: ", JSON.stringify(payload));
          } else {
            // Add new preset
            payload = { "presets[]": [presetToSync] };
            console.log("addPreset payload: ", JSON.stringify(payload));
          }

          if (!existingPreset || existingPreset.ts < preset.ts) {
            console.log("preset uri: ", `http://${controller.ip_address}/data`);
            console.log("preset payload: ", JSON.stringify(payload));
            const response = await fetch(
              `http://${controller.ip_address}/data`,
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
          }

          completed++;
          if (progressCallback) {
            progressCallback(completed, controllers.data.length);
          }
        }

        // Restore the favorite status
        preset.favorite = isFavorite;

        if (!this.abortSaveOperation) {
          if (existingPresetIndex !== -1) {
            // Update the preset in the local store
            this.data.presets[existingPresetIndex] = preset;
            console.log("updated preset", preset.name);
          } else {
            // Add the new preset to the local store
            this.data.presets.push(preset);
            console.log("added preset", preset.name, "with id", preset.id);
          }
        }
      } catch (error) {
        console.error("error saving preset:", error);
      }
    },

    async deletePreset(preset, progressCallback) {
      const controllers = useControllersStore();
      console.log("appDataStore deletePreset preset: ", preset);

      let payload = { [`presets[id=${preset.id}]`]: [] };
      console.log("deletePreset payload: ", JSON.stringify(payload));

      try {
        let completed = 0;
        for (const controller of controllers.data) {
          console.log("preset uri: ", `http://${controller.ip_address}/data`);
          console.log("preset payload: ", JSON.stringify(payload));
          const response = await fetch(`http://${controller.ip_address}/data`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
          });
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          completed++;
          if (progressCallback) {
            progressCallback(completed, controllers.data.length);
          }
        }
        this.data.presets = this.data.presets.filter((p) => p.id !== preset.id);
        console.log("deleted preset", preset.name);
      } catch (error) {
        console.error("error deleting preset:", error);
      }
    },

    // Toggle favorite status (local only)
    async toggleFavorite(preset) {
      const controllers = useControllersStore();
      const presetIndex = this.data.presets.findIndex(
        (p) => p.id === preset.id,
      );

      if (presetIndex !== -1) {
        // Toggle the favorite status locally only
        const updatedPreset = { ...this.data.presets[presetIndex] };
        updatedPreset.favorite = !updatedPreset.favorite;

        const payload = { [`presets[id=${preset.id}]`]: updatedPreset };
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
        // Update in local store only
        this.data.presets[presetIndex] = updatedPreset;
        console.log(
          `Set preset ${updatedPreset.name} favorite status to ${updatedPreset.favorite}`,
        );
      }
    },

    /*************************************************************
     *
     * group functions
     *
     **************************************************************/

    async saveGroup(group, progressCallback) {
      const controllers = useControllersStore();
      const existingGroupIndex = this.data.groups.findIndex(
        (g) => g.id === group.id,
      );

      // Add timestamp to the group
      group.ts = Date.now();

      let payload;

      try {
        let completed = 0;
        for (const controller of controllers.data) {
          const existingDataResponse = await fetch(
            `http://${controller.ip_address}/data`,
          );
          const existingData = await existingDataResponse.json();
          const existingGroup = existingData.groups.find(
            (g) => g.id === group.id,
          );
          if (existingGroup) {
            // Update existing group
            payload = { [`groups[id=${group.id}]`]: group };
            console.log("updateGroup payload: ", JSON.stringify(payload));
          } else {
            // Add new group
            payload = { "groups[]": [group] };
            console.log("addGroup payload: ", JSON.stringify(payload));
          }
          if (!existingGroup || existingGroup.ts < group.ts) {
            console.log("group uri: ", `http://${controller.ip_address}/data`);
            console.log("group payload: ", JSON.stringify(payload));
            const response = await fetch(
              `http://${controller.ip_address}/data`,
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
          }
          completed++;
          if (progressCallback) {
            progressCallback(completed, controllers.data.length);
          }
        }

        if (existingGroupIndex !== -1) {
          // Update the group in the local store
          this.data.groups[existingGroupIndex] = group;
          console.log("updated group", group.name);
        } else {
          // Add the new group to the local store
          this.data.groups.push(group);
          console.log("added group", group.name, "with id", group.id);
        }
      } catch (error) {
        console.error("error saving group:", error);
      }
      this.fetchData();
    },

    async deleteGroup(group, progressCallback) {
      const controllers = useControllersStore();
      console.log("appDataStore deleteGroup group: ", group);

      let payload = { [`groups[id=${group.id}]`]: [] };
      console.log("deleteGroup payload: ", JSON.stringify(payload));
      try {
        let completed = 0;
        for (const controller of controllers.data) {
          console.log("group uri: ", `http://${controller.ip_address}/data`);
          console.log("group payload: ", JSON.stringify(payload));
          const response = await fetch(`http://${controller.ip_address}/data`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
          });
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          completed++;
          if (progressCallback) {
            progressCallback(completed, controllers.data.length);
          }
        }
        this.data.groups = this.data.groups.filter((s) => s.id !== group.id);
        console.log("deleted group", group.name);
      } catch (error) {
        console.error("error deleting group:", error);
      }
    },

    /*************************************************************
     *
     * scene functions
     *
     **************************************************************/

    async saveScene(scene, progressCallback) {
      const controllers = useControllersStore();
      const existingSceneIndex = this.data.scenes.findIndex(
        (s) => s.id === scene.id,
      );

      // Add timestamp to the scene
      scene.ts = Date.now();

      let payload;

      try {
        let completed = 0;
        for (const controller of controllers.data) {
          const existingDataResponse = await fetch(
            `http://${controller.ip_address}/data`,
          );
          const existingData = await existingDataResponse.json();
          const existingScene = existingData.scenes.find(
            (s) => s.id === scene.id,
          );

          if (existingScene) {
            // Update existing scene
            payload = { [`scenes[id=${scene.id}]`]: scene };
            console.log("updateScene payload: ", JSON.stringify(payload));
          } else {
            // Add new scene
            payload = { "scenes[]": [scene] };
            console.log("addScene payload: ", JSON.stringify(payload));
          }

          if (!existingScene || existingScene.ts < scene.ts) {
            console.log("scene uri: ", `http://${controller.ip_address}/data`);
            console.log("scene payload: ", JSON.stringify(payload));
            const response = await fetch(
              `http://${controller.ip_address}/data`,
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
          }
          completed++;
          if (progressCallback) {
            console.log("progressCallback: ", completed);
            progressCallback(completed, controllers.data.length);
          }
        }

        if (existingSceneIndex !== -1) {
          // Update the scene in the local store
          this.data.scenes[existingSceneIndex] = scene;
          console.log("updated scene", scene.name);
        } else {
          // Add the new scene to the local store
          this.data.scenes.push(scene);
          console.log("added scene", scene.name, "with id", scene.id);
        }
      } catch (error) {
        console.error("error saving scene:", error);
      }
    },

    async deleteScene(scene, progressCallback) {
      const controllers = useControllersStore();
      console.log("appDataStore deleteScene scene: ", scene);

      let payload = { [`scenes[id=${scene.id}]`]: [] };
      console.log("deleteScene payload: ", JSON.stringify(payload));
      try {
        let completed = 0;
        for (const controller of controllers.data) {
          console.log("scene uri: ", `http://${controller.ip_address}/data`);
          console.log("scene payload: ", JSON.stringify(payload));
          const response = await fetch(`http://${controller.ip_address}/data`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
          });
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          completed++;
          if (progressCallback) {
            progressCallback(completed, controllers.data.length);
          }
        }
        this.data.scenes = this.data.scenes.filter((s) => s.id !== scene.id);
        console.log("deleted scene", scene.name);
      } catch (error) {
        console.error("error deleting scene:", error);
      }
    },
  },
});
