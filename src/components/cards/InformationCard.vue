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
            <div class="section-header" style="grid-column: 1 / -1">
              {{ formatKey(key) }}
            </div>
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
                  <span class="info-value">{{
                    formatRuntimeValue(subKey, subVal)
                  }}</span>
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
                  <line
                    v-for="line in heapTimeGrid"
                    :key="`time-${line.minutes}`"
                    :x1="line.x"
                    y1="4"
                    :x2="line.x"
                    y2="116"
                    class="sparkline-grid-line"
                  />
                  <line
                    v-if="minfreeHeapLine"
                    x1="4"
                    :y1="minfreeHeapLine.y"
                    x2="396"
                    :y2="minfreeHeapLine.y"
                    class="sparkline-threshold"
                  />
                  <template
                    v-for="(segment, index) in sparklineSegments"
                    :key="`segment-${index}`"
                  >
                    <polygon
                      :points="segment.area"
                      :fill="segment.color"
                      fill-opacity="0.3"
                      class="sparkline-area"
                    />
                    <line
                      :x1="segment.x1"
                      :y1="segment.y1"
                      :x2="segment.x2"
                      :y2="segment.y2"
                      :stroke="segment.color"
                      stroke-width="1.5"
                      stroke-linejoin="round"
                      stroke-linecap="round"
                      class="sparkline-line"
                    />
                  </template>
                  <circle
                    v-if="sparklineDot"
                    :cx="sparklineDot.x"
                    :cy="sparklineDot.y"
                    r="2.5"
                    :fill="sparklineDot.color"
                    class="sparkline-dot"
                  />
                </svg>
                <div class="heap-sparkline-axis heap-sparkline-time-axis">
                  <span>-30 min</span>
                  <span>now</span>
                </div>
                <div class="heap-sparkline-axis heap-sparkline-value-axis">
                  <span>{{ formatHeap(heapMax) }}</span>
                  <span>0 B</span>
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
import { useRuntimeHistoryStore } from "src/stores/runtimeHistoryStore";
import MyCard from "src/components/myCard.vue";

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
    const runtimeHistory = useRuntimeHistoryStore();
    const cardCollapsed = ref(props.collapsed);
    let refreshInterval = null;

    const heapHistory = computed(() => runtimeHistory.heapHistory);
    const heapMax = computed(() =>
      heapHistory.value.filter((e) => Number.isFinite(e?.val)).length
        ? Math.max(
            ...heapHistory.value
              .filter((e) => Number.isFinite(e?.val))
              .map((e) => e.val),
          )
        : 1,
    );

    const heapTimeGrid = computed(() => {
      const usableW = SPARKLINE_W - 2 * SPARKLINE_PAD;
      return [5, 10, 15, 20, 25].map((minutes) => ({
        minutes,
        x: +(SPARKLINE_PAD + usableW * (1 - minutes / 30)).toFixed(1),
      }));
    });

    const minfreeHeapLine = computed(() => {
      const threshold = Number(infoData.data?.runtime?.minfreeHeapRuntime ?? 0);
      const maxValue = heapMax.value;
      if (
        !Number.isFinite(threshold) ||
        threshold <= 0 ||
        threshold > maxValue
      ) {
        return null;
      }
      const usableH = SPARKLINE_H - 2 * SPARKLINE_PAD;
      return {
        y: +(SPARKLINE_PAD + (1 - threshold / maxValue) * usableH).toFixed(1),
      };
    });

    function heapColor(value) {
      if (!Number.isFinite(value)) return null;
      if (value >= 16000) return "#35c759";
      if (value >= 12000) {
        const ratio = (value - 12000) / 4000;
        return `rgb(${Math.round(245 - 192 * ratio)}, ${Math.round(197 + 2 * ratio)}, 66)`;
      }
      if (value >= 7000) {
        const ratio = (value - 7000) / 5000;
        return `rgb(${Math.round(239 + 6 * ratio)}, ${Math.round(68 + 129 * ratio)}, ${Math.round(68 - 2 * ratio)})`;
      }
      return "#ef4444";
    }

    const sparklineSegments = computed(() => {
      const history = heapHistory.value;
      if (history.length < 2) return [];
      const usableW = SPARKLINE_W - 2 * SPARKLINE_PAD;
      const usableH = SPARKLINE_H - 2 * SPARKLINE_PAD;
      const baseline = SPARKLINE_H - SPARKLINE_PAD;
      const points = history.map((entry) => {
        if (!Number.isFinite(entry?.val) || !Number.isFinite(entry?.ts)) {
          return null;
        }
        const ageMinutes = Math.max(0, (Date.now() - entry.ts) / 60000);
        return {
          x: SPARKLINE_PAD + usableW * (1 - ageMinutes / 30),
          y: SPARKLINE_PAD + (1 - entry.val / heapMax.value) * usableH,
          color: heapColor(entry.val),
        };
      });
      return points.slice(1).flatMap((point, index) => {
        const previous = points[index];
        if (!point || !previous) return [];
        const color = point.color || previous.color;
        return [
          {
            x1: previous.x.toFixed(1),
            y1: previous.y.toFixed(1),
            x2: point.x.toFixed(1),
            y2: point.y.toFixed(1),
            color,
            area: `${previous.x.toFixed(1)},${previous.y.toFixed(1)} ${point.x.toFixed(1)},${point.y.toFixed(1)} ${point.x.toFixed(1)},${baseline} ${previous.x.toFixed(1)},${baseline}`,
          },
        ];
      });
    });

    const sparklineDot = computed(() => {
      const h = heapHistory.value.filter(
        (entry) => Number.isFinite(entry?.val) && Number.isFinite(entry?.ts),
      );
      if (h.length < 2) return null;
      const last = h[h.length - 1];
      const usableW = SPARKLINE_W - 2 * SPARKLINE_PAD;
      const usableH = SPARKLINE_H - 2 * SPARKLINE_PAD;
      const ageMinutes = Math.max(0, (Date.now() - last.ts) / 60000);
      return {
        x: +(SPARKLINE_PAD + usableW * (1 - ageMinutes / 30)).toFixed(1),
        y: +(SPARKLINE_PAD + (1 - last.val / heapMax.value) * usableH).toFixed(
          1,
        ),
        color: heapColor(last.val),
      };
    });

    function formatHeap(bytes) {
      if (bytes >= 1024) return (bytes / 1024).toFixed(1) + " KB";
      return bytes + " B";
    }

    function formatRuntimeValue(key, value) {
      if (key !== "uptime") return value;

      let seconds = Math.max(0, Math.floor(Number(value) || 0));
      const days = Math.floor(seconds / 86400);
      seconds %= 86400;
      const hours = Math.floor(seconds / 3600);
      seconds %= 3600;
      const minutes = Math.floor(seconds / 60);
      seconds %= 60;

      const time = [hours, minutes, seconds]
        .map((part) => String(part).padStart(2, "0"))
        .join(":");
      return `${String(days)}d, ${time}`;
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
      }, 60000);
    }

    watch(
      () => props.collapsed,
      (collapsed) => {
        cardCollapsed.value = collapsed;
      },
    );

    // Collapse only gates the (slow) HTTP info refresh loop; the runtime_info
    // push subscription is tied to the component lifecycle (mount/unmount) below.
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

    // Runtime history and subscription live in runtimeHistoryStore. The card
    // only controls its own slow HTTP refresh loop and rendering lifecycle.
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
      heapMax,
      heapTimeGrid,
      minfreeHeapLine,
      sparklineSegments,
      sparklineDot,
      formatHeap,
      formatRuntimeValue,
    };
  },
};
</script>

<style scoped>
.info-section {
  padding: 8px 5%;
  container-type: inline-size;
}

.info-rows {
  display: grid;
  grid-template-columns: auto 1fr; /* auto fits the label width precisely */
  column-gap: 12px;
}

.info-value {
  color: var(--field-value-color, inherit);
  word-break: break-word; /* allow breaking long strings/hashes, but not squeezing digits */
  white-space: nowrap; /* prevents numbers from wrapping into single-digit vertical stacks */
  padding: 2px 0;
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
  flex-wrap: wrap; /* Allows the graph to break to a new line when squeezed */
  gap: 16px;
  align-items: flex-start;
  padding-left: 12px;
}

.runtime-section .info-rows {
  flex: 1 1 200px; /* Take available width, but collapse if less than 200px */
  min-width: 0;
}

/* Sparkline panel */
.heap-sparkline-wrap {
  flex: 1 1 240px; /* Expand when wrapped, shrink back to 240px when side-by-side */
  max-width: 100%;
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 2px;
}

/* When the view gets narrow, stack the graph under the runtime numbers */
@container (max-width: 360px) {
  .runtime-section {
    flex-direction: column;
    align-items: stretch;
  }
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
  opacity: 0.95;
}

.sparkline-grid-line {
  stroke: currentColor;
  stroke-dasharray: 1 4;
  opacity: 0.22;
}

.sparkline-threshold {
  stroke: currentColor;
  stroke-dasharray: 5 4;
  opacity: 0.65;
}

.heap-sparkline-axis {
  display: flex;
  justify-content: space-between;
  font-size: 0.65em;
  opacity: 0.55;
}

.heap-sparkline-time-axis {
  margin-top: -2px;
}

.heap-sparkline-value-axis {
  position: absolute;
  inset: 0 0 22px;
  pointer-events: none;
  flex-direction: column;
  align-items: flex-end;
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
