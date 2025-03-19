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
              <!-- HSV Color Badge -->
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
              <!-- RAW Color Badge -->
              <div v-else-if="getControllerSetting(controller.id)?.color?.raw">
                <RawBadge :color="getControllerSetting(controller.id)?.color" />
              </div>
              <!-- Preset Badge - NEW! -->
              <div
                v-else-if="getControllerSetting(controller.id)?.color?.Preset"
              >
                <q-badge
                  class="preset-badge"
                  :label="
                    getPresetName(
                      getControllerSetting(controller.id).color.Preset.id,
                    )
                  "
                  color="primary"
                />
              </div>
              <!-- No selection -->
              <div v-else><svgIcon name="palette_outlined" /></div>
            </q-item-section>

            <q-item-section>
              {{ controller.hostname }}
            </q-item-section>

            <q-item-section>
              <div class="row items-center">
                <q-btn
                  v-if="getColorType(controller.id)"
                  flat
                  dense
                  round
                  @click="editCurrentSelection(controller.id)"
                  class="q-ml-sm"
                >
                  <svgIcon name="edit" />
                  <q-tooltip>Edit current selection</q-tooltip>
                </q-btn>
                <q-select
                  :model-value="getColorType(controller.id)"
                  @update:model-value="onColorTypeChange(controller.id, $event)"
                  :options="colorTypeOptions"
                  dropdown-icon="img:icons/arrow_drop_down.svg"
                  emit-value
                  map-options
                  :display-value="getDisplayValue(controller.id)"
                  class="col"
                />
              </div>
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

    // Enhanced display function that shows more info about the selection
    const getDisplayValue = (controllerId) => {
      const setting = getControllerSetting(controllerId);
      if (!setting || !setting.color) {
        return "Select color type";
      }

      // More descriptive display values
      if (setting.color.hsv) {
        const { h, s, v } = setting.color.hsv;
        return `HSV (${h}°, ${s}%, ${v}%)`;
      }
      if (setting.color.raw) {
        const { r, g, b } = setting.color.raw;
        return `RAW (R:${r}, G:${g}, B:${b})`;
      }
      if (setting.color.Preset) {
        const presetName = getPresetName(setting.color.Preset.id);
        return `Preset: ${presetName}`;
      }

      return "Select color type";
    };

    // Helper to get preset name from ID
    const getPresetName = (presetId) => {
      const preset = appData.data.presets.find((p) => p.id === presetId);
      return preset ? preset.name : "Unknown";
    };

    const handleDialogHide = () => {
      emit("update:model-value", false);
      onDialogHide();
    };

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

    const getColorType = (controllerId) => {
      const setting = getControllerSetting(controllerId);
      if (!setting || !setting.color) return null;

      if (setting.color.hsv) return "HSV";
      if (setting.color.raw) return "RAW";
      if (setting.color.Preset) return "Preset";

      return null;
    };

    const updateControllerSetting = (controllerId, key, value) => {
      const setting = getControllerSetting(controllerId);
      if (setting) {
        if (key === "color") {
          // Replace the entire color object
          setting.color = value;
        } else {
          // For other properties, use the path-based approach
          const keys = key.split(".");
          let obj = setting;
          while (keys.length > 1) {
            const k = keys.shift();
            if (!obj[k]) obj[k] = {};
            obj = obj[k];
          }
          obj[keys[0]] = value;
        }
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
              // No colorType property
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

        // Create a completely non-reactive plain object for initial color
        let initialHsv = { h: 0, s: 0, v: 0 };
        let initialRaw = { r: 0, g: 0, b: 0, ww: 0, cw: 0 };

        // Copy primitive values manually
        if (setting?.color?.hsv) {
          initialHsv.h = Number(setting.color.hsv.h || 0);
          initialHsv.s = Number(setting.color.hsv.s || 0);
          initialHsv.v = Number(setting.color.hsv.v || 0);
        }

        if (setting?.color?.raw) {
          initialRaw.r = Number(setting.color.raw.r || 0);
          initialRaw.g = Number(setting.color.raw.g || 0);
          initialRaw.b = Number(setting.color.raw.b || 0);
          initialRaw.ww = Number(setting.color.raw.ww || 0);
          initialRaw.cw = Number(setting.color.raw.cw || 0);
        }

        // Create the initial color object based on type
        const initialColor =
          type === "HSV" ? { hsv: initialHsv } : { raw: initialRaw };

        console.log("Opening color picker with type:", type);
        console.log("Initial color:", initialColor);

        Dialog.create({
          component: ColorPickerDialog,
          componentProps: {
            type,
            initialColor,
          },
        })
          .onOk((result) => {
            console.log("Color picker returned:", result);

            // Create a completely new plain object to avoid reactivity issues
            let newColorObj;

            if (type === "HSV") {
              // Manual primitive extraction
              const h = Number(result?.hsv?.h || 0);
              const s = Number(result?.hsv?.s || 0);
              const v = Number(result?.hsv?.v || 0);
              newColorObj = { hsv: { h, s, v } };
            } else {
              // Manual primitive extraction
              const r = Number(result?.raw?.r || 0);
              const g = Number(result?.raw?.g || 0);
              const b = Number(result?.raw?.b || 0);
              const ww = Number(result?.raw?.ww || 0);
              const cw = Number(result?.raw?.cw || 0);
              newColorObj = { raw: { r, g, b, ww, cw } };
            }

            console.log("Created plain color object:", newColorObj);

            // Direct settings update
            if (selectedControllerId.value) {
              // Find the controller setting index rather than the object reference
              const settingIndex = scene.value.settings.findIndex(
                (s) => s.controller_id === String(selectedControllerId.value),
              );

              if (settingIndex >= 0) {
                // Replace the entire color object with our non-reactive plain object
                scene.value.settings[settingIndex].color = newColorObj;
                console.log("Updated controller color:", newColorObj);
              }
            }

            selectedControllerId.value = null;
          })
          .onCancel(() => {
            console.log("Color selection canceled");
            selectedControllerId.value = null;
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

    // New function to edit the current selection without changing type
    const editCurrentSelection = (controllerId) => {
      const currentType = getColorType(controllerId);
      if (!currentType) return;

      // Re-open the appropriate dialog based on current type
      if (currentType === "HSV" || currentType === "RAW") {
        openColorPicker(currentType, controllerId);
      } else if (currentType === "Preset") {
        // Open preset selection dialog with the current preset selected
        const currentPresetId =
          getControllerSetting(controllerId)?.color?.Preset?.id;

        Dialog.create({
          title: "Change Preset",
          message: "Choose a preset color",
          options: {
            type: "radio",
            model: currentPresetId || "",
            items: presetOptions.value,
          },
          persistent: true,
          cancel: true,
          ok: true,
        }).onOk((selectedPresetId) => {
          if (selectedPresetId) {
            updateControllerSetting(controllerId, "color", {
              Preset: { id: selectedPresetId },
            });
          }
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
          Dialog.create({
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
            }
          });
        } else {
          // Direct preset selection (if value is a preset ID)
          const preset = appData.data.presets.find((p) => p.id === value);
          if (preset) {
            updateControllerSetting(controllerId, "color", {
              Preset: { id: value },
            });
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

        // Add callbacks like in groupDialog
        const result = {
          ...newScene,
          // Function parent will call when save is complete
          saveComplete: () => {
            console.log("saveComplete called, closing dialog");
            // Directly hide the dialog instead of calling onDialogOK
            dialogRef.value.hide();
          },
          // Progress reporting callback
          updateProgress: (completed, total) => {
            progress.value.completed = completed;
            progress.value.total = total;
          },
        };

        emit("ok", result);
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
      hsvToRgb,
      onColorTypeChange,
      selectedControllerId,
      getDisplayValue,
      getColorType,
      getPresetName, // Added this
      editCurrentSelection, // Added this
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

.preset-badge {
  min-width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 15px;
  padding: 0 8px;
  font-size: 0.8em;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100px;
  white-space: nowrap;
}
</style>
