<template>
  <q-dialog ref="dialogRef" @hide="onDialogHide">
    <q-card class="q-dialog-plugin">
      <q-toolbar :class="toolbarClass">
        <q-toolbar-title>
          {{ isEditMode ? "Edit Scene" : "Add Scene" }}
        </q-toolbar-title>
      </q-toolbar>

      <q-card-section>
        <q-select
          v-model="selectedGroup"
          :options="groupOptions"
          label="Select Group"
          filled
          @update:model-value="onGroupChange"
          dropdown-icon="img:icons/arrow_drop_down.svg"
        />
      </q-card-section>

      <q-card-section>
        <q-list>
          <q-item
            v-for="controller in filteredControllers"
            :key="controller.id"
            clickable
            v-ripple
          >
            <q-item-section avatar>
              <div v-if="preset.color.hsv">
                <q-badge
                  :style="{
                    backgroundColor: `rgb(${hsvToRgb(preset.color.hsv).r}, ${
                      hsvToRgb(preset.color.hsv).g
                    }, ${hsvToRgb(preset.color.hsv).b})`,
                    width: '30px',
                    height: '30px',
                    borderRadius: '50%',
                    border: '1px solid black',
                  }"
                  round
                  @click="handlePresetClick(preset)"
                />
              </div>
              <div v-else>
                <RawBadge
                  :color="preset.color"
                  @click="handlePresetClick(preset)"
                />
              </div>
            </q-item-section>

            <q-item-section>
              {{ controller.hostname }}
            </q-item-section>
          </q-item>
        </q-list>
      </q-card-section>

      <q-card-section>
        <q-input v-model="sceneName" label="Scene Name" filled autofocus />
      </q-card-section>

      <q-card-section v-if="progress.total > 0">
        <q-linear-progress
          :value="progress.completed / progress.total"
          color="primary"
        />
        <div>
          {{ progress.completed }} / {{ progress.total }} controllers updated
        </div>
      </q-card-section>
      <q-card-actions align="right">
        <q-btn flat label="Cancel" color="primary" @click="onCancelClick" />
        <q-btn
          v-if="sceneExists"
          flat
          label="Overwrite"
          color="negative"
          @click="onSaveClick"
          :disabled="isSaveDisabled"
        />
        <q-btn
          v-if="!sceneExists"
          flat
          label="Save"
          color="primary"
          @click="onSaveClick"
          :disabled="isSaveDisabled"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script>
import { ref, computed, watch } from "vue";
import { useControllersStore } from "src/stores/controllersStore";
import { useAppDataStore } from "src/stores/appDataStore";
import { useDialogPluginComponent } from "quasar";
import { makeID } from "src/services/tools";

export default {
  name: "sceneDialog",
  props: {
    scene: {
      type: Object,
      default: null,
    },
  },
  emits: ["close", "save", ...useDialogPluginComponent.emits],
  setup(props, { emit }) {
    const { dialogRef, onDialogHide, onDialogOK, onDialogCancel } =
      useDialogPluginComponent();
    const controllersStore = useControllersStore();
    const appData = useAppDataStore();
    const sceneName = ref("");
    const selectedGroup = ref(null);
    const internalSelectedControllers = ref([]);
    const isEditMode = computed(() => !!props.scene);
    const progress = ref({ completed: 0, total: 0 });
    const sceneExists = ref(false);

    const groupOptions = computed(() => {
      return appData.data.groups.map((group) => ({
        label: group.name,
        value: group.id,
      }));
    });

    const controllersInGroup = computed(() => {
      if (!selectedGroup.value) {
        return [];
      }
      console.log("selectedGroup", selectedGroup.value.value);
      const group = appData.data.groups.find(
        (group) => group.id === selectedGroup.value.value,
      );
      console.log("group", JSON.stringify(group));
      console.log(
        "controllersStore.data",
        JSON.stringify(controllersStore.data),
      );
      const controllers_in_group = controllersStore.data.filter((controller) =>
        group.controller_ids.includes(String(controller.id)),
      );
      console.log("controllers_in_group", JSON.stringify(controllers_in_group));
      return controllers_in_group;
    });

    const isControllerSelected = (controllerId) => {
      return internalSelectedControllers.value.includes(String(controllerId));
    };

    const colorInScene = (controllerId) => {
      return internalSelectedControllers.value.includes(String(controllerId));
    };

    const updateSelectedControllers = (controllerId, isSelected) => {
      if (isSelected) {
        if (!internalSelectedControllers.value.includes(String(controllerId))) {
          internalSelectedControllers.value.push(String(controllerId));
        }
      } else {
        internalSelectedControllers.value =
          internalSelectedControllers.value.filter(
            (id) => id !== String(controllerId),
          );
      }
    };

    const onGroupChange = (groupId) => {
      internalSelectedControllers.value = [];
    };

    const isSaveDisabled = computed(() => {
      return sceneName.value.trim() === "";
    });

    const verifySceneName = () => {
      const existingScene = appData.data.scenes.find(
        (scene) => scene.name === sceneName.value,
      );
      sceneExists.value = !!existingScene;
    };

    const toolbarClass = computed(() => {
      return sceneExists.value
        ? "bg-warning text-dark"
        : "bg-primary text-white";
    });

    watch(sceneName, verifySceneName);

    watch(
      () => props.scene,
      (newScene) => {
        if (newScene) {
          sceneName.value = newScene.name;
          selectedGroup.value = newScene.group_id;
          internalSelectedControllers.value = newScene.controller_ids;
        } else {
          sceneName.value = "";
          selectedGroup.value = null;
          internalSelectedControllers.value = [];
        }
      },
      { immediate: true },
    );

    const onSaveClick = async () => {
      if (sceneName.value.trim() !== "") {
        const newScene = {
          name: sceneName.value,
          group_id: selectedGroup.value,
          controller_ids: internalSelectedControllers.value,
          id: isEditMode.value ? props.scene.id : makeID(),
        };
        console.log("new scene", newScene);
        progress.value.total = controllersStore.data.length;
        progress.value.completed = 0;
        await appData.saveScene(newScene, (completed, total) => {
          progress.value.completed = completed;
          progress.value.total = total;
        });
        console.log("new scene", newScene);
        emit("ok", newScene);
        onDialogOK();
      } else {
        alert("Please enter a scene name");
      }
    };

    const onCancelClick = () => {
      onDialogCancel();
    };

    return {
      dialogRef,
      onDialogHide,
      onCancelClick,
      onSaveClick,
      sceneName,
      selectedGroup,
      internalSelectedControllers,
      isControllerSelected,
      updateSelectedControllers,
      onGroupChange,
      filteredControllers: controllersInGroup,
      isEditMode,
      progress,
      isSaveDisabled,
      sceneExists,
      toolbarClass,
      groupOptions,
    };
  },
};
</script>

<style scoped>
.adaptive-card {
  min-width: 400px;
  max-width: 80vw;
  max-height: 80vh;
  overflow: auto;
}
</style>
