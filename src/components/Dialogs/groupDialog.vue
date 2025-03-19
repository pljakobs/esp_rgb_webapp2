<template>
  <q-dialog ref="dialogRef" @hide="onDialogHide">
    <q-card class="q-dialog-plugin">
      <q-toolbar :class="toolbarClass">
        <q-toolbar-title>{{
          isEditMode ? "Edit Group" : "Add Group"
        }}</q-toolbar-title>
      </q-toolbar>

      <q-card-section class="scroll-area-container">
        <q-scroll-area class="inset-scroll-area">
          <q-list>
            <q-item
              v-for="controller in controllersList"
              :key="controller.id"
              clickable
              v-ripple
            >
              <q-item-section avatar>
                <q-checkbox
                  :model-value="isControllerSelected(controller.id)"
                  @update:model-value="
                    updateSelectedControllers(controller.id, $event)
                  "
                />
              </q-item-section>
              <q-item-section>
                {{ controller.name }}
              </q-item-section>
            </q-item>
          </q-list>
        </q-scroll-area>
      </q-card-section>

      <q-card-section>
        <q-input v-model="groupName" label="Group Name" filled autofocus />
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
        <q-btn
          color="primary"
          flat
          label="Cancel"
          @click="onCancelClick"
          :disable="saving"
        />
        <q-btn
          color="primary"
          label="Save"
          @click="onOKClick"
          :loading="saving"
          :disable="isSaveDisabled"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script>
import { ref, computed, watch, nextTick } from "vue";
import { useControllersStore } from "src/stores/controllersStore";
import { useAppDataStore } from "src/stores/appDataStore";
import { infoDataStore } from "src/stores/infoDataStore";
import { useDialogPluginComponent } from "quasar";
import { makeID } from "src/services/tools";

export default {
  name: "groupDialog",
  props: {
    group: {
      type: Object,
      default: null,
    },
    // Add saveInProgress prop to control the dialog from parent
    saveInProgress: {
      type: Boolean,
      default: false,
    },
  },
  emits: ["ok", "hide", "cancel", ...useDialogPluginComponent.emits],
  setup(props, { emit }) {
    const { dialogRef, onDialogHide, onDialogOK, onDialogCancel } =
      useDialogPluginComponent();
    const controllersStore = useControllersStore();
    const appData = useAppDataStore();
    const infoData = infoDataStore();
    const groupName = ref("");
    const internalSelectedControllers = ref([]);
    const isEditMode = computed(() => !!props.group);
    const progress = ref({ completed: 0, total: 0 });
    const groupExists = ref(false);
    const saving = ref(false);

    // Watch external saveInProgress prop
    watch(
      () => props.saveInProgress,
      (val) => {
        saving.value = val;
      },
    );

    const controllersList = computed(() => {
      try {
        const controllers = controllersStore.data;
        const localDeviceId = infoData.data.deviceid;
        if (!controllers) {
          return [];
        }
        const options = controllers.map((controller) => ({
          address: controller.ip_address,
          name: controller.hostname,
          id: controller.id,
        }));
        return options;
      } catch (error) {
        console.error("Error computing controllersList:", error);
        return [];
      }
    });

    const isControllerSelected = (controllerId) => {
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

    // Modified to work with async operations
    const onOKClick = () => {
      if (internalSelectedControllers.value.length === 0) {
        alert("Please select at least one controller to create a group");
        return;
      }

      // Set saving state
      saving.value = true;

      // Create the group object
      const newGroup = {
        name: groupName.value,
        id: isEditMode.value ? props.group.id : makeID(),
        controller_ids: internalSelectedControllers.value,
        ts: Date.now(),
      };

      // Create progress update callback
      const updateProgress = (completed, total) => {
        console.log(`Updating progress: ${completed}/${total}`);
        // Use nextTick to ensure Vue updates the UI
        nextTick(() => {
          progress.value = { completed, total };
          // Emit progress for anyone listening
          emit("progress", { completed, total });
        });
      };

      // Add completion callback to the emitted group
      const result = {
        ...newGroup,
        // Function parent will call when save is complete
        saveComplete: () => {
          console.log("saveComplete called, closing dialog");
          saving.value = false;
          // Directly hide the dialog instead of calling onDialogOK
          dialogRef.value.hide();
        },
        // Progress reporting callback
        updateProgress,
      };

      // Emit the enhanced result for the parent component
      emit("ok", result);
    };

    const onCancelClick = () => {
      // Only allow cancel if not currently saving
      if (!saving.value) {
        onDialogCancel();
      }
    };

    const isSaveDisabled = computed(() => {
      const hasNoName = groupName.value.trim() === "";
      const hasNoControllers = internalSelectedControllers.value.length === 0;
      return hasNoName || hasNoControllers || saving.value;
    });

    const verifyGroupName = () => {
      if (!appData.data?.groups) return;

      const existingGroup = appData.data.groups.find(
        (g) =>
          g.name === groupName.value &&
          (!isEditMode.value || g.id !== props.group?.id),
      );
      groupExists.value = !!existingGroup;
    };

    const toolbarClass = computed(() => {
      return groupExists.value
        ? "bg-warning text-dark"
        : "bg-primary text-white";
    });

    watch(groupName, verifyGroupName);

    watch(
      () => props.group,
      (newGroup) => {
        if (newGroup) {
          groupName.value = newGroup.name;
          internalSelectedControllers.value = [...newGroup.controller_ids];
        } else {
          groupName.value = "";
          internalSelectedControllers.value = [];
        }
      },
      { immediate: true },
    );

    return {
      dialogRef,
      onDialogHide,
      onCancelClick,
      onOKClick,
      groupName,
      controllersList,
      internalSelectedControllers,
      isControllerSelected,
      updateSelectedControllers,
      isEditMode,
      progress,
      isSaveDisabled,
      groupExists,
      toolbarClass,
      saving,
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

.scroll-area-container {
  margin: 10px;
  margin-right: 20px;
}

.inset-scroll-area {
  height: 300px;
  width: 100%;
  max-width: 400px;
  box-shadow: inset 0 0 10px rgba(255, 255, 255, 0.1);
  margin: 10px;
}
</style>
