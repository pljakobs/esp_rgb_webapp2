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
const SPRITE_URL = "icons/icons-sprite.svg";
const SPRITE_ELEMENT_ID = "svg-icon-sprite";
let spriteLoadPromise = null;

function normalizeIconName(name) {
  return name.replace(/\.svg(\.gz)?$/i, "").replace(/[^a-z0-9_-]/gi, "_");
}

function ensureSpriteLoaded() {
  if (typeof window === "undefined") {
    return Promise.resolve();
  }

  if (document.getElementById(SPRITE_ELEMENT_ID)) {
    return Promise.resolve();
  }

  if (!spriteLoadPromise) {
    spriteLoadPromise = fetch(SPRITE_URL, { cache: "force-cache" })
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
        if (this.isWebUrl) {
          console.log(`Attempting web icon: ${this.name}`);
          await this.fetchWebIcon();
        } else {
          console.log(`Attempting sprite icon: ${this.name}`);
          await this.fetchLocalIcon();
        }
      } catch (error) {
        console.error(
          `Primary icon failed (${this.isWebUrl ? "web" : "local"}):`,
          error,
        );
        this.hasError = true;

        // Try fallback local icon if primary failed
        if (this.fallbackIcon && this.fallbackIcon !== this.name) {
          console.log(`Trying fallback icon: ${this.fallbackIcon}`);
          try {
            await this.fetchLocalIcon(this.fallbackIcon);
            console.log(
              `Fallback icon loaded successfully: ${this.fallbackIcon}`,
            );
          } catch (fallbackError) {
            console.error("Fallback icon also failed:", fallbackError);
          }
        } else {
          console.log("No fallback icon available or same as primary");
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
        console.log("Skipping cache for corrupted URL:", this.name);
      }

      // Check cache first (24 hour expiry) - but skip for corrupted URLs
      if (!skipCache) {
        const cached = localStorage.getItem(cacheKey);

        if (cached) {
          try {
            const cacheData = JSON.parse(cached);
            const cacheAge = Date.now() - cacheData.timestamp;
            const maxAge = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

            console.log(
              `Cache age: ${Math.round(cacheAge / 1000 / 60)} minutes, max age: ${Math.round(maxAge / 1000 / 60)} minutes`,
            );

            if (cacheAge < maxAge) {
              this.svgContent = cacheData.content;
              return;
            } else {
              console.log(`Cache expired for ${this.name}, removing old cache`);
              localStorage.removeItem(cacheKey);
            }
          } catch (parseError) {
            console.log(
              `Cache data corrupt for ${this.name}, removing:`,
              parseError,
            );
            localStorage.removeItem(cacheKey);
          }
        } else {
          // Cache miss - fetch from web
        }
      }

      // Fetch from web with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      console.log(`Starting web fetch for: ${this.name}`);

      try {
        const response = await fetch(this.name, {
          signal: controller.signal,
          mode: "cors",
          headers: {
            Accept: "image/svg+xml,image/*,*/*",
          },
        });

        clearTimeout(timeoutId);
        console.log(
          `Fetch response status: ${response.status} for ${this.name}`,
        );

        if (!response.ok) {
          // For Material Design icons, try variant fallback on 404
          if (response.status === 404 && this.isMaterialIcon) {
            console.log(`Icon not found (404), attempting variant fallback...`);
            const fallbackUrl = this.tryVariantFallback(this.name);
            if (fallbackUrl && fallbackUrl !== this.name) {
              console.log(`Trying fallback variant: ${fallbackUrl}`);
              return await this.fetchWebIconWithUrl(fallbackUrl);
            }
          }
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const content = await response.text();
        console.log(
          `Successfully fetched web icon: ${this.name}, length: ${content.length}`,
        );

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

        console.log(`Web icon loaded and cached: ${this.name}`);
      } catch (error) {
        clearTimeout(timeoutId);
        console.log(`Web fetch failed for ${this.name}:`, error);
        console.log(
          `Error type: ${error.name}, Error message: ${error.message}`,
        );
        throw error;
      }
    },

    async fetchLocalIcon(iconName = null) {
      const icon = iconName || this.name;
      const symbolId = normalizeIconName(icon);

      await ensureSpriteLoaded();

      if (!document.getElementById(symbolId)) {
        throw new Error(`Icon not found in sprite: ${symbolId}`);
      }

      this.svgContent = `<svg aria-hidden="true"><use href="#${symbolId}" xlink:href="#${symbolId}"></use></svg>`;
      console.log(`Sprite icon loaded: ${icon} (${symbolId})`);
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
            console.log(`Using cached fallback icon: ${url}`);
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
        console.log(
          `Fallback fetch response status: ${response.status} for ${url}`,
        );

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

        console.log(`Fallback icon loaded and cached: ${url}`);
      } catch (error) {
        clearTimeout(timeoutId);
        console.log(`Fallback fetch also failed for ${url}:`, error);
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
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.5em;
  height: 1.5em;
  color: var(--icon-color); /* Changed from fill to color */
  transition: opacity 0.2s ease;
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
