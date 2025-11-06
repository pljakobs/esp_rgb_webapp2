<template>
  <q-dialog ref="dialogRef" @hide="onDialogHide" persistent>
    <q-card style="min-width: 500px">
      <q-card-section>
        <div class="text-h6">Select Controllers to Update</div>
      </q-card-section>

      <q-card-section class="q-pt-none">
        <div class="text-subtitle2 q-mb-sm">
          Select which controllers to update:
        </div>
        
        <!-- Select All checkbox -->
        <q-checkbox
          v-model="selectAll"
          label="Select All"
          @update:model-value="toggleSelectAll"
          class="q-mb-md text-weight-bold"
        />
        
        <q-separator class="q-mb-md" />
        
        <!-- Controller list with checkboxes -->
        <div style="max-height: 400px; overflow-y: auto;">
          <q-option-group
            v-model="selectedControllers"
            :options="controllerOptions"
            type="checkbox"
            color="primary"
          />
        </div>
        
        <div class="q-mt-md text-caption text-grey-7">
          {{ selectedControllers.length }} of {{ controllerOptions.length }} controllers selected
        </div>
      </q-card-section>

      <q-card-actions align="right">
        <q-btn flat label="Cancel" color="primary" @click="onCancelClick" />
        <q-btn
          flat
          label="Update Selected"
          color="primary"
          :disable="selectedControllers.length === 0"
          @click="onOKClick"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script>
import { ref, watch } from 'vue';
import { useDialogPluginComponent } from 'quasar';

export default {
  name: 'ControllerSelectionDialog',
  
  props: {
    controllers: {
      type: Array,
      required: true,
    },
  },
  
  emits: [
    ...useDialogPluginComponent.emits,
  ],
  
  setup(props) {
    const { dialogRef, onDialogHide, onDialogOK, onDialogCancel } = useDialogPluginComponent();
    
    const controllerOptions = props.controllers.map(c => ({
      label: `${c.hostname} (${c.ip_address})`,
      value: c,
    }));
    
    // Initially select all controllers
    const selectedControllers = ref([...props.controllers]);
    const selectAll = ref(true);
    
    const toggleSelectAll = (value) => {
      if (value) {
        selectedControllers.value = [...props.controllers];
      } else {
        selectedControllers.value = [];
      }
    };
    
    // Watch for manual changes to update "Select All" state
    watch(selectedControllers, (newVal) => {
      selectAll.value = newVal.length === props.controllers.length;
    }, { deep: true });
    
    const onOKClick = () => {
      onDialogOK(selectedControllers.value);
    };
    
    const onCancelClick = () => {
      onDialogCancel();
    };
    
    return {
      dialogRef,
      onDialogHide,
      controllerOptions,
      selectedControllers,
      selectAll,
      toggleSelectAll,
      onOKClick,
      onCancelClick,
    };
  },
};
</script>
