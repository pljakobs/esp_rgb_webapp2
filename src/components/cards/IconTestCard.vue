<template>
  <MyCard
    icon="palette_outlined"
    title="Icon Sprite Browser"
    v-model:collapsed="isCollapsed"
  >
    <div class="q-pa-md">
      <div v-if="isLoading" class="text-center q-pa-md text-grey-6">
        Loading icons...
      </div>

      <div v-else-if="error" class="text-negative text-center q-pa-md">
        {{ error }}
      </div>

      <div v-else class="icon-grid" aria-live="polite">
        <div v-for="icon in icons" :key="icon" class="icon-grid__item">
          <svgIcon :name="icon" size="36px" />
          <div class="icon-grid__label">{{ icon }}</div>
        </div>
      </div>
    </div>
  </MyCard>
</template>

<script>
import { ref, onMounted } from "vue";

import MyCard from "src/components/myCard.vue";

const SPRITE_URL = "icons/iconsSprite.svg";
const SPRITE_ELEMENT_ID = "svg-icon-sprite";

let iconIdsCache = null;
let iconIdsPromise = null;

export default {
  name: "IconTestCard",
  components: {
    MyCard,
  },
  setup() {
    const icons = ref([]);

    const isLoading = ref(true);

    const error = ref(null);

    const isCollapsed = ref(false);

    const hasLoadedOnce = ref(false);

    async function loadIcons() {
      try {
        if (!hasLoadedOnce.value) {
          isLoading.value = true;
          error.value = null;

          const ids = await getIconIds();
          icons.value = ids;

          hasLoadedOnce.value = true;
        }
      } catch (err) {
        console.error("Failed to load icon sprite", err);
        error.value = "Unable to load icon sprite.";
      } finally {
        isLoading.value = false;
      }
    }

    async function getIconIds() {
      if (iconIdsCache && iconIdsCache.length > 0) {
        return iconIdsCache;
      }

      const domIds = extractIconIdsFromDom();
      if (domIds && domIds.length > 0) {
        iconIdsCache = domIds;
        return iconIdsCache;
      }

      if (!iconIdsPromise) {
        iconIdsPromise = fetch(SPRITE_URL, { cache: "force-cache" })
          .then((response) => {
            if (!response.ok) {
              throw new Error(`Sprite fetch failed (${response.status})`);
            }
            return response.text();
          })
          .then((spriteText) => {
            const ids = extractIconIds(spriteText);
            iconIdsCache = ids;
            iconIdsPromise = null;
            return ids;
          })
          .catch((error) => {
            iconIdsPromise = null;
            throw error;
          });
      }

      return iconIdsPromise;
    }

    function extractIconIdsFromDom() {
      if (typeof document === "undefined") {
        return null;
      }

      const sprite = document.getElementById(SPRITE_ELEMENT_ID);
      if (!sprite) {
        return null;
      }

      const symbols = sprite.querySelectorAll("symbol[id]");
      return Array.from(symbols)
        .map((symbol) => symbol.getAttribute("id"))
        .filter((id) => !!id && !id.startsWith("_"))
        .sort((a, b) => a.localeCompare(b));
    }

    function extractIconIds(spriteText) {
      if (!spriteText) {
        return [];
      }

      const parser = new DOMParser();
      const doc = parser.parseFromString(spriteText, "image/svg+xml");
      const symbols = doc.querySelectorAll("symbol[id]");

      return Array.from(symbols)
        .map((symbol) => symbol.getAttribute("id"))
        .filter((id) => !!id && !id.startsWith("_"))
        .sort((a, b) => a.localeCompare(b));
    }

    onMounted(() => {
      loadIcons();
    });

    return {
      icons,
      isLoading,
      error,
      isCollapsed,
      hasLoadedOnce,
      loadIcons,
      getIconIds,
      extractIconIdsFromDom,
      extractIconIds,
    };
  },
};
</script>

<style scoped>
.icon-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 16px;
}

.icon-grid__item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12px;
  border-radius: 8px;
  background-color: rgba(0, 0, 0, 0.04);
  transition: background-color 0.2s ease;
}

.icon-grid__item:hover {
  background-color: rgba(0, 0, 0, 0.08);
}

.icon-grid__label {
  margin-top: 8px;
  font-size: 12px;
  text-align: center;
  word-break: break-word;
}
</style>
