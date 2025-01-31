<template>
  <div
    :class="['svg-icon', { selected: isSelected }]"
    v-html="svgContent"
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
  },
  data() {
    return {
      svgContent: "",
    };
  },
  async mounted() {
    this.fetchIcon(this.name);
  },
  watch: {
    name(newVal) {
      this.fetchIcon(newVal);
    },
  },
  methods: {
    async fetchIcon(name) {
      console.log("trying to fetch icon", name);
      try {
        const response = await fetch(`/icons/${name}.svg`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        this.svgContent = await response.text();
      } catch (error) {
        console.error("Error loading SVG:", error);
      }
    },
  },
};
</script>

<style scoped>
.svg-icon {
  display: inline-block;
  width: 1em;
  height: 1em;
  fill: var(--icon-color);
}
.svg-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2em;
  height: 2em;
  fill: var(--icon-color);
}
.selected {
  fill: var(--icon-select-color);
}
</style>
