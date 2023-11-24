<template>
  <div>
    <q-toggle
      :v-model="sync_color_master_enabled.value"
      label="Color Master"
      left-label
    />
  </div>
</template>

<script>
import { ref } from "vue";
import { useStore } from "vuex";
import { generateFieldMappings } from "src/store/modules/config.js";

export default {
  setup() {
    const store = useStore();
    const fieldMappings = generateFieldMappings(store.state.config.configData);

    const getField = (field) => {
      return {
        get: () => store.state.config.configData[field],
        set: (value) => {
          store.dispatch("config/updateConfigData", field);
        },
      };
    };

    const sync_color_master_enabled = ref(
      getField("sync.color_master_enabled")
    );
    return {
      getField,
      sync_color_master_enabled,
    };
  },
};
</script>
