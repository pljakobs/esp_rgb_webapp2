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
      groups: [],
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
          console.log("groups data: ", JSON.stringify(this.data.groups));
        }
      } catch (error) {
        console.error("error fetching app-data:", error);
        this.status = storeStatus.ERROR;
      }
    },

    /*************************************************************
     *
     * group functions
     *
     **************************************************************/

    async saveGroup(group) {
      const controllers = useControllersStore();
      const existingGroupIndex = this.data.groups.findIndex(
        (g) => g.id === group.id,
      );

      // Add timestamp to the group
      group.ts = Date.now();

      let payload;
      if (existingGroupIndex !== -1) {
        // Update existing group
        payload = { [`groups[id=${group.id}]`]: group };
        console.log("updateGroup payload: ", JSON.stringify(payload));
      } else {
        // Add new group
        payload = { "groups[]": [group] };
        console.log("addGroup payload: ", JSON.stringify(payload));
      }

      try {
        for (const controller of controllers.data) {
          const existingDataResponse = await fetch(
            `http://${controller.ip_address}/data`,
          );
          const existingData = await existingDataResponse.json();
          const existingGroup = existingData.groups.find(
            (g) => g.id === group.id,
          );

          console.log(
            "looking for ",
            group.name,
            "on controller",
            controller.hostname,
          );
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
        }

        if (existingGroupIndex !== -1) {
          // Update the group in the local store
          this.data.groups[existingGroupIndex] = group;
          console.log("updated group", group.name);
        } else {
          // Add the new group to the local store
          this.data.groups.push(group);
          console.log("added group", group.name, "with id", group.id);
          this.fetchData();
        }
      } catch (error) {
        console.error("error saving group:", error);
      }
    },

    async deleteGroup(group) {
      const controllers = useControllersStore();
      console.log("appDataStore deleteGroup group: ", group);

      let payload = { [`groups[id=${group.id}]`]: [] };
      console.log("deleteGroup payload: ", JSON.stringify(payload));
      try {
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

    async saveScene(scene) {
      const controllers = useControllersStore();
      const existingSceneIndex = this.data.scenes.findIndex(
        (s) => s.id === scene.id,
      );

      // Add timestamp to the scene
      scene.ts = Date.now();

      let payload;
      if (existingSceneIndex !== -1) {
        // Update existing scene
        payload = { [`scenes[id=${scene.id}]`]: scene };
        console.log("updateScene payload: ", JSON.stringify(payload));
      } else {
        // Add new scene
        payload = { "scenes[]": [scene] };
        console.log("addScene payload: ", JSON.stringify(payload));
      }

      try {
        for (const controller of controllers.data) {
          const existingDataResponse = await fetch(
            `http://${controller.ip_address}/data`,
          );
          const existingData = await existingDataResponse.json();
          const existingScene = existingData.scenes.find(
            (s) => s.id === scene.id,
          );

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

    async deleteScene(scene) {
      const controllers = useControllersStore();
      console.log("appDataStore deleteScene scene: ", scene);

      let payload = { [`scenes[id=${scene.id}]`]: [] };
      console.log("deleteScene payload: ", JSON.stringify(payload));
      try {
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
        }
        this.data.scenes = this.data.scenes.filter((s) => s.id !== scene.id);
        console.log("deleted scene", scene.name);
      } catch (error) {
        console.error("error deleting scene:", error);
      }
    },
  },
});
