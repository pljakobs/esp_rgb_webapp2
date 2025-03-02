<template>
  <q-dialog ref="dialogRef" @hide="onDialogHide">
    <q-card class="q-dialog-plugin">
      <q-toolbar class="bg-primary text-white">
        <q-toolbar-title>Add Group</q-toolbar-title>
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
                  :model-value="
                    internalSelectedControllers.includes(controller.id)
                  "
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
        <q-btn flat label="Save" color="primary" @click="saveGroup" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script>
import { ref, computed } from "vue";
import { useControllersStore } from "src/stores/controllersStore";
import { infoDataStore } from "src/stores/infoDataStore";
import { useDialogPluginComponent } from "quasar";
import { makeID } from "src/services/tools";

export default {
  name: "addGroupDialog",
  emits: ["close", "save", ...useDialogPluginComponent.emits],
  setup(_, { emit }) {
    const { dialogRef, onDialogHide, onDialogOK, onDialogCancel } =
      useDialogPluginComponent();
    const controllersStore = useControllersStore();
    const infoData = infoDataStore();
    const groupName = ref("");
    const internalSelectedControllers = ref([]);

    const controllersList = computed(() => {
      try {
        const controllers = controllersStore.data;
        const localDeviceId = infoData.data.deviceid;
        if (!controllers) {
          return [];
        }
        const options = controllers
          .filter((controller) => {
            return (
              controller.id !== undefined &&
              String(controller.id) !== localDeviceId
            );
          })
          .map((controller) => ({
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

    const updateSelectedControllers = (controllerId, isSelected) => {
      const updatedControllers = isSelected
        ? [...internalSelectedControllers.value, controllerId]
        : internalSelectedControllers.value.filter((id) => id !== controllerId);
      internalSelectedControllers.value = updatedControllers;
    };

    const saveGroup = () => {
      if (internalSelectedControllers.value.length != 0) {
        const newGroup = {
          name: groupName.value,
          group_id: makeID(),
          controller_ids: internalSelectedControllers.value,
        };
        console.log("new group", newGroup);
        emit("ok", newGroup);
      } else {
        alert("Please select at least one controller to create a group");
      }
    };

    const onCancelClick = () => {
      onDialogCancel();
    };

    return {
      dialogRef,
      onDialogHide,
      onCancelClick,
      saveGroup,
      groupName,
      controllersList,
      internalSelectedControllers,
      updateSelectedControllers,
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
