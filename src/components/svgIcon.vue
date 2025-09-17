<template>
  <div
    v-if="name !== ''"
    :class="['svg-icon', { 'q-icon': isInStepper, selected: isSelected }]"
    :style="getIconStyle"
    v-html="processedSvgContent"
  ></div>
</template>

<script>
export default {
  name: "svgIcon",
  props: {
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
  },
  data() {
    return {
      svgContent: "", 
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

      return style;
    },
  },
  methods: {
    async fetchIcon() {
      if (this.name === "") {
        this.svgContent = "";
        return;
      }

      try {
        // Add console logging to debug fetch issues
        console.log(`Fetching icon: icons/${this.name}.svg`);
        const response = await fetch(`icons/${this.name}.svg`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        this.svgContent = await response.text();
        console.log(`Icon loaded: ${this.name}`, this.svgContent.length);
      } catch (error) {
        console.error("Error loading SVG:", error);
      }
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
