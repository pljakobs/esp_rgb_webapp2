<template>
  <div
    v-if="name !== ''"
    :class="['svg-icon', { 'q-icon': isInStepper, selected: isSelected }]"
    :style="getIconStyle"
    v-html="processedSvgContent"
  ></div>
</template>

<script>
import { ref, computed, onMounted, watch } from "vue";

/**
 * svgIcon Component
 *
 * Flexible icon component that automatically handles both local and web icons:
 *
 * Usage Examples:
 * - Local icon: <svgIcon name="edit" />
 * - Web icon with fallback: <svgIcon name="https://web-url.svg" fallbackIcon="edit" />
 * - Local icon with fallback: <svgIcon name="custom-icon" fallbackIcon="lightbulb_outlined" />
 *
 * Features:
 * - Auto-detects web URLs vs local icon names
 * - Automatic fallback to local icon if primary fails
 * - Web icon caching (24hr expiry)
 * - CORS handling for web icons
 */
import { configDataStore } from "src/stores/configDataStore";

const SPRITE_URL = "icons/iconsSprite.svg";
const SPRITE_ELEMENT_ID = "svg-icon-sprite";
let spriteLoadPromise = null;
let spriteRetryAllowedAt = 0;
let spriteRetryWaitPromise = null;
let spriteForceReloadAttempted = false; // Prevent cascading forceReload calls

function createRetryError(retryAfterMs) {
  const error = new Error("Failed to load sprite: 429");
  error.retryAfterMs = retryAfterMs;
  return error;
}

function waitForSpriteRetryWindow() {
  const delayMs = spriteRetryAllowedAt - Date.now();
  if (delayMs <= 0) {
    return Promise.resolve();
  }

  if (!spriteRetryWaitPromise) {
    spriteRetryWaitPromise = new Promise((resolve) => {
      window.setTimeout(resolve, delayMs);
    }).finally(() => {
      spriteRetryWaitPromise = null;
    });
  }

  return spriteRetryWaitPromise;
}

function normalizeIconName(name) {
  // Replace slashes with underscores to match sprite ID convention
  let normalized = name.replace(/\//g, "_");
  // Remove file extensions
  normalized = normalized.replace(/\.svg(\.gz)?$/i, "");
  // Replace incompatible characters with underscores
  return normalized.replace(/[^a-z0-9_-]/gi, "_");
}

/**
 * Fetch the icon sprite, retrying transparently on 429 (low-heap rejection from
 * the ESP8266 firmware).  The firmware sends a Retry-After header; we honour it
 * so all pending icon lookups simply wait rather than failing immediately.
 *
 * @param {string} url
 * @param {RequestInit} fetchOptions
 * @param {number} retriesLeft   – maximum remaining attempts (default 4)
 */
async function fetchSpriteWithRetry(url, fetchOptions, retriesLeft = 4) {
  const response = await fetch(url, fetchOptions);
  if (response.status === 429 && retriesLeft > 0) {
    const retryAfter = parseInt(
      response.headers.get("Retry-After") || "10",
      10,
    );
    await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
    return fetchSpriteWithRetry(
      SPRITE_URL,
      { cache: "reload" },
      retriesLeft - 1,
    );
  }

  if (response.status === 429) {
    const retryAfter = parseInt(
      response.headers.get("Retry-After") || "10",
      10,
    );
    throw createRetryError(retryAfter * 1000);
  }

  return response;
}

function ensureSpriteLoaded({ forceReload = false } = {}) {
  if (typeof window === "undefined") {
    return Promise.resolve();
  }

  if (!forceReload && document.getElementById(SPRITE_ELEMENT_ID)) {
    return Promise.resolve();
  }

  // Prevent cascading forceReload calls - only allow ONE forced reload per sprite load cycle
  if (forceReload && spriteForceReloadAttempted) {
    // A force reload was already attempted in this cycle; don't trigger another
    return spriteLoadPromise || Promise.resolve();
  }

  if (forceReload) {
    spriteForceReloadAttempted = true;
    const existingSprite = document.getElementById(SPRITE_ELEMENT_ID);
    if (existingSprite) {
      existingSprite.remove();
    }
    spriteLoadPromise = null;
  }

  if (!spriteLoadPromise) {
    const cacheMode = forceReload ? "reload" : "default";
    spriteLoadPromise = waitForSpriteRetryWindow()
      .then(() => fetchSpriteWithRetry(SPRITE_URL, { cache: cacheMode }))
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Failed to load sprite: ${response.status}`);
        }
        return response.text();
      })
      .then((spriteContent) => {
        if (document.getElementById(SPRITE_ELEMENT_ID)) {
          return;
        }
        const container = document.createElement("div");
        container.innerHTML = spriteContent.trim();
        const svgElement = container.querySelector("svg");
        if (!svgElement) {
          throw new Error("Sprite file does not contain an <svg> element");
        }
        svgElement.setAttribute("id", SPRITE_ELEMENT_ID);
        svgElement.setAttribute("aria-hidden", "true");
        svgElement.style.position = "absolute";
        svgElement.style.width = "0";
        svgElement.style.height = "0";
        svgElement.style.overflow = "hidden";
        svgElement.style.visibility = "hidden";
        document.body.prepend(svgElement);
      })
      .catch((error) => {
        if (error.retryAfterMs) {
          spriteRetryAllowedAt = Date.now() + error.retryAfterMs;
        }
        // Allow future attempts to retry from scratch after any fetch failure.
        spriteLoadPromise = null;
        throw error;
      });
  }

  return spriteLoadPromise;
}

export { ensureSpriteLoaded };

export default {
  name: "svgIcon",
  props: {
    // Icon name (local) or URL (web) - component auto-detects type
    name: {
      type: String,
      required: true,
    },
    isSelected: {
      type: Boolean,
      default: false,
    },
    size: {
      type: String,
      default: null,
    },
    color: {
      type: String,
      default: null,
    },
    isInStepper: {
      type: Boolean,
      default: false,
    },
    // Local icon to use if primary icon fails (web or local)
    fallbackIcon: {
      type: String,
      default: "lightbulb_outlined",
    },
  },
  setup(props) {
    const svgContent = ref("");

    const isLoading = ref(false);

    const hasError = ref(false);

    const processedSvgContent = computed(() => {
      // Add fill="currentColor" to inherit text color
      if (svgContent.value) {
        return svgContent.value.replace("<svg", '<svg fill="currentColor"');
      }
      return "";
    });

    const getIconStyle = computed(() => {
      const style = {};

      if (props.color) {
        style.color = props.color;
      }

      if (props.size) {
        style.width = props.size;
        style.height = props.size;
      }

      if (props.isInStepper) {
        // Styles for q-stepper compatibility
        style.display = "inline-flex";
        style.alignItems = "center";
        style.justifyContent = "center";
        style.width = "1em";
        style.height = "1em";
        style.fontSize = props.size || "24px";
      }

      // Add opacity during loading
      if (isLoading.value) {
        style.opacity = "0.6";
      }

      return style;
    });

    const isWebUrl = computed(() => {
      return (
        props.name.startsWith("http://") || props.name.startsWith("https://")
      );
    });

    const isMaterialIcon = computed(() => {
      return (
        props.name.includes("fonts.gstatic.com") ||
        props.name.includes("material")
      );
    });

    const iconStrategy = computed(() => {
      if (isWebUrl.value) {
        return `web → fallback(${props.fallbackIcon})`;
      } else {
        return `local → fallback(${props.fallbackIcon})`;
      }
    });

    async function fetchIcon() {
      if (props.name === "") {
        svgContent.value = "";
        return;
      }

      isLoading.value = true;
      hasError.value = false;

      try {
        const configStore = configDataStore();
        // Check if web icons are allowed (default to true if undefined for backward compatibility)
        const allowWebIcons =
          configStore.data?.general?.allow_web_icons !== false;

        if (isWebUrl.value) {
          if (allowWebIcons) {
            await fetchWebIcon();
          } else {
            // If web icons not allowed, fail immediately to trigger fallback
            throw new Error("Web icons disabled by configuration");
          }
        } else {
          await fetchLocalIcon();
        }
      } catch (error) {
        if (
          !isWebUrl.value ||
          error.message !== "Web icons disabled by configuration"
        ) {
          // Only log errors that aren't expected due to configuration
          console.error(
            `Primary icon failed (${isWebUrl.value ? "web" : "local"}):`,
            error,
          );
        }

        hasError.value = true;

        // Try fallback local icon if primary failed
        if (props.fallbackIcon && props.fallbackIcon !== props.name) {
          try {
            await fetchLocalIcon(props.fallbackIcon);
          } catch (fallbackError) {
            console.error("Fallback icon also failed:", fallbackError);
          }
        }
      } finally {
        isLoading.value = false;
      }
    }

    async function fetchWebIcon() {
      // Create a safer cache key for localStorage
      const generatedKey = generateCacheKey(props.name);
      const cacheKey = `svg-cache-${generatedKey}`;

      // TEMPORARY: Skip cache for corrupted URLs
      const skipCache = props.name.includes("[object Object]");
      if (skipCache) {
      }

      // Check cache first (24 hour expiry) - but skip for corrupted URLs
      if (!skipCache) {
        const cached = localStorage.getItem(cacheKey);

        if (cached) {
          try {
            const cacheData = JSON.parse(cached);
            const cacheAge = Date.now() - cacheData.timestamp;
            const maxAge = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

            if (cacheAge < maxAge) {
              svgContent.value = cacheData.content;
              return;
            } else {
              localStorage.removeItem(cacheKey);
            }
          } catch (parseError) {
            localStorage.removeItem(cacheKey);
          }
        } else {
          // Cache miss - fetch from web
        }
      }

      // Fetch from web with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      try {
        const response = await fetch(props.name, {
          signal: controller.signal,
          mode: "cors",
          headers: {
            Accept: "image/svg+xml,image/*,*/*",
          },
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          // For Material Design icons, try variant fallback on 404
          if (response.status === 404 && isMaterialIcon.value) {
            const fallbackUrl = tryVariantFallback(props.name);
            if (fallbackUrl && fallbackUrl !== props.name) {
              return await fetchWebIconWithUrl(fallbackUrl);
            }
          }
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const content = await response.text();

        // Validate it's actually SVG content
        if (!content.includes("<svg")) {
          throw new Error("Response is not SVG content");
        }

        svgContent.value = content;

        // Cache the result
        localStorage.setItem(
          cacheKey,
          JSON.stringify({
            content: content,
            timestamp: Date.now(),
          }),
        );
      } catch (error) {
        clearTimeout(timeoutId);
        throw error;
      }
    }

    async function fetchLocalIcon(iconName = null) {
      const icon = iconName || props.name;
      const symbolId = normalizeIconName(icon);

      await ensureSpriteLoaded();

      let symbol = document.getElementById(symbolId);
      if (!symbol) {
        // Try force reload only once per sprite load cycle
        // This handles the case where the initial load was in progress
        await ensureSpriteLoaded({ forceReload: true });
        symbol = document.getElementById(symbolId);

        if (!symbol) {
          // Icon still not found after reload attempt - use fallback
          const fallbackMappings = {
            lights_led_strip_variant: "lightbulb_outlined",
            led_strip_variant: "lightbulb_outlined",
            "lights_led-strip-variant": "lightbulb_outlined",
            "led-strip-variant": "lightbulb_outlined",
          };

          const fallbackIcon = fallbackMappings[symbolId];
          if (fallbackIcon) {
            console.warn(
              `Icon '${symbolId}' not found, using fallback: ${fallbackIcon}`,
            );
            const fallbackSymbol = document.getElementById(fallbackIcon);
            if (fallbackSymbol) {
              setSvgContentFromSymbol(fallbackSymbol);
              return;
            }
          }

          throw new Error(`Icon not found in sprite: ${symbolId}`);
        }
      }

      setSvgContentFromSymbol(symbol);
    }

    function setSvgContentFromSymbol(symbol) {
      const viewBox = symbol.getAttribute("viewBox") || "0 0 24 24";
      const innerMarkup = symbol.innerHTML || "";
      svgContent.value = `<svg aria-hidden="true" focusable="false" viewBox="${viewBox}" xmlns="http://www.w3.org/2000/svg">${innerMarkup}</svg>`;
    }

    function generateMaterialIconUrl(
      iconName,
      variant = "outlined",
      size = "24px",
    ) {
      return `https://fonts.gstatic.com/s/i/short-term/release/materialsymbols${variant}/${iconName}/default/${size}.svg`;
    }

    function generateCacheKey(url) {
      // For Material Design URLs, extract icon name AND variant
      if (url.includes("materialsymbols")) {
        // URL pattern: .../materialsymbols{variant}/{iconName}/default/24px.svg
        // Examples:
        // - materialsymbolsoutlined/home/default/24px.svg
        // - materialsymbolsrounded/search/default/24px.svg
        // - materialsymbolssharp/lightbulb/default/24px.svg

        const match = url.match(/materialsymbols([^\/]*?)\/([^\/]+)\//);
        if (match) {
          const variant = match[1] || "outlined"; // default to outlined if empty
          const iconName = match[2];
          const key = `md-${variant}-${iconName}`;
          return key;
        }
      }

      // For other URLs, use a hash approach
      try {
        // Create a simple hash from the URL
        let hash = 0;
        for (let i = 0; i < url.length; i++) {
          const char = url.charCodeAt(i);
          hash = (hash << 5) - hash + char;
          hash = hash & hash; // Convert to 32-bit integer
        }
        const key = `url-${Math.abs(hash)}`;
        return key;
      } catch (error) {
        // Fallback if everything fails
        const key = url.replace(/[^a-zA-Z0-9]/g, "").substring(url.length - 20);
        return key;
      }
    }

    function tryVariantFallback(originalUrl) {
      if (!originalUrl.includes("materialsymbols")) {
        return null;
      }

      // Extract the current variant and icon name
      const match = originalUrl.match(
        /materialsymbols([^\/]*?)\/([^\/]+)\/(.+)$/,
      );
      if (!match) {
        return null;
      }

      const currentVariant = match[1] || "outlined";
      const iconName = match[2];
      const pathSuffix = match[3]; // default/24px.svg

      // Fallback hierarchy: rounded → outlined → sharp, sharp → outlined → rounded
      const variantFallbacks = {
        rounded: ["outlined", "sharp"],
        sharp: ["outlined", "rounded"],
        outlined: [], // outlined is the base, no fallback
      };

      const fallbacks = variantFallbacks[currentVariant] || [];
      if (fallbacks.length === 0) {
        return null; // No fallback available
      }

      // Try the first fallback variant (usually outlined)
      const fallbackVariant = fallbacks[0];
      const fallbackUrl = `https://fonts.gstatic.com/s/i/short-term/release/materialsymbols${fallbackVariant}/${iconName}/${pathSuffix}`;

      console.log(`Variant fallback: ${currentVariant} → ${fallbackVariant}`);
      return fallbackUrl;
    }

    async function fetchWebIconWithUrl(url) {
      const generatedKey = generateCacheKey(url);
      const cacheKey = `svg-cache-${generatedKey}`;

      // Check cache first
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        try {
          const cacheData = JSON.parse(cached);
          const cacheAge = Date.now() - cacheData.timestamp;
          const maxAge = 24 * 60 * 60 * 1000; // 24 hours

          if (cacheAge < maxAge) {
            svgContent.value = cacheData.content;
            return;
          }
        } catch (e) {
          localStorage.removeItem(cacheKey);
        }
      }

      // Fetch from web
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      try {
        const response = await fetch(url, {
          signal: controller.signal,
          mode: "cors",
          headers: {
            Accept: "image/svg+xml,image/*,*/*",
          },
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const content = await response.text();
        if (!content.includes("<svg")) {
          throw new Error("Response is not SVG content");
        }

        svgContent.value = content;

        // Cache the result
        localStorage.setItem(
          cacheKey,
          JSON.stringify({
            content: content,
            timestamp: Date.now(),
          }),
        );
      } catch (error) {
        clearTimeout(timeoutId);
        throw error;
      }
    }

    function debugCache(url = null) {
      const targetUrl = url || props.name;
      const cacheKey = `svg-cache-${generateCacheKey(targetUrl)}`;
      const cached = localStorage.getItem(cacheKey);

      console.log("=== CACHE DEBUG ===");
      console.log("URL:", targetUrl);
      console.log("Cache Key:", cacheKey);
      console.log("Cache exists:", !!cached);

      if (cached) {
        try {
          const cacheData = JSON.parse(cached);
          const age = Date.now() - cacheData.timestamp;
          console.log(
            "Cache timestamp:",
            new Date(cacheData.timestamp).toISOString(),
          );
          console.log("Cache age (minutes):", Math.round(age / 1000 / 60));
          console.log("Content length:", cacheData.content?.length || 0);
        } catch (e) {
          console.log("Cache data corrupt:", e);
        }
      }
      console.log("===================");
    }

    onMounted(() => {
      fetchIcon();
    });

    watch(() => props.name, fetchIcon);

    return {
      svgContent,
      isLoading,
      hasError,
      processedSvgContent,
      getIconStyle,
      isWebUrl,
      isMaterialIcon,
      iconStrategy,
      fetchIcon,
      fetchWebIcon,
      fetchLocalIcon,
      setSvgContentFromSymbol,
      generateMaterialIconUrl,
      generateCacheKey,
      tryVariantFallback,
      fetchWebIconWithUrl,
      debugCache,
    };
  },
};
</script>

<style>
.svg-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.5em;
  height: 1.5em;
  color: var(--icon-color); /* Changed from fill to color */
  transition: opacity 0.2s ease;
}

.svg-icon svg {
  width: 100%;
  height: 100%;
  display: block;
}

/* Special styles for q-stepper compatibility */
.svg-icon.q-icon {
  font-size: 24px;
  width: 1em;
  height: 1em;
  line-height: 1;
  letter-spacing: normal;
  text-transform: none;
  white-space: nowrap;
  direction: ltr;
  text-align: center;
  position: relative;
}

.selected {
  color: var(--icon-select-color); /* Changed from fill to color */
}
</style>
