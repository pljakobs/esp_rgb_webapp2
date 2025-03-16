<template>
  <q-dialog ref="dialogRef" @hide="onDialogHide" persistent>
    <q-card class="q-dialog-plugin">
      <!-- Confirmation mode -->
      <q-card-section v-if="!isDeleting">
        <q-item>
          <q-item-section>
            <q-item-label class="text-h6">Delete Preset</q-item-label>
            <q-item-label
              >Are you sure you want to delete "{{
                preset.name
              }}"?</q-item-label
            >
          </q-item-section>
          <q-item-section avatar v-if="preset.color" side>
            <q-badge :style="badgeStyle" round />
          </q-item-section>
        </q-item>
      </q-card-section>

      <!-- Progress mode -->
      <template v-else>
        <q-toolbar class="bg-negative text-white">
          <q-toolbar-title>Deleting Preset...</q-toolbar-title>
          <q-badge v-if="preset.color" :style="badgeStyle" round />
        </q-toolbar>

        <q-card-section>
          <div class="text-center q-mb-md">
            <p>Deleting "{{ preset.name }}" from all controllers</p>
          </div>

          <q-linear-progress
            :value="progressValue"
            color="negative"
            size="md"
            :indeterminate="progress.total === 0"
          />
          <div class="text-center q-mt-sm">
            {{ progress.completed }} of {{ progress.total }} controllers
            processed
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
          <q-btn flat label="Delete" color="negative" @click="startDelete()" />
        </template>
        <!-- No buttons needed in progress mode - closes automatically when complete -->
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script>
import { ref, computed, onMounted } from "vue";
import { colors } from "quasar";
import { useDialogPluginComponent } from "quasar";
import { useAppDataStore } from "src/stores/appDataStore";
import { useControllersStore } from "src/stores/controllersStore";

const { hsvToRgb } = colors;

export default {
  name: "deletePresetDialog",
  props: {
    preset: {
      type: Object,
      required: true,
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

    const progressValue = computed(() => {
      if (progress.value.total === 0) return 0;
      return progress.value.completed / progress.value.total;
    });

    // The progress update function
    const updateProgress = (completed, total) => {
      console.log(`DeletePresetDialog progress update: ${completed}/${total}`);
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
        isDeleting.value = true;

        // Initialize with total controllers
        const total = controllers.data.length;
        updateProgress(0, total);

        // Call the store's delete method with our local update function
        await appData.deletePreset(props.preset, updateProgress);
      } catch (error) {
        console.error("Error deleting preset:", error);
        onDialogCancel(); // Close on error
      }
    };

    const badgeStyle = computed(() => {
      if (props.preset.color?.hsv) {
        const { r, g, b } = hsvToRgb(props.preset.color.hsv);
        return {
          backgroundColor: `rgb(${r}, ${g}, ${b})`,
          width: "30px",
          height: "30px",
          borderRadius: "50%",
          border: "1px solid black",
        };
      } else if (props.preset.color?.raw) {
        const { r, g, b } = props.preset.color.raw;
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
    };
  },
};
</script>
