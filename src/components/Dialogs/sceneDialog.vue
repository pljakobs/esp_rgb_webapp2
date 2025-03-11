<template>
  <q-dialog ref="dialogRef" @hide="onDialogHide">
    <q-card class="q-dialog-plugin">
      <q-toolbar :class="toolbarClass">
        <q-toolbar-title>
          {{ isEditMode ? "Edit Scene" : "Add Scene" }}
        </q-toolbar-title>
      </q-toolbar>

      <q-card-section v-if="groupOptions.length !== 0">
        <q-select
          v-model="scene.group_id"
          :options="groupOptions"
          label="Select Group"
          filled
          @update:model-value="onGroupChange"
          dropdown-icon="img:icons/arrow_drop_down.svg"
          emit-value
          map-options
        />
      </q-card-section>
      <q-card-section v-else>
        A scene needs at least one group to be defined
      </q-card-section>
      <q-card-section> </q-card-section>
      <q-card-section>
        <q-list>
          <q-item
            v-for="controller in controllersInGroup"
            :key="controller.id"
            clickable
            v-ripple
          >
            <q-item-section avatar>
              <div v-if="getControllerSetting(controller.id)?.color?.hsv">
                <q-badge
                  :style="{
                    backgroundColor: `rgb(${
                      hsvToRgb(getControllerSetting(controller.id).color.hsv).r
                    }, ${hsvToRgb(getControllerSetting(controller.id).color.hsv).g}, ${
                      hsvToRgb(getControllerSetting(controller.id).color.hsv).b
                    })`,
                    width: '30px',
                    height: '30px',
                    borderRadius: '50%',
                    border: '1px solid black',
                  }"
                  round
                />
              </div>
              <div v-else-if="getControllerSetting(controller.id)?.color?.raw">
                <RawBadge
                  :color="getControllerSetting(controller.id)?.color?.raw"
                />
              </div>
              <div v-else>
                ❌ -> {{ controller.id }}:
                {{ getControllerSetting(controller.id) }} <-
              </div>
            </q-item-section>

            <q-item-section>
              {{ controller.hostname }}
            </q-item-section>
            <q-item-section>
              <q-select
                @update:model-value="onColorTypeChange(controller.id, $event)"
                :options="colorOptions"
                dropdown-icon="img:icons/arrow_drop_down.svg"
                emit-value
                map-options
              />
            </q-item-section>
          </q-item>
        </q-list>
      </q-card-section>

      <q-card-section>
        <q-input v-model="scene.name" label="Scene Name" filled autofocus />
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
import { ref, computed, watch, onMounted, nextTick } from "vue";
import { useControllersStore } from "src/stores/controllersStore";
import { useAppDataStore } from "src/stores/appDataStore";
import { useDialogPluginComponent, colors } from "quasar";
import { makeID } from "src/services/tools";
import RawBadge from "src/components/RawBadge.vue";

const { hsvToRgb } = colors;

export default {
  name: "sceneDialog",
  components: {
    RawBadge,
  },
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
    const scene = ref({
      name: "",
      group_id: null,
      settings: [],
      id: makeID(),
    });
    const isEditMode = computed(() => !!props.scene);
    const progress = ref({ completed: 0, total: 0 });
    const sceneExists = ref(false);

    const groupOptions = computed(() => {
      return appData.data.groups.map((group) => ({
        label: group.name,
        value: group.id,
      }));
    });

    const colorOptions = computed(() => {
      const presets = appData.data.presets.map((preset) => ({
        label: preset.name,
        value: preset.id,
      }));
      console.log("presets: ", presets);
      return [
        { label: "Presets", header: true },
        { separator: true },
        ...presets,
        { separator: true },
        { label: "Select HSV", value: "HSV" },
        { separator: true },
        { label: "Select RAW", value: "RAW" },
      ];
    });

    const presetOptions = computed(() => {
      return appData.data.presets.map((preset) => ({
        label: preset.name,
        value: preset.id,
      }));
    });

    const colorTypeOptions = [
      { label: "Preset", value: "Preset" },
      { label: "HSV", value: "HSV" },
      { label: "RAW", value: "RAW" },
    ];

    const controllersInGroup = computed(() => {
      if (!scene.value.group_id) {
        return [];
      }
      const group = appData.data.groups.find(
        (group) => group.id === scene.value.group_id,
      );
      if (!group) {
        return [];
      }
      return controllersStore.data.filter((controller) =>
        group.controller_ids.includes(String(controller.id)),
      );
    });

    const getControllerSetting = (controllerId) => {
      console.log("-> getControllerSetting", controllerId);
      console.log("-> scene settings", scene.value.settings);
      const thisControllerSetting = scene.value.settings.find(
        (setting) => setting.controller_id === String(controllerId),
      );
      console.log(
        "setting for Controller",
        controllerId,
        ":",
        thisControllerSetting,
      );
      return thisControllerSetting;
    };

    const updateControllerSetting = (controllerId, key, value) => {
      const setting = getControllerSetting(controllerId);
      if (setting) {
        const keys = key.split(".");
        let obj = setting;
        while (keys.length > 1) {
          const k = keys.shift();
          if (!obj[k]) obj[k] = {};
          obj = obj[k];
        }
        obj[keys[0]] = value;
      }
    };

    const populateSettingsForGroup = async (groupId) => {
      console.log("populating settings for Group ", groupId);
      const group = appData.data.groups.find((group) => group.id === groupId);
      if (group) {
        console.log("controllers", group.controller_ids);
        for (const controllerId of group.controller_ids) {
          console.log("->", controllerId);
          if (!getControllerSetting(controllerId)) {
            console.log("--> pushing color");
            scene.value.settings.push({
              controller_id: controllerId,
              color: { hsv: { h: 0, s: 0, v: 0 } },
            });
          }
          console.log("-> after loop");
        }
        console.log("sceneSettings", JSON.stringify(scene.value.settings));
        await nextTick();
      }
    };

    const onGroupChange = async (groupId) => {
      scene.value.settings = [];
      await populateSettingsForGroup(groupId);
    };

    const onColorTypeChange = (controllerId, value) => {
      const setting = getControllerSetting(controllerId);
      if (value === "HSV") {
        // Open HsvSection.vue and get the resulting color
        // This is a placeholder for opening the HSV section
        console.log("Open HSV section for controller", controllerId);
      } else if (value === "RAW") {
        // Open RawSection.vue and get the resulting color
        // This is a placeholder for opening the RAW section
        console.log("Open RAW section for controller", controllerId);
      } else {
        // Set the color to the selected preset
        const preset = appData.data.presets.find((p) => p.id === value);
        if (preset) {
          updateControllerSetting(controllerId, "color", preset.color);
        }
      }
    };

    const isSaveDisabled = computed(() => {
      return scene.value.name.trim() === "";
    });

    const verifySceneName = () => {
      const existingScene = appData.data.scenes.find(
        (s) => s.name === scene.value.name,
      );
      sceneExists.value = !!existingScene;
    };

    const toolbarClass = computed(() => {
      return sceneExists.value
        ? "bg-warning text-dark"
        : "bg-primary text-white";
    });

    watch(() => scene.value.name, verifySceneName);

    onMounted(async () => {
      try {
        if (props.scene) {
          scene.value = { ...props.scene };
          await populateSettingsForGroup(props.scene.group_id);
        } else {
          scene.value = {
            name: "",
            group_id: null,
            settings: [],
            id: makeID(),
          };
        }
        console.log("scene on mount:", JSON.stringify(scene.value));
      } catch {
        console.log("error in onMounted");
      }
    });

    const onSaveClick = async () => {
      if (scene.value.name.trim() !== "") {
        const newScene = {
          ...scene.value,
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
      scene,
      onGroupChange,
      controllersInGroup,
      getControllerSetting,
      updateControllerSetting,
      isEditMode,
      progress,
      isSaveDisabled,
      sceneExists,
      toolbarClass,
      groupOptions,
      presetOptions,
      colorTypeOptions,
      colorOptions,
      hsvToRgb,
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
