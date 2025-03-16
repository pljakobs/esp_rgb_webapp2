<template>
  <q-dialog ref="dialogRef" @hide="handleDialogHide">
    <q-card class="q-dialog-plugin adaptive-card">
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
              <div v-else>❌</div>
            </q-item-section>

            <q-item-section>
              {{ controller.hostname }}
            </q-item-section>

            <q-item-section>
              <q-select
                v-model="getControllerSetting(controller.id).colorType"
                :options="colorTypeOptions"
                @update:model-value="onColorTypeChange(controller.id, $event)"
                dropdown-icon="img:icons/arrow_drop_down.svg"
                emit-value
                map-options
                :display-value="getDisplayValue(controller.id)"
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
import { useDialogPluginComponent, colors, Dialog } from "quasar";
import { makeID } from "src/services/tools";
import RawBadge from "src/components/RawBadge.vue";
// Import but don't register in components - we'll use it programmatically
import ColorPickerDialog from "src/components/Dialogs/colorPickerDialog.vue";

const { hsvToRgb } = colors;

export default {
  name: "sceneDialog",
  components: {
    RawBadge,
  },
  props: {
    modelValue: {
      type: Boolean,
      default: false,
    },
    scene: {
      type: Object,
      default: null,
    },
  },
  emits: [
    "close",
    "save",
    "update:model-value",
    ...useDialogPluginComponent.emits,
  ],
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
    const selectedControllerId = ref(null);

    watch(
      () => props.modelValue,
      (val) => {
        if (val && dialogRef.value) {
          dialogRef.value.show();
        }
      },
      { immediate: true },
    );

    const groupOptions = computed(() => {
      return appData.data.groups.map((group) => ({
        label: group.name,
        value: group.id,
      }));
    });

    const getDisplayValue = (controllerId) => {
      const setting = getControllerSetting(controllerId);
      if (!setting || !setting.colorType) {
        return "Select color type";
      }
      return setting.colorType;
    };

    const handleDialogHide = () => {
      emit("update:model-value", false);
      onDialogHide();
    };

    const colorOptions = computed(() => {
      const presets = appData.data.presets.map((preset) => ({
        label: preset.name,
        value: preset.id,
      }));
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
      if (!controllerId) return null;
      if (!scene.value.settings) return null;

      return scene.value.settings.find(
        (setting) => setting.controller_id === String(controllerId),
      );
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
              colorType: "HSV",
            });
          }
        }
        console.log("sceneSettings", JSON.stringify(scene.value.settings));
        await nextTick();
      }
    };

    const onGroupChange = async (groupId) => {
      scene.value.settings = [];
      await populateSettingsForGroup(groupId);
      await nextTick(); // Ensure DOM updates are complete
    };

    const openColorPicker = (type, controllerId) => {
      try {
        selectedControllerId.value = controllerId;
        const setting = getControllerSetting(controllerId);

        let initialColor = {};

        if (type === "HSV") {
          // If the setting already has HSV values, use them, otherwise use defaults
          initialColor = {
            hsv: setting?.color?.hsv || { h: 0, s: 0, v: 0 },
          };
        } else if (type === "RAW") {
          // If the setting already has RAW values, use them, otherwise use defaults
          initialColor = {
            raw: setting?.color?.raw || { r: 0, g: 0, b: 0, ww: 0, cw: 0 },
          };
        } else {
          throw new Error(`Unsupported color type: ${type}`);
        }

        console.log("Opening color picker with type:", type);
        console.log("Initial color:", initialColor);

        Dialog.create({
          component: ColorPickerDialog,
          componentProps: {
            type,
            initialColor,
          },
        })
          .onOk((color) => {
            console.log("Color picker returned:", color);

            if (selectedControllerId.value) {
              updateControllerSetting(
                selectedControllerId.value,
                "color",
                color,
              );
              updateControllerSetting(
                selectedControllerId.value,
                "colorType",
                type,
              );
            }
          })
          .onCancel(() => {
            console.log("Color selection canceled");
          })
          .onDismiss(() => {
            selectedControllerId.value = null;
          });
      } catch (error) {
        console.error("Error opening color picker:", error);
        selectedControllerId.value = null;

        Dialog.create({
          title: "Error",
          message: "Failed to open color picker. Please try again.",
          persistent: true,
          ok: true,
        });
      }
    };

    const onColorTypeChange = (controllerId, value) => {
      try {
        if (value === "HSV" || value === "RAW") {
          // Always open the color picker, even if the type is the same
          openColorPicker(value, controllerId);
        } else if (value === "Preset") {
          // Handle preset selection
          const presetSelector = Dialog.create({
            title: "Select Preset",
            message: "Choose a preset color",
            options: {
              type: "radio",
              model: "",
              items: presetOptions.value,
            },
            persistent: true,
            cancel: true,
            ok: true,
          }).onOk((selectedPresetId) => {
            const preset = appData.data.presets.find(
              (p) => p.id === selectedPresetId,
            );
            if (preset) {
              // Set color using the new format with Preset id
              updateControllerSetting(controllerId, "color", {
                Preset: { id: selectedPresetId },
              });
              updateControllerSetting(controllerId, "colorType", "Preset");
            }
          });
        } else {
          // Direct preset selection (if value is a preset ID)
          const preset = appData.data.presets.find((p) => p.id === value);
          if (preset) {
            updateControllerSetting(controllerId, "color", {
              Preset: { id: value },
            });
            updateControllerSetting(controllerId, "colorType", "Preset");
          }
        }
      } catch (error) {
        console.error("Error handling color type change:", error);
      }
    };

    const isSaveDisabled = computed(() => {
      return scene.value.name.trim() === "";
    });

    const verifySceneName = () => {
      const existingScene = appData.data.scenes.find(
        (s) => s.name === scene.value.name && s.id !== (props.scene?.id || ""),
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
          scene.value = JSON.parse(JSON.stringify(props.scene)); // Deep copy
          await populateSettingsForGroup(props.scene.group_id);
        } else {
          scene.value = {
            name: "",
            group_id: null,
            settings: [],
            id: makeID(),
          };
        }
      } catch (error) {
        console.error("Error in onMounted:", error);
      }
    });

    const onSaveClick = async () => {
      if (scene.value.name.trim() !== "") {
        const newScene = {
          ...scene.value,
          id: isEditMode.value ? props.scene.id : makeID(),
        };

        progress.value.total = controllersStore.data.length;
        progress.value.completed = 0;

        await appData.saveScene(newScene, (completed, total) => {
          progress.value.completed = completed;
          progress.value.total = total;
        });

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
      handleDialogHide,
      onCancelClick,
      onSaveClick,
      scene,
      onGroupChange,
      controllersInGroup,
      getControllerSetting,
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
      onColorTypeChange,
      selectedControllerId,
      getDisplayValue,
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
