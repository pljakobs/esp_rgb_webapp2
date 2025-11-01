<template>
  <q-scroll-area :style="{ height: isDialog ? dialogHeight : cardHeight }">
    <q-card-section class="flex justify-center no-padding">
      <q-color
        v-model="internalColor"
        format-model="hex"
        no-header
        no-footer
        class="scaled-color"
      />
    </q-card-section>
    <q-card-section class="flex justify-center" v-if="!isDialog">
      <q-btn flat color="primary" @click="onAddPreset">
        <template v-slot:default>
          <svgIcon name="star_outlined" />
          <span>Add Preset</span>
        </template>
      </q-btn>
    </q-card-section>
    <div class="onoff-btn-row">
      <q-btn color="primary" @click="sendOn" class="on-btn">
        <svgIcon name="ligthbulb-on" />On
      </q-btn>
      <q-btn color="secondary" @click="sendOff" class="off-btn">
        <svgIcon name="ligthbulb-off" />Off
      </q-btn>
    </div>
  </q-scroll-area>
</template>

<script>
import { ref, watch, computed } from "vue";
import { colors } from "quasar";
import { useColorDataStore } from "src/stores/colorDataStore";
import { useControllersStore } from "src/stores/controllersStore";

const { hexToRgb, rgbToHsv, rgbToHex, hsvToRgb } = colors;

export default {
  props: {
    modelValue: {
      type: Object,
      default: () => ({ hsv: { h: 0, s: 0, v: 0 } }),
    },
    isDialog: {
      type: Boolean,
      default: false,
    },
    cardHeight: {
      type: String,
      default: "300px",
    },
    dialogHeight: {
      type: String,
      default: "280px",
    },
  },
  emits: ["update:modelValue", "add-preset"],
  setup(props, { emit }) {
    const controllersStore = useControllersStore();
    // Compute controller URL from currentController
    const controllerUrl = computed(() => {
      const ctrl = controllersStore.currentController;
      if (ctrl && ctrl.ip_address) {
        return `http://${ctrl.ip_address}`;
      }
      return null;
    });

    // Send On command
    const sendOn = async () => {
      if (!controllerUrl.value) return;
      try {
        await fetch(`${controllerUrl.value}/on`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ t: 500 }),
        });
      } catch (e) {
        console.error("Failed to send On:", e);
      }
    };

    // Send Off command
    const sendOff = async () => {
      if (!controllerUrl.value) return;
      try {
        await fetch(`${controllerUrl.value}/off`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ t: 500 }),
        });
      } catch (e) {
        console.error("Failed to send Off:", e);
      }
    };
    const internalColor = ref("#000000");
    const colorStore = useColorDataStore();

    // Flag to prevent emitting during prop updates from websocket events
    const updatingFromProps = ref(false);

    // Watch for changes in props.modelValue
    watch(
      () => props.modelValue,
      (newValue) => {
        if (newValue?.hsv) {
          try {
            // Set flag to prevent emitting
            updatingFromProps.value = true;

            const rgb = hsvToRgb(newValue.hsv);
            internalColor.value = rgbToHex(rgb);

            // Reset flag after DOM update
            setTimeout(() => {
              updatingFromProps.value = false;
            }, 0);
          } catch (error) {
            console.log("Error converting HSV to hex:", error);
            updatingFromProps.value = false;
          }
        }
      },
      { immediate: true, deep: true },
    );

    // Watch for changes in the color picker
    watch(internalColor, (val) => {
      // Only emit if not updating from props and not from websocket
      if (!updatingFromProps.value && colorStore.change_by !== "websocket") {
        try {
          const rgb = hexToRgb(val);
          let hsv = rgbToHsv(rgb);

          // Round values to 1 decimal place instead of 2
          hsv = {
            h: Math.round(hsv.h * 10) / 10,
            s: Math.round(hsv.s * 10) / 10,
            v: Math.round(hsv.v * 10) / 10,
          };

          // Emit the new color value
          emit("update:modelValue", { hsv });
        } catch (error) {
          console.log("Error in color picker watcher:", error);
        }
      }
    });

    const onAddPreset = () => {
      // Get the current HSV value and emit it for preset creation
      const rgb = hexToRgb(internalColor.value);
      const hsv = rgbToHsv(rgb);

      emit("add-preset", {
        type: "hsv",
        value: {
          h: Math.round(hsv.h * 10) / 10,
          s: Math.round(hsv.s * 10) / 10,
          v: Math.round(hsv.v * 10) / 10,
        },
      });
    };

    return {
      internalColor,
      onAddPreset,
      sendOn,
      sendOff,
    };
  },
};
</script>

<style scoped>
.no-padding {
  padding-top: 0 !important;
  padding-bottom: 0 !important;
}
.scaled-color {
  width: 150%;
  height: 150%;
}
.hsv-section {
  display: flex;
  flex-direction: column;
}

/* On/Off button row and button styles */
.onoff-btn-row {
  display: flex;
  justify-content: space-between;
  margin: 16px 12px 0 12px;
}
.on-btn {
  flex: 1;
  margin-right: 8px;
}
.off-btn {
  flex: 1;
}
.onoff-btn {
  margin: 0 4px;
  padding: 4px 12px;
  border-radius: 6px;
  border: none;
  background: #eee;
  color: #333;
  cursor: pointer;
  font-weight: bold;
  font-size: 1em;
  transition: background 0.2s;
}
.onoff-btn:active {
  background: #ccc;
}
</style>
