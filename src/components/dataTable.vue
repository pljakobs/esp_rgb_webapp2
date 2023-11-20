<template>
  <div>
    <q-list>
      <q-item v-for="item in Items" :key="item.label" class="table-item">
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
    Items: {
      type: Array,
      required: true,
    },
  },
};
</script>
<style scoped>
.field-label {
  width: 120px;
  display: flex;
  align-items: center;
}

.field-value {
  margin-left: 10px;
}
.table-item {
  margin-bottom: 0px;
  margin-top: 0px;
}
</style>
