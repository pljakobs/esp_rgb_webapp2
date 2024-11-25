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
.table-container {
  padding-left: 5%;
  padding-right: 5%;
}
.field-label {
  width: 120px;
  display: flex;
  align-items: center;
  padding: 0px;
}

.field-value {
  margin-left: 10px;
  padding: 0px;
}
.table-item {
  margin-bottom: 0px;
  margin-top: 0px;
  padding-left: 10%;
}

.table-item:nth-child(even) {
  background-color: #e8f4f8; /* Color odd lines light blue */
}

.table-item:nth-child(odd) {
  background-color: transparent; /* Color even lines transparent */
}
</style>
