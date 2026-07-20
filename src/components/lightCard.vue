<template>
  <BasePatchCard
    :active="light.id === selectedId"
    @click="$emit('select', light.id)"
  >
    <!-- Left Avatar Slot -->
    <template #avatar>
      <q-icon
        :name="light.on ? 'mdi-lightbulb-on' : 'mdi-lightbulb-outline'"
        :color="light.on ? 'primary' : 'grey-7'"
        size="sm"
      />
    </template>

    <!-- Center Text Content Slot -->
    <template #content>
      <div class="text-subtitle2 text-weight-bold">{{ light.name }}</div>
      <div class="text-caption text-grey-7">({{ light.typeLabel }})</div>
    </template>

    <!-- Right Actions/Indicators Slot -->
    <template #actions>
      <q-btn
        flat
        round
        dense
        size="sm"
        icon="mdi-pencil"
        color="grey-7"
        @click.stop=""
      >
        <q-tooltip>Bearbeiten</q-tooltip>
      </q-btn>
      <q-btn
        flat
        round
        dense
        size="sm"
        icon="mdi-delete"
        color="negative"
        @click.stop="$emit('delete', light.id)"
      >
        <q-tooltip>Löschen</q-tooltip>
      </q-btn>
    </template>
  </BasePatchCard>
</template>

<script setup>
import BasePatchCard from "./BasePatchCard.vue";

defineProps({
  light: { type: Object, required: true },
  selectedId: { type: [Number, String], default: null },
});
defineEmits(["select", "delete"]);
</script>
