<template>
  <q-dialog ref="dialogRef" @hide="onDialogHide" persistent>
    <q-card class="q-dialog-plugin">
      <!-- Confirmation mode -->
      <q-card-section v-if="!isDeleting">
        <q-item>
          <q-item-section>
            <q-item-label class="text-h6"
              >Delete {{ itemTypeCapitalized }}</q-item-label
            >
            <q-item-label>
              Are you sure you want to delete "{{ item.name }}"?
            </q-item-label>
            <q-item-label
              caption
              v-if="blockingCondition"
              class="text-negative"
            >
              {{ blockingCondition.message }}
            </q-item-label>
          </q-item-section>
          <q-item-section avatar side>
            <!-- Icon based on item type -->
            <svgIcon v-if="itemType === 'group'" name="light_group" />
            <svgIcon v-else-if="itemType === 'scene'" name="scene" />
            <!-- For presets, show color badge instead of icon -->
            <q-badge v-else-if="showColorBadge" :style="badgeStyle" round />
            <svgIcon v-else name="star_outlined" />
          </q-item-section>
        </q-item>
      </q-card-section>

      <!-- Progress mode with modal circular progress -->
      <template v-else>
        <q-card-section class="text-center q-pa-lg">
          <div class="text-h6 q-mb-md">Deleting {{ itemTypeCapitalized }}</div>
          <q-circular-progress
            v-if="progress.total === 0"
            indeterminate
            size="80px"
            :thickness="0.15"
            color="negative"
            class="q-mb-md"
          />
          <q-circular-progress
            v-else
            :value="(progress.completed / progress.total) * 100"
            size="80px"
            :thickness="0.15"
            color="negative"
            track-color="grey-3"
            class="q-mb-md"
          />
          <div v-if="progress.total === 0" class="text-subtitle2 q-mb-xs">
            Preparing to delete...
          </div>
          <div v-else class="text-subtitle2 q-mb-xs">
            {{ progress.completed }} / {{ progress.total }} controllers updated
          </div>
          <div class="text-caption text-grey-6">
            Please wait while "{{ item.name }}" is being deleted...
          </div>
        </q-card-section>
      </template>

      <!-- Buttons - different based on mode -->
      <q-card-actions align="right">
        <template v-if="!isDeleting">
          <q-btn
            flat
            label="Cancel"
            color="primary"
            @click="onDialogCancel()"
          />
          <q-btn
            flat
            label="Delete"
            color="negative"
            @click="startDelete()"
            :disabled="!!blockingCondition"
          />
        </template>
        <!-- No buttons needed in progress mode - closes automatically when complete -->
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script>
import { ref, computed } from "vue";
import { colors } from "quasar";
import { useDialogPluginComponent } from "quasar";
import { useAppDataStore } from "src/stores/appDataStore";
import { useControllersStore } from "src/stores/controllersStore";
import {
  deletePreset as deletePresetUtil,
  deleteScene as deleteSceneUtil,
  deleteGroup as deleteGroupUtil,
} from "src/services/saveDelete";

const { hsvToRgb } = colors;

export default {
  name: "deleteItemDialog",
  props: {
    item: {
      type: Object,
      required: true,
    },
    itemType: {
      type: String,
      required: true,
      validator: (val) => ["preset", "scene", "group"].includes(val),
    },
    blockingCondition: {
      type: Object,
      default: null,
      // { message: String, count: Number }
    },
  },
  emits: [...useDialogPluginComponent.emits],
  setup(props) {
    const { dialogRef, onDialogHide, onDialogOK, onDialogCancel } =
      useDialogPluginComponent();

    const appData = useAppDataStore();
    const controllers = useControllersStore();
    const isDeleting = ref(false);
    const progress = ref({
      completed: 0,
      total: 0,
    });

    const itemTypeCapitalized = computed(() => {
      return props.itemType.charAt(0).toUpperCase() + props.itemType.slice(1);
    });

    const progressToolbarClass = computed(() => {
      return `bg-negative text-white`;
    });

    const progressValue = computed(() => {
      if (progress.value.total === 0) return 0;
      return progress.value.completed / progress.value.total;
    });

    // Only applicable for presets that have color data
    const showColorBadge = computed(() => {
      return (
        props.itemType === "preset" &&
        (props.item.color?.hsv || props.item.color?.raw)
      );
    });

    // The progress update function
    const updateProgress = (completed, total) => {
      console.log(`DeleteItemDialog progress update: ${completed}/${total}`);
      progress.value.completed = completed;
      progress.value.total = total;

      // Auto-close dialog when complete
      if (completed === total && total > 0) {
        setTimeout(() => {
          onDialogCancel();
        }, 800);
      }
    };

    // Function to start the delete operation
    const startDelete = async () => {
      try {
        // Safety check - don't allow deletion if there's a blocking condition
        if (props.blockingCondition) {
          return;
        }

        isDeleting.value = true;

        // Initialize with total controllers
        const total = controllers.data.length;
        updateProgress(0, total);

        // Call the appropriate utility function based on item type
        switch (props.itemType) {
          case "preset":
            await deletePresetUtil(appData, props.item, updateProgress);
            break;
          case "scene":
            await deleteSceneUtil(appData, props.item, updateProgress);
            break;
          case "group":
            await deleteGroupUtil(appData, props.item, updateProgress);
            break;
          default:
            console.error("Unknown item type:", props.itemType);
            onDialogCancel();
        }
      } catch (error) {
        console.error(`Error deleting ${props.itemType}:`, error);
        onDialogCancel(); // Close on error
      }
    };

    const badgeStyle = computed(() => {
      if (props.itemType !== "preset") return {};

      if (props.item.color?.hsv) {
        const { r, g, b } = hsvToRgb(props.item.color.hsv);
        return {
          backgroundColor: `rgb(${r}, ${g}, ${b})`,
          width: "30px",
          height: "30px",
          borderRadius: "50%",
          border: "1px solid black",
        };
      } else if (props.item.color?.raw) {
        const { r, g, b } = props.item.color.raw;
        if (r !== undefined && g !== undefined && b !== undefined) {
          return {
            backgroundColor: `rgb(${r}, ${g}, ${b})`,
            width: "30px",
            height: "30px",
            borderRadius: "50%",
            border: "1px solid black",
          };
        }
      }
      return {
        backgroundColor: "#ccc",
        width: "30px",
        height: "30px",
        borderRadius: "50%",
        border: "1px solid black",
      };
    });

    return {
      dialogRef,
      onDialogHide,
      onDialogCancel,
      badgeStyle,
      progress,
      progressValue,
      isDeleting,
      startDelete,
      itemTypeCapitalized,
      progressToolbarClass,
      showColorBadge,
    };
  },
};
</script>
