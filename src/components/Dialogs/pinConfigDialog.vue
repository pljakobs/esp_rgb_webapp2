<template>
  <q-dialog ref="dialogRef" @hide="onDialogHide" persistent>
    <q-card class="pin-config-dialog">
      <q-card-section>
        <div class="text-h6">
          {{
            mode === "add"
              ? "Add New Pin Configuration"
              : "Edit Pin Configuration"
          }}
        </div>
        <div class="text-subtitle2 q-mt-sm">
          Configuration for {{ soc.toUpperCase() }} device
        </div>
      </q-card-section>

      <q-separator />

      <q-card-section class="q-pa-md">
        <div class="config-name-section q-mb-md">
          <q-input
            v-model="configName"
            label="Configuration Name"
            hint="Enter a name to identify this pin configuration"
            :rules="[
              (val) =>
                (val && val.trim().length > 0) ||
                'Configuration name is required',
            ]"
            outlined
            dense
            class="q-mb-md"
          />
        </div>

        <div class="clear-pin-section q-mb-md">
          <div class="section-title">Clear Pin</div>

          <div class="soc-info q-mb-md">
            <q-chip color="primary" text-color="white">
              <svgIcon name="memory_outlined" class="q-mr-xs" />
              {{ soc.toUpperCase() }}
            </q-chip>
            <span class="text-caption q-ml-sm">
              This configuration will only be available on
              {{ soc.toUpperCase() }} devices
            </span>
          </div>

          <div class="q-my-sm">
            <span class="text-caption">
              The clear pin is used to reset all channels. Optional but
              recommended.
            </span>
          </div>
          <mySelect
            v-model="clearPin"
            :options="filteredClearPins"
            label="Clear Pin"
            class="clear-pin-select q-mb-md"
            emit-value
            map-options
            clearable
          />
        </div>

        <div class="channel-pins q-mb-md">
          <div
            v-for="(channel, index) in configChannels"
            :key="index"
            class="channel-row q-mb-sm"
          >
            <div class="color-circle" :class="channel.name"></div>
            <div class="channel-name">{{ channel.name }}</div>
            <mySelect
              v-model="channel.pin"
              :options="filteredPinsFor(channel)"
              label="Pin"
              class="pin-select"
              emit-value
              map-options
            />
          </div>
        </div>

        <div v-if="availablePins.length === 0" class="text-negative q-my-md">
          No available pins found for this device ({{ soc }})
        </div>
      </q-card-section>

      <q-separator />

      <q-card-actions align="right">
        <q-btn flat label="Cancel" color="grey" @click="onDialogCancel" />
        <q-btn
          flat
          label="Save"
          color="primary"
          @click="saveConfig"
          :disable="!isFormValid || hasEmptyRequiredChannels"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script>
import { ref, computed } from "vue";
import { useDialogPluginComponent } from "quasar";

export default {
  name: "PinConfigDialog",

  props: {
    mode: {
      type: String,
      required: true,
      validator: (value) => ["add", "edit"].includes(value),
    },
    existingConfig: {
      type: Object,
      default: null,
    },
    availablePins: {
      type: Array,
      required: true,
    },
    soc: {
      type: String,
      required: true,
    },
  },

  emits: [...useDialogPluginComponent.emits],

  setup(props, { emit }) {
    const { dialogRef, onDialogHide, onDialogOK, onDialogCancel } =
      useDialogPluginComponent();

    // Initialize form values based on mode and existing config
    const configName = ref(
      props.mode === "edit" && props.existingConfig
        ? props.existingConfig.name
        : "",
    );

    // Add this - initialize clearPin based on existing config
    const clearPin = ref(
      props.mode === "edit" &&
        props.existingConfig &&
        props.existingConfig.clearPin
        ? props.existingConfig.clearPin
        : null,
    );

    // Initialize channels based on mode
    const configChannels = ref([]);

    // Set up initial channels
    if (props.mode === "edit" && props.existingConfig) {
      // Clone the existing channels for editing
      configChannels.value = JSON.parse(
        JSON.stringify(props.existingConfig.channels),
      );
    } else {
      // Set up default channels for adding new config
      configChannels.value = [
        { name: "red", pin: null },
        { name: "green", pin: null },
        { name: "blue", pin: null },
        { name: "warmwhite", pin: null },
        { name: "coldwhite", pin: null },
      ];
    }

    // Required channels that must have a pin assigned (RGB at minimum)
    const requiredChannels = ["red", "green", "blue"];

    // Check if all required channels have pins assigned
    const hasEmptyRequiredChannels = computed(() => {
      return requiredChannels.some((name) => {
        const channel = configChannels.value.find((ch) => ch.name === name);
        return !channel || channel.pin === null;
      });
    });

    // Filter available pins for each channel (exclude pins already selected by other channels)
    const filteredPinsFor = (currentChannel) => {
      const selectedPins = configChannels.value
        .filter((ch) => ch.name !== currentChannel.name && ch.pin !== null)
        .map((ch) => ch.pin);

      // Also exclude the clear pin if it's set
      if (clearPin.value !== null) {
        selectedPins.push(clearPin.value);
      }

      return props.availablePins.filter(
        (pin) => !selectedPins.includes(pin.value),
      );
    };

    const filteredClearPins = computed(() => {
      const selectedChannelPins = configChannels.value
        .filter((ch) => ch.pin !== null)
        .map((ch) => ch.pin);

      return props.availablePins.filter(
        (pin) => !selectedChannelPins.includes(pin.value),
      );
    });

    // Check if the configuration has changed from the original
    const hasChanges = computed(() => {
      if (props.mode === "add") {
        // For add mode, changes mean any required fields are filled
        return (
          configName.value.trim() !== "" ||
          configChannels.value.some((ch) => ch.pin !== null) ||
          clearPin.value !== null
        );
      }

      // For edit mode, check if anything has changed from the original
      if (!props.existingConfig) return false;

      // Check if name changed
      if (configName.value !== props.existingConfig.name) return true;

      // Check if clear pin changed
      const originalClearPin = props.existingConfig.clearPin || null;
      if (clearPin.value !== originalClearPin) return true;

      // Check if any channel pin changed
      const originalChannels = props.existingConfig.channels || [];
      for (const channel of configChannels.value) {
        const originalChannel = originalChannels.find(
          (ch) => ch.name === channel.name,
        );
        const originalPin = originalChannel ? originalChannel.pin : null;
        if (channel.pin !== originalPin) return true;
      }

      return false;
    });

    // Validate the form
    const isFormValid = computed(() => {
      const nameValid = configName.value.trim() !== "";
      const changesExist = hasChanges.value;
      return nameValid && (props.mode === "add" || changesExist);
    });

    // Save the configuration
    const saveConfig = () => {
      if (!isFormValid.value || hasEmptyRequiredChannels.value) return;

      const config = {
        name: configName.value,
        soc: props.soc.toLowerCase(),
        channels: configChannels.value,
        clearPin: clearPin.value, // Include the clear pin
      };

      onDialogOK(config);
    };

    return {
      dialogRef,
      onDialogHide,
      onDialogCancel,
      configName,
      configChannels,
      clearPin, // Add this
      filteredClearPins, // Add this
      filteredPinsFor,
      isFormValid,
      hasChanges,
      hasEmptyRequiredChannels,
      saveConfig,
    };
  },
};
</script>

<style scoped>
.pin-config-dialog {
  min-width: 400px;
  max-width: 500px;
}

.soc-info {
  display: flex;
  align-items: center;
  border-radius: 4px;
  padding: 8px;
  background-color: rgba(0, 0, 0, 0.03);
}

.channel-pins {
  max-height: 300px;
  overflow-y: auto;
}

.channel-row {
  display: flex;
  align-items: center;
}

.color-circle {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  margin-right: 10px;
}

.color-circle.red {
  background-color: red;
}
.color-circle.green {
  background-color: green;
}
.color-circle.blue {
  background-color: blue;
}
.color-circle.warmwhite {
  background-color: yellow;
}
.color-circle.coldwhite {
  background-color: white;
  border: 1px solid #ccc;
}

.channel-name {
  width: 100px;
  text-transform: capitalize;
}

.pin-select {
  flex-grow: 1;
}
</style>
