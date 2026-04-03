import { ref, watch } from "vue";

function getPathValue(source, path, fallback) {
  if (!source || !path) {
    return fallback;
  }

  const result = path.split(".").reduce((value, key) => {
    if (value == null) {
      return undefined;
    }

    return value[key];
  }, source);

  return result === undefined ? fallback : result;
}

export function useConfigBinding(configData, path, options = {}) {
  const {
    fallback = "",
    persist = false,
    normalize,
  } = options;

  const model = ref(getPathValue(configData.data, path, fallback));

  watch(
    () => getPathValue(configData.data, path, fallback),
    (nextValue) => {
      model.value = nextValue;
    },
  );

  const save = (nextValue = model.value) => {
    // When used as @blur="save", Vue passes a FocusEvent object.
    // In that case persist the already-bound model value instead.
    if (
      nextValue &&
      typeof nextValue === "object" &&
      "target" in nextValue &&
      typeof nextValue.preventDefault === "function"
    ) {
      nextValue = model.value;
    }

    const normalizedValue = normalize ? normalize(nextValue) : nextValue;
    model.value = normalizedValue;
    configData.updateData(path, normalizedValue, persist);
  };

  return {
    model,
    save,
  };
}
