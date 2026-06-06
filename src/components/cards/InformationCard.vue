<template>
  <MyCard
    v-model:collapsed="cardCollapsed"
    title="System Information"
    icon="info_outlined"
  >
    <q-card-section v-if="!infoData.data" class="text-caption text-grey">
      No data available.
    </q-card-section>
    <q-card-section v-else class="info-section">
      <div class="info-rows">
        <template v-for="(value, key) in infoData.data" :key="key">
          <!-- Nested object → sub-section (spans both columns) -->
          <template v-if="isObject(value) && !isFirmwareCommentKey(key)">
            <div class="section-header" style="grid-column: 1 / -1">{{ formatKey(key) }}</div>
            <div class="section-body" style="grid-column: 1 / -1">
              <div class="info-rows">
                <div
                  v-for="(subVal, subKey) in value"
                  :key="subKey"
                  class="info-row"
                >
                  <span class="info-label">{{ formatKey(subKey) }}</span>
                  <span class="info-value">{{ subVal }}</span>
                </div>
              </div>
            </div>
          </template>
          <!-- Scalar → plain row -->
          <div v-else-if="!isFirmwareCommentKey(key)" class="info-row">
            <span class="info-label">{{ formatKey(key) }}</span>
            <span class="info-value">{{ value }}</span>
          </div>
        </template>
      </div>

      <div v-if="firmwareComment" class="firmware-comment-container">
        <div class="section-header">Firmware Comment</div>
        <div class="firmware-comment-block">{{ firmwareComment }}</div>
      </div>
    </q-card-section>
  </MyCard>
</template>

<script>
import { onUnmounted, ref, watch } from "vue";
import { computed } from "vue";
import { infoDataStore } from "src/stores/infoDataStore";
import MyCard from "src/components/myCard.vue";

export default {
  props: {
    collapsed: {
      type: Boolean,
      default: true,
    },
  },
  components: { MyCard },
  setup(props) {
    const infoData = infoDataStore();
    const cardCollapsed = ref(props.collapsed);
    let refreshInterval = null;

    async function refreshInfo() {
      try {
        await infoData.fetchData();
      } catch (error) {
        console.error("error refreshing system information:", error);
      }
    }

    function stopRefreshLoop() {
      if (refreshInterval) {
        clearInterval(refreshInterval);
        refreshInterval = null;
      }
    }

    function startRefreshLoop() {
      stopRefreshLoop();
      refreshInfo();
      refreshInterval = setInterval(() => {
        refreshInfo();
      }, 5000);
    }

    watch(
      () => props.collapsed,
      (collapsed) => {
        cardCollapsed.value = collapsed;
      },
    );

    watch(
      cardCollapsed,
      (collapsed) => {
        if (collapsed) {
          stopRefreshLoop();
          return;
        }

        startRefreshLoop();
      },
      { immediate: true },
    );

    onUnmounted(() => {
      stopRefreshLoop();
    });

    const firmwareCommentKeys = ["firmware_comment", "fw_comment", "comment"];

    function formatKey(key) {
      return String(key)
        .replace(/_/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());
    }

    function isObject(val) {
      return val !== null && typeof val === "object" && !Array.isArray(val);
    }

    function isFirmwareCommentKey(key) {
      return firmwareCommentKeys.includes(String(key));
    }

    const firmwareComment = computed(() => {
      if (!infoData.data) return "";

      for (const key of firmwareCommentKeys) {
        const value = infoData.data[key];
        if (typeof value === "string" && value.trim()) {
          return value;
        }
      }

      return "";
    });

    return {
      infoData,
      cardCollapsed,
      formatKey,
      isObject,
      isFirmwareCommentKey,
      firmwareComment,
    };
  },
};
</script>

<style scoped>
.info-section {
  padding: 8px 5%;
}

.info-rows {
  display: grid;
  grid-template-columns: max-content 1fr;
  column-gap: 12px;
}

.info-row {
  display: contents;
}

.info-label {
  font-weight: 500;
  color: var(--field-label-color, inherit);
  padding: 2px 0;
  white-space: nowrap;
}

.info-value {
  color: var(--field-value-color, inherit);
  word-break: break-all;
  padding: 2px 0;
}

.section-header {
  margin-top: 10px;
  margin-bottom: 2px;
  font-size: 0.78em;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  opacity: 0.6;
  border-bottom: 1px solid currentColor;
}

.section-body {
  padding-left: 12px;
}

.firmware-comment-container {
  margin-top: 12px;
}

.firmware-comment-block {
  margin-top: 6px;
  padding: 8px;
  border: 1px solid var(--table-border-color, rgba(0, 0, 0, 0.2));
  border-radius: 6px;
  white-space: pre-wrap;
  max-height: 180px;
  overflow-y: auto;
}
</style>
