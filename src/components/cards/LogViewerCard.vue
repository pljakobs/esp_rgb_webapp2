<template>
  <MyCard icon="article" title="Log Viewer">
    <q-card-section class="row justify-center no-padding">
      <div class="log-viewer">
        <div v-for="(log, index) in logs" :key="index" class="log-line">
          <span class="log-timestamp">{{ log.time }}</span>
          <span class="log-location" v-if="log.location"
            >[{{ log.location }}]</span
          ><br />
          <span class="log-message">{{ log.message }}</span>
        </div>
      </div>
    </q-card-section>
    <q-card-section class="row justify-center no-padding">
      <q-btn @click="downloadLogFile" label="Download Log" color="primary" />
    </q-card-section>
  </MyCard>
</template>

<script>
import { logStore } from "src/services/logServices";
import MyCard from "src/components/myCard.vue";

export default {
  name: "LogViewerCard",
  components: {
    MyCard,
  },
  setup() {
    const downloadLogFile = () => {
      const logContent = logStore.logs
        .map((log) => JSON.stringify(log))
        .join("\n");
      const blob = new Blob([logContent], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "Lightinator_log.txt";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    };

    return {
      logs: logStore.logs,
      downloadLogFile,
    };
  },
};
</script>

<style scoped>
.log-viewer {
  padding: 20px;
  background-color: #505050;
  border-radius: 5px;
  max-height: 400px; /* Set a maximum height for the log viewer */
  max-width: 100%; /* Set a maximum width for the log viewer */
  overflow: auto; /* Enable scrolling in both directions */
}

.log-line {
  margin-bottom: 10px;
  font-family: monospace;
  white-space: nowrap; /* Prevent log lines from wrapping */
}

.log-timestamp {
  color: blue;
  margin-right: 5px;
}

.log-location {
  color: black;
  margin-right: 5px;
}

.log-message {
  color: white;
}
</style>
