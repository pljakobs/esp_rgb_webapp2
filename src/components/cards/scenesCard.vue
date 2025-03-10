<template>
  <MyCard icon="scene" title="Scenes">
    <q-card-section class="flex justify-center">
      <q-scroll-area class="inset-scroll-area">
        <q-list separator style="overflow-y: auto; height: 100%" dense>
          <div v-if="scenes && scenes.length > 0">
            <div v-for="scene in scenes" :key="scene.name">
              <q-item
                class="q-my-sm"
                style="padding-bottom: 0px; margin-bottom: 0px"
              >
                <q-item-section
                  avatar
                  @click="toggleScene(scene.id)"
                  top
                  class="scene"
                >
                  <q-tooltip>expand scene</q-tooltip>
                  <svg-icon
                    name="arrow_drop_down"
                    :class="{
                      'rotated-arrow': expandedScene !== scene.id,
                    }"
                  />
                </q-item-section>
                <q-item-section @click="toggleScene(scene.id)">
                  <q-item-label>{{ scene.name }}</q-item-label>
                </q-item-section>
                <q-item-section side>
                  <q-tooltip>edit scene</q-tooltip>
                  <div class="icon-wraper" @click.stop="editScene(scene)">
                    <svgIcon name="edit" />
                  </div>
                </q-item-section>
                <q-item-section side>
                  <q-tooltip>delete scene</q-tooltip>
                  <div class="icon-wraper" @click.stop="deleteScene(scene)">
                    <svgIcon name="delete" />
                  </div>
                </q-item-section>
              </q-item>
              <div v-if="expandedScene === scene.id" class="indented-list">
                <q-list dense> </q-list>
              </div>
            </div>
          </div>
          <div v-else>
            <div class="no-scenes-container">
              <div class="no-scenes-message">No scenes available</div>
            </div>
          </div>
        </q-list>
      </q-scroll-area>
    </q-card-section>
    <q-card-section class="flex justify-center">
      <q-btn flat color="primary" @click="openDialog">
        <template v-slot:default>
          <svgIcon name="scene" />
          <span>Add Scene</span>
        </template>
      </q-btn>
    </q-card-section>
  </MyCard>
</template>

<script>
import { ref, computed } from "vue";
import { Dialog } from "quasar";
import { useAppDataStore } from "src/stores/appDataStore";
import MyCard from "src/components/myCard.vue";
import sceneDialog from "src/components/Dialogs/sceneDialog.vue";

export default {
  name: "scenesCard",
  components: {
    MyCard,
  },
  setup() {
    const appData = useAppDataStore();
    const expandedScene = ref(null);

    const scenes = computed(() => {
      return appData.data.scenes;
    });

    const toggleScene = (sceneId) => {
      expandedScene.value = expandedScene.value === sceneId ? null : sceneId;
    };

    const addScene = () => {
      Dialog.create({
        component: sceneDialog,
      })
        .onOk((scene) => {
          handleSave(scene);
        })
        .onCancel(() => {
          console.log("Dialog canceled");
        })
        .onDismiss(() => {
          console.log("Dialog dismissed");
        });
    };

    const editScene = (scene) => {
      Dialog.create({
        component: sceneDialog,
        componentProps: {
          scene,
        },
      })
        .onOk((scene) => {
          handleSave(scene);
        })
        .onCancel(() => {
          console.log("Dialog canceled");
        })
        .onDismiss(() => {
          console.log("Dialog dismissed");
        });
    };

    const handleSave = (scene) => {
      console.log("Saving scene", scene);
      appData.saveScene(scene);
    };

    const deleteScene = (scene) => {
      console.log("Deleting scene", scene);
      appData.deleteScene(scene);
    };

    return {
      scenes,
      openDialog: addScene,
      editScene,
      deleteScene,
      expandedScene,
      toggleScene,
    };
  },
};
</script>

<style scoped>
.no-scenes-container {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
  width: 100%;
  vertical-align: middle;
}
.no-scenes-message {
  background-color: #f0f0f0;
  padding: 20px;
  border-radius: 10px;
  text-align: center;
  vertical-align: middle;
  color: #333;
}
.indented-list {
  padding-left: 55px;
  padding-top: 0px;
  margin-top: 0; /* Remove extra spacing */
}
.rotated-arrow {
  transform: rotate(-90deg);
  transition: transform 0.3s;
}
.rotated-arrow.expanded {
  transform: rotate(0deg);
}
.inset-scroll-area {
  height: 300px;
  width: 100%;
  max-width: 400px;
  box-shadow: inset 0 0 10px rgba(255, 255, 255, 0.1);
  margin: 10px;
}
.scene {
  cursor: pointer;
  margin-top: 0px;
  margin-bottom: 0px;
  padding-top: 0px; /* Adjust as needed */
  padding-bottom: 5px; /* Adjust as needed */
}
</style>
