<template>
  <MyCard icon="article" title="view log">
    <q-card-section class="row justify-center no-padding">
      <div class="log-viewer">
        <h2>Log Viewer</h2>
        <div v-for="(log, index) in logs" :key="index" class="log-line">
          {{ log }}
        </div>
      </div>
    </q-card-section>
  </MyCard>
</template>

<script>
import { logStore } from "src/services/logServices";
import MyCard from "src/components/myCard.vue";

export default {
  name: "LogViewer",
  components: {
    MyCard,
  },
  setup() {
    return {
      logs: logStore.logs,
    };
  },
};
</script>

<style scoped>
.log-viewer {
  padding: 20px;
  background-color: #f0f0f0;
  border-radius: 5px;
}

.log-line {
  margin-bottom: 10px;
  font-family: monospace;
}
</style>
