<template>
  <MyCard icon="save_outlined" title="save / restore configuration">
    <q-card-section>
      <div class="button-group">
        <q-btn
          color="primary"
          class="q-mt-lg button"
          @click="saveConfig"
          no-caps
        >
          <div class="row items-center no-wrap q-gutter-sm">
            <svgIcon name="cloud_download" size="20px" />
            <span>Save</span>
          </div>
        </q-btn>
        <q-btn
          color="primary"
          class="q-mt-lg button"
          @click="openFileSelector"
          no-caps
        >
          <div class="row items-center no-wrap q-gutter-sm">
            <svgIcon name="cloud_upload" size="20px" />
            <span>Restore</span>
          </div>
        </q-btn>
      </div>
      <input
        type="file"
        ref="fileInput"
        @change="handleFileChange"
        accept=".json"
        style="display: none"
      />
      <div v-if="fileContent" class="scrollable-text">
        <pre>{{ fileContent }}</pre>
        <q-btn
          label="Upload Configuration"
          color="primary"
          class="q-mt-md"
          @click="uploadConfig"
        />
      </div>
    </q-card-section>
  </MyCard>
</template>

<script>
import { ref } from "vue";
import { useControllersStore } from "src/stores/controllersStore";
import { configDataStore } from "src/stores/configDataStore";
import MyCard from "src/components/myCard.vue";

export default {
  components: {
    MyCard,
  },
  setup() {
    const controllers = useControllersStore();
    const configData = configDataStore();
    const fileInput = ref(null);
    const fileContent = ref("");

    const saveConfig = async () => {
      console.log("saveConfig");
      try {
        const deviceName = configData.data.general.device_name || "Lightinator";
        console.log("deviceName", deviceName);
        const datetime = new Date().toISOString().replace(/[:.]/g, "-");
        console.log("datetime", datetime);
        const defaultFilename = `${deviceName}_${datetime}.json`;
        console.log("defaultFilename", defaultFilename);
        const filename = prompt("Enter filename", defaultFilename);
        if (!filename) {
          return; // User cancelled the prompt
        }

        const response = await fetch(
          `http://${controllers.currentController.ip_address}/config`,
        );
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const currentConfig = await response.json();
        const blob = new Blob([JSON.stringify(currentConfig, null, 2)], {
          type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch (error) {
        console.log("Error saving configuration:", error);
      }
    };

    const openFileSelector = () => {
      fileInput.value.click();
    };

    const handleFileChange = (event) => {
      const file = event.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          fileContent.value = e.target.result;
        };
        reader.readAsText(file);
      }
    };

    const uploadConfig = async () => {
      try {
        const response = await fetch(
          `http://${controllers.currentController.ip_address}/config`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: fileContent.value,
          },
        );
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        console.log("Configuration uploaded successfully!");
      } catch (error) {
        console.error("Error uploading configuration:", error);
      }
    };

    return {
      saveConfig,
      openFileSelector,
      handleFileChange,
      uploadConfig,
      configData,
      fileInput,
      fileContent,
    };
  },
};
</script>

<style scoped>
.q-icon {
  font-size: 2.5em;
}
.scrollable-text {
  max-height: 200px;
  overflow-y: auto;
  background-color: var(--background-color);
  padding: 10px;
  border: 1px solid #ddd;
  margin-top: 10px;
}
.scrollable-text pre {
  background-color: var(--background-color);
  color: var(--field-value-color);
}
.button-group {
  display: flex;
  justify-content: space-between;
}
.button {
  flex: 1;
  margin: 0 5px;
}
</style>
