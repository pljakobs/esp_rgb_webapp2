import { reactive, ref, watch, onBeforeUnmount } from "vue";
import { useControllersStore } from "src/stores/controllersStore";
import {
  sensorDefinitions,
  sensorRequest,
  settingsPayload,
} from "src/services/sensors";

export function useSensors(expanded) {
  const controllers = useControllersStore();
  const sensors = reactive(
    sensorDefinitions.map((definition) => ({
      ...definition,
      config: null,
      draft: {},
      reading: null,
      history: [],
      supported: null,
      error: "",
      actionError: "",
      saving: false,
    })),
  );
  const loading = ref(false);
  let generation = 0;
  let timer;
  let disposed = false;
  const current = (token) => !disposed && token === generation;

  function reset() {
    for (const sensor of sensors) {
      Object.assign(sensor, {
        config: null,
        draft: {},
        reading: null,
        history: [],
        supported: null,
        error: "",
        actionError: "",
        saving: false,
      });
    }
  }

  async function loadConfig(sensor, controller, token) {
    try {
      const config = await sensorRequest(sensor.id, "config", controller);
      if (!current(token)) return;
      if (!sensor.config) sensor.draft = { ...config };
      sensor.config = config;
      sensor.supported = true;
      sensor.error = "";
    } catch (error) {
      if (!current(token)) return;
      sensor.supported = error.status === 404 ? false : null;
      sensor.error = error.message;
    }
  }

  async function read(sensor, controller, token) {
    try {
      const reading = await sensorRequest(sensor.id, "readings", controller);
      if (!current(token)) return;
      sensor.reading = reading;
      sensor.error = reading.error || "";
      if (sensor.name === "current") {
        const x = Date.now() - (reading.valid ? reading.age_ms : 0);
        const last = sensor.history.at(-1);
        if (!last || x > last.x + 50) {
          sensor.history.push({
            x,
            y:
              reading.valid && Number.isFinite(reading.current_a)
                ? reading.current_a
                : null,
          });
          sensor.history = sensor.history.slice(-120);
        }
      }
    } catch (error) {
      if (!current(token)) return;
      sensor.reading = null;
      sensor.error = error.message;
      if (sensor.name === "current") {
        sensor.history.push({ x: Date.now(), y: null });
        sensor.history = sensor.history.slice(-120);
      }
      if (error.status === 404) sensor.config.available = false;
    }
  }

  async function poll(controller, token) {
    for (const sensor of sensors) {
      if (!current(token)) return;
      if (sensor.saving || !sensor.config?.enabled) continue;
      if (!sensor.config.available) {
        await loadConfig(sensor, controller, token);
      }
      if (!current(token)) return;
      if (sensor.config?.available) await read(sensor, controller, token);
    }
    if (current(token)) timer = setTimeout(() => poll(controller, token), 2000);
  }

  async function reload() {
    const token = ++generation;
    clearTimeout(timer);
    reset();
    const controller = controllers.currentController;
    loading.value = Boolean(controller && expanded.value);
    if (!controller || !expanded.value) return;
    for (const sensor of sensors) {
      await loadConfig(sensor, controller, token);
      if (!current(token)) return;
    }
    loading.value = false;
    await poll(controller, token);
  }

  async function save(sensor) {
    const token = generation;
    const controller = controllers.currentController;
    sensor.saving = true;
    sensor.actionError = "";
    try {
      const payload = settingsPayload(sensor, sensor.draft);
      const config = await sensorRequest(
        sensor.id,
        "config",
        controller,
        payload,
      );
      if (!current(token)) return;
      sensor.config = config;
      sensor.draft = { ...config };
      sensor.reading = null;
      sensor.history = [];
    } catch (error) {
      if (current(token)) sensor.actionError = error.message;
    } finally {
      if (current(token)) sensor.saving = false;
    }
  }

  async function measure(sensor) {
    const token = generation;
    sensor.saving = true;
    sensor.actionError = "";
    try {
      await sensorRequest(
        sensor.id,
        "start_measurement",
        controllers.currentController,
        {},
      );
      if (current(token)) sensor.reading = { valid: false, state: "measuring" };
    } catch (error) {
      if (current(token)) sensor.actionError = error.message;
    } finally {
      if (current(token)) sensor.saving = false;
    }
  }

  watch([() => controllers.currentController?.ip_address, expanded], reload, {
    immediate: true,
  });
  onBeforeUnmount(() => {
    disposed = true;
    generation++;
    clearTimeout(timer);
  });
  return { sensors, loading, reload, save, measure };
}
