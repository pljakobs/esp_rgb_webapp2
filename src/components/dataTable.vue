<template>
  <div class="table-container">
    <q-list>
      <q-item v-for="item in items" :key="item.label" class="table-item">
        <q-item-section>
          <q-item-label class="field-label">{{ item.label }}</q-item-label>
        </q-item-section>
        <q-item-section>
          <q-item-label class="field-value">{{ item.value }}</q-item-label>
        </q-item-section>
      </q-item>
    </q-list>
  </div>
</template>

<script>
export default {
  props: {
    items: {
      type: Array,
      required: true,
    },
  },
};
</script>

<style scoped>
:root {
  --table-bg-light: #ffffff;
  --table-bg-dark: #1e1e1e;
  --table-item-bg-light: #e8f4f8;
  --table-item-bg-dark: #333333;
  --table-item-bg-alt-light: transparent;
  --table-item-bg-alt-dark: #2a2a2a;
  --field-label-color-light: #000000;
  --field-label-color-dark: #ffffff;
  --field-value-color-light: #000000;
  --field-value-color-dark: #ffffff;
}

[data-theme="light"] {
  --table-bg: var(--table-bg-light);
  --table-item-bg: var(--table-item-bg-light);
  --table-item-bg-alt: var(--table-item-bg-alt-light);
  --field-label-color: var(--field-label-color-light);
  --field-value-color: var(--field-value-color-light);
}

[data-theme="dark"] {
  --table-bg: var(--table-bg-dark);
  --table-item-bg: var(--table-item-bg-dark);
  --table-item-bg-alt: var(--table-item-bg-alt-dark);
  --field-label-color: var(--field-label-color-dark);
  --field-value-color: var(--field-value-color-dark);
}

.table-container {
  padding-left: 5%;
  padding-right: 5%;
  background-color: var(--table-bg);
}

.field-label {
  width: 120px;
  display: flex;
  align-items: center;
  padding: 0px;
  color: var(--field-label-color);
}

.field-value {
  margin-left: 10px;
  padding: 0px;
  color: var(--field-value-color);
}

.table-item {
  margin-bottom: 0px;
  margin-top: 0px;
  padding-left: 10%;
}

.table-item:nth-child(even) {
  background-color: var(--table-item-bg);
}

.table-item:nth-child(odd) {
  background-color: var(--table-item-bg-alt);
}
</style>
