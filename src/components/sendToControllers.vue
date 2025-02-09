<template>
  <q-dialog :model-value="dialog" @update:model-value="updateDialog">
    <q-card class="adaptive-card">
      <q-card-section>
        <div class="text-h6">Select Controllers</div>
      </q-card-section>

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
                  v-model="selectedControllers"
                  :val="controller.id"
                  @update:model-value="updateSelectedControllers"
                />
              </q-item-section>
              <q-item-section>
                {{ controller.name }}
              </q-item-section>
            </q-item>
          </q-list>
        </q-scroll-area>
      </q-card-section>

      <q-card-actions align="right">
        <q-btn flat label="Cancel" color="primary" @click="cancelSelection" />
        <q-btn
          flat
          label="Send Preset"
          color="primary"
          @click="confirmSelection"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script>
import { ref, computed } from "vue";
import { controllersStore } from "src/stores/controllersStore";
import { infoDataStore } from "src/stores/infoDataStore";

export default {
  name: "sendToControllers",
  props: {
    dialog: {
      type: Boolean,
      required: true,
    },
  },
  setup(props, { emit }) {
    const store = controllersStore();
    const infoData = infoDataStore();
    const selectedControllers = ref([]);

    const controllersList = computed(() => {
      try {
        const controllers = store.data;
        const localDeviceId = infoData.data.deviceid;
        console.log("controllers from store:", controllers); // Debugging log
        console.log("local device id:", localDeviceId); // Debugging log
        if (!controllers) {
          return [];
        }
        const options = controllers
          .filter((controller) => {
            console.log(
              "Filtering controller:",
              String(controller.id),
              "localDeviceId:",
              localDeviceId,
            ); // Debugging log
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
        console.log("controllersList:", JSON.stringify(options)); // Debugging log
        return options;
      } catch (error) {
        console.error("Error computing controllersList:", error);
        return [];
      }
    });

    const updateDialog = (value) => {
      try {
        emit("update:dialog", value);
      } catch (error) {
        console.error("Error updating dialog:", error);
      }
    };

    const cancelSelection = () => {
      try {
        emit("update:dialog", false);
      } catch (error) {
        console.error("Error canceling selection:", error);
      }
    };

    const confirmSelection = () => {
      try {
        emit("update:dialog", false);
        emit("confirm", selectedControllers.value);
      } catch (error) {
        console.error("Error confirming selection:", error);
      }
    };

    const updateSelectedControllers = (value) => {
      selectedControllers.value = value;
    };

    return {
      selectedControllers,
      controllersList,
      updateDialog,
      cancelSelection,
      confirmSelection,
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
margin-right: 20px; padding-right: 20px;
