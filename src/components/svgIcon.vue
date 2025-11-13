<template>
  <div
    v-if="name !== ''"
    :class="['svg-icon', { 'q-icon': isInStepper, selected: isSelected }]"
    :style="getIconStyle"
    v-html="processedSvgContent"
  ></div>
</template>

<script>
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
const SPRITE_URL = "icons/iconsSprite.svg";
const SPRITE_ELEMENT_ID = "svg-icon-sprite";
let spriteLoadPromise = null;

function getSpriteUrl(forceReload = false) {
  if (!forceReload) {
    return SPRITE_URL;
  }

  const separator = SPRITE_URL.includes("?") ? "&" : "?";
  return `${SPRITE_URL}${separator}cb=${Date.now()}`;
}

function normalizeIconName(name) {
  return name.replace(/\.svg(\.gz)?$/i, "").replace(/[^a-z0-9_-]/gi, "_");
}

function ensureSpriteLoaded({ forceReload = false } = {}) {
  if (typeof window === "undefined") {
    return Promise.resolve();
  }

  if (!forceReload && document.getElementById(SPRITE_ELEMENT_ID)) {
    return Promise.resolve();
  }

  if (forceReload) {
    const existingSprite = document.getElementById(SPRITE_ELEMENT_ID);
    if (existingSprite) {
      existingSprite.remove();
    }
    spriteLoadPromise = null;
  }

  if (!spriteLoadPromise) {
    const cacheMode = forceReload ? "reload" : "no-store";
    spriteLoadPromise = fetch(getSpriteUrl(forceReload), { cache: cacheMode })
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
        // Allow future attempts to retry from scratch after any fetch failure.
        spriteLoadPromise = null;
        throw error;
      });
  }

  return spriteLoadPromise;
}

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
  data() {
    return {
      svgContent: "",
      isLoading: false,
      hasError: false,
    };
  },
  computed: {
    processedSvgContent() {
      // Add fill="currentColor" to inherit text color
      if (this.svgContent) {
        return this.svgContent.replace("<svg", '<svg fill="currentColor"');
      }
      return "";
    },
    getIconStyle() {
      const style = {};

      if (this.color) {
        style.color = this.color;
      }

      if (this.size) {
        style.width = this.size;
        style.height = this.size;
      }

      if (this.isInStepper) {
        // Styles for q-stepper compatibility
        style.display = "inline-flex";
        style.alignItems = "center";
        style.justifyContent = "center";
        style.width = "1em";
        style.height = "1em";
        style.fontSize = this.size || "24px";
      }

      // Add opacity during loading
      if (this.isLoading) {
        style.opacity = "0.6";
      }

      return style;
    },
    isWebUrl() {
      return (
        this.name.startsWith("http://") || this.name.startsWith("https://")
      );
    },
    isMaterialIcon() {
      return (
        this.name.includes("fonts.gstatic.com") ||
        this.name.includes("material")
      );
    },
    // Describes the icon loading strategy for debugging
    iconStrategy() {
      if (this.isWebUrl) {
        return `web → fallback(${this.fallbackIcon})`;
      } else {
        return `local → fallback(${this.fallbackIcon})`;
      }
    },
  },
  methods: {
    async fetchIcon() {
      if (this.name === "") {
        this.svgContent = "";
        return;
      }

      this.isLoading = true;
      this.hasError = false;

      try {
        await (this.isWebUrl ? this.fetchWebIcon() : this.fetchLocalIcon());
      } catch (error) {
        console.error(
          `Primary icon failed (${this.isWebUrl ? "web" : "local"}):`,
          error,
        );
        this.hasError = true;

        // Try fallback local icon if primary failed
        if (this.fallbackIcon && this.fallbackIcon !== this.name) {
          try {
            await this.fetchLocalIcon(this.fallbackIcon);
          } catch (fallbackError) {
            console.error("Fallback icon also failed:", fallbackError);
          }
        } else {
        }
      } finally {
        this.isLoading = false;
      }
    },

    async fetchWebIcon() {
      // Create a safer cache key for localStorage
      const generatedKey = this.generateCacheKey(this.name);
      const cacheKey = `svg-cache-${generatedKey}`;

      // TEMPORARY: Skip cache for corrupted URLs
      const skipCache = this.name.includes("[object Object]");
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
              this.svgContent = cacheData.content;
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
        const response = await fetch(this.name, {
          signal: controller.signal,
          mode: "cors",
          headers: {
            Accept: "image/svg+xml,image/*,*/*",
          },
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          // For Material Design icons, try variant fallback on 404
          if (response.status === 404 && this.isMaterialIcon) {
            const fallbackUrl = this.tryVariantFallback(this.name);
            if (fallbackUrl && fallbackUrl !== this.name) {
              return await this.fetchWebIconWithUrl(fallbackUrl);
            }
          }
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const content = await response.text();

        // Validate it's actually SVG content
        if (!content.includes("<svg")) {
          throw new Error("Response is not SVG content");
        }

        this.svgContent = content;

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
    },

    async fetchLocalIcon(iconName = null) {
      const icon = iconName || this.name;
      const symbolId = normalizeIconName(icon);

      await ensureSpriteLoaded();

      const symbol = document.getElementById(symbolId);
      if (!symbol) {
        await ensureSpriteLoaded({ forceReload: true });
        const reloadedSymbol = document.getElementById(symbolId);
        if (!reloadedSymbol) {
          // If the icon doesn't exist, try some common fallbacks for problematic icons
          const fallbackMappings = {
            'lights_led_strip_variant': 'lightbulb',
            'led_strip_variant': 'lightbulb',
            'lights_led-strip-variant': 'lightbulb',
            'led-strip-variant': 'lightbulb'
          };
          
          const fallbackIcon = fallbackMappings[symbolId];
          if (fallbackIcon) {
            console.warn(`Icon '${symbolId}' not found, using fallback: ${fallbackIcon}`);
            const fallbackSymbol = document.getElementById(fallbackIcon);
            if (fallbackSymbol) {
              this.setSvgContentFromSymbol(fallbackSymbol);
              return;
            }
          }
          
          throw new Error(`Icon not found in sprite: ${symbolId}`);
        }
        this.setSvgContentFromSymbol(reloadedSymbol);
        return;
      }
      this.setSvgContentFromSymbol(symbol);
    },

    setSvgContentFromSymbol(symbol) {
      const viewBox = symbol.getAttribute("viewBox") || "0 0 24 24";
      const innerMarkup = symbol.innerHTML || "";
      this.svgContent = `<svg aria-hidden="true" focusable="false" viewBox="${viewBox}" xmlns="http://www.w3.org/2000/svg">${innerMarkup}</svg>`;
    },

    // Helper method to generate Material Design icon URL
    generateMaterialIconUrl(iconName, variant = "outlined", size = "24px") {
      return `https://fonts.gstatic.com/s/i/short-term/release/materialsymbols${variant}/${iconName}/default/${size}.svg`;
    },

    // Generate a safe cache key from URL
    generateCacheKey(url) {
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
    },

    // Try to generate a fallback URL with a different variant for Material Design icons
    tryVariantFallback(originalUrl) {
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
    },

    // Separate method to fetch with a specific URL (for fallback)
    async fetchWebIconWithUrl(url) {
      const generatedKey = this.generateCacheKey(url);
      const cacheKey = `svg-cache-${generatedKey}`;

      // Check cache first
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        try {
          const cacheData = JSON.parse(cached);
          const cacheAge = Date.now() - cacheData.timestamp;
          const maxAge = 24 * 60 * 60 * 1000; // 24 hours

          if (cacheAge < maxAge) {
            this.svgContent = cacheData.content;
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

        this.svgContent = content;

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
    },

    // Debug method to inspect cache contents
    debugCache(url = null) {
      const targetUrl = url || this.name;
      const cacheKey = `svg-cache-${this.generateCacheKey(targetUrl)}`;
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
    },
  },
  mounted() {
    this.fetchIcon();
  },
  watch: {
    name: {
      handler() {
        this.fetchIcon();
      },
    },
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
