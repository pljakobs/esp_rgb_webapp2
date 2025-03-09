<template>
  <q-dialog ref="dialogRef" @hide="onDialogHide">
    <q-card class="q-dialog-plugin">
      <q-toolbar class="bg-primary text-white">
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
      <q-card-actions align="right">
        <q-btn flat label="Cancel" color="primary" @click="onCancelClick" />
        <q-btn flat label="Save" color="primary" @click="onSaveClick" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script>
import { ref, computed, watch } from "vue";
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
  },
  emits: ["close", "save", ...useDialogPluginComponent.emits],
  setup(props, { emit }) {
    const { dialogRef, onDialogHide, onDialogOK, onDialogCancel } =
      useDialogPluginComponent();
    const controllersStore = useControllersStore();
    const appData = useAppDataStore();
    const infoData = infoDataStore();
    const groupName = ref("");
    const internalSelectedControllers = ref([]);
    const isEditMode = computed(() => !!props.group);

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
      const value = internalSelectedControllers.value.includes(
        String(controllerId),
      );
      return value;
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

    const onSaveClick = async () => {
      if (internalSelectedControllers.value.length != 0) {
        const newGroup = {
          name: groupName.value,
          group_id: isEditMode.value ? props.group.group_id : makeID(),
          controller_ids: internalSelectedControllers.value,
        };
        console.log("new group", newGroup);
        await appData.saveGroup(newGroup);
        emit("ok", newGroup);
        onDialogOK();
      } else {
        alert("Please select at least one controller to create a group");
      }
    };

    const onCancelClick = () => {
      onDialogCancel();
    };

    watch(
      () => props.group,
      (newGroup) => {
        if (newGroup) {
          groupName.value = newGroup.name;
          internalSelectedControllers.value = newGroup.controller_ids;
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
      onSaveClick,
      groupName,
      controllersList,
      internalSelectedControllers,
      isControllerSelected,
      updateSelectedControllers,
      isEditMode,
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
