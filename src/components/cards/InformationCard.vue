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
            <!-- Runtime section: fields on the left, heap sparkline on the right -->
            <div
              v-if="key === 'runtime'"
              class="section-body runtime-section"
              style="grid-column: 1 / -1"
            >
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
              <div v-if="heapHistory.length > 1" class="heap-sparkline-wrap">
                <div class="heap-sparkline-label">Free Heap (30 min)</div>
                <svg
                  class="heap-sparkline"
                  viewBox="0 0 400 120"
                  preserveAspectRatio="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <polyline
                    :points="sparklinePoints"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.5"
                    stroke-linejoin="round"
                    stroke-linecap="round"
                    class="sparkline-line"
                  />
                  <circle
                    v-if="sparklineDot"
                    :cx="sparklineDot.x"
                    :cy="sparklineDot.y"
                    r="2.5"
                    class="sparkline-dot"
                  />
                </svg>
                <div class="heap-sparkline-minmax">
                  <span>{{ formatHeap(heapMin) }}</span>
                  <span>{{ formatHeap(heapMax) }}</span>
                </div>
              </div>
            </div>
            <!-- All other nested sections -->
            <div v-else class="section-body" style="grid-column: 1 / -1">
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
import { onUnmounted, ref, watch, computed } from "vue";
import { infoDataStore } from "src/stores/infoDataStore";
import MyCard from "src/components/myCard.vue";

// 30 min @ 5 s poll interval = 360 samples max
const MAX_HEAP_SAMPLES = 360;
const SPARKLINE_W = 400;
const SPARKLINE_H = 120;
const SPARKLINE_PAD = 4; // px padding inside viewBox

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

    // ── heap history ─────────────────────────────────────────────────────────
    // Each entry: { ts: Date.now(), val: number }
    const heapHistory = ref([]);

    function pruneHeapHistory() {
      const cutoff = Date.now() - 30 * 60 * 1000;
      const idx = heapHistory.value.findIndex((e) => e.ts >= cutoff);
      if (idx > 0) heapHistory.value.splice(0, idx);
    }

    function recordHeap(val) {
      if (typeof val !== "number" || isNaN(val)) return;
      heapHistory.value.push({ ts: Date.now(), val });
      if (heapHistory.value.length > MAX_HEAP_SAMPLES) {
        heapHistory.value.shift();
      }
      pruneHeapHistory();
    }

    const heapMin = computed(() =>
      heapHistory.value.length
        ? Math.min(...heapHistory.value.map((e) => e.val))
        : 0,
    );
    const heapMax = computed(() =>
      heapHistory.value.length
        ? Math.max(...heapHistory.value.map((e) => e.val))
        : 1,
    );

    const sparklinePoints = computed(() => {
      const h = heapHistory.value;
      if (h.length < 2) return "";
      const n = h.length;
      const minV = heapMin.value;
      const range = heapMax.value - minV || 1;
      const usableW = SPARKLINE_W - 2 * SPARKLINE_PAD;
      const usableH = SPARKLINE_H - 2 * SPARKLINE_PAD;
      return h
        .map((e, i) => {
          const x = SPARKLINE_PAD + (i / (n - 1)) * usableW;
          const y =
            SPARKLINE_PAD + (1 - (e.val - minV) / range) * usableH;
          return `${x.toFixed(1)},${y.toFixed(1)}`;
        })
        .join(" ");
    });

    const sparklineDot = computed(() => {
      const h = heapHistory.value;
      if (h.length < 2) return null;
      const last = h[h.length - 1];
      const minV = heapMin.value;
      const range = heapMax.value - minV || 1;
      const usableW = SPARKLINE_W - 2 * SPARKLINE_PAD;
      const usableH = SPARKLINE_H - 2 * SPARKLINE_PAD;
      return {
        x: +(SPARKLINE_PAD + usableW).toFixed(1),
        y: +(SPARKLINE_PAD + (1 - (last.val - minV) / range) * usableH).toFixed(1),
      };
    });

    function formatHeap(bytes) {
      if (bytes >= 1024) return (bytes / 1024).toFixed(1) + " KB";
      return bytes + " B";
    }

    // ── data polling ─────────────────────────────────────────────────────────
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

    // Record heap whenever the info store updates
    watch(
      () => infoData.data?.runtime?.heap_free,
      (val) => {
        if (val !== undefined && val !== null) recordHeap(Number(val));
      },
    );

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

    // ── helpers ───────────────────────────────────────────────────────────────
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
        if (typeof value === "string" && value.trim()) return value;
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
      heapHistory,
      heapMin,
      heapMax,
      sparklinePoints,
      sparklineDot,
      formatHeap,
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

/* Runtime section: info grid on the left, sparkline on the right */
.runtime-section {
  display: flex;
  flex-direction: row;
  gap: 16px;
  align-items: flex-start;
  padding-left: 12px;
}

.runtime-section .info-rows {
  flex: 1 1 auto;
  min-width: 0;
}

/* Sparkline panel */
.heap-sparkline-wrap {
  flex: 0 0 auto;
  width: 240px;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 2px;
}

.heap-sparkline-label {
  font-size: 0.68em;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  opacity: 0.55;
  text-align: center;
}

.heap-sparkline {
  width: 100%;
  height: 120px;
  overflow: visible;
}

.sparkline-line {
  opacity: 0.8;
}

.sparkline-dot {
  fill: currentColor;
}

.heap-sparkline-minmax {
  display: flex;
  justify-content: space-between;
  font-size: 0.65em;
  opacity: 0.55;
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
