<template>
  <MyCard title="System Information" icon="info_outlined">
    <q-card-section v-if="!infoData.data" class="text-caption text-grey">
      No data available.
    </q-card-section>
    <q-card-section v-else class="info-section">
      <template v-for="(value, key) in infoData.data" :key="key">
        <!-- Nested object → sub-section -->
        <template v-if="isObject(value) && !isFirmwareCommentKey(key)">
          <div class="section-header">{{ formatKey(key) }}</div>
          <div class="section-body">
            <div
              v-for="(subVal, subKey) in value"
              :key="subKey"
              class="info-row"
            >
              <span class="info-label">{{ formatKey(subKey) }}</span>
              <span class="info-value">{{ subVal }}</span>
            </div>
          </div>
        </template>
        <!-- Scalar → plain row -->
        <div v-else-if="!isFirmwareCommentKey(key)" class="info-row">
          <span class="info-label">{{ formatKey(key) }}</span>
          <span class="info-value">{{ value }}</span>
        </div>
      </template>

      <div v-if="firmwareComment" class="firmware-comment-container">
        <div class="section-header">Firmware Comment</div>
        <div class="firmware-comment-block">{{ firmwareComment }}</div>
      </div>
    </q-card-section>
  </MyCard>
</template>

<script>
import { computed } from "vue";
import { infoDataStore } from "src/stores/infoDataStore";
import MyCard from "src/components/myCard.vue";

export default {
  components: { MyCard },
  setup() {
    const infoData = infoDataStore();

    const firmwareCommentKeys = [
      "firmware_comment",
      "fw_comment",
      "comment",
    ];

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

.info-row {
  display: flex;
  align-items: baseline;
  padding: 2px 0;
}

.info-label {
  min-width: 160px;
  font-weight: 500;
  color: var(--field-label-color, inherit);
  flex-shrink: 0;
}

.info-value {
  color: var(--field-value-color, inherit);
  word-break: break-all;
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
