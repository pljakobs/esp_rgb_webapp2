/**
 * Schema validator for firmware data structures
 * Based on app-data.cfgdb and defs.cfgdb schemas
 */

import appDataSchemaRaw from "../schemas/firmware/app-data.cfgdb?raw";
import appConfigSchemaRaw from "../schemas/firmware/app-config.cfgdb?raw";
import defsSchemaRaw from "../schemas/firmware/defs.cfgdb?raw";

function parseSchema(raw, name) {
  try {
    return JSON.parse(raw);
  } catch (error) {
    return {
      __schemaLoadError: `Failed to parse ${name}: ${error.message}`,
    };
  }
}

const appDataSchema = parseSchema(appDataSchemaRaw, "app-data.cfgdb");
const appConfigSchema = parseSchema(appConfigSchemaRaw, "app-config.cfgdb");
const defsSchema = parseSchema(defsSchemaRaw, "defs.cfgdb");

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function getByPath(obj, path) {
  return path
    .split("/")
    .filter(Boolean)
    .reduce((acc, key) => (acc ? acc[key] : undefined), obj);
}

function resolveRef(ref, rootSchema) {
  if (ref.startsWith("#/$defs/")) {
    return getByPath(rootSchema, ref.replace("#", ""));
  }
  if (ref.startsWith("#/")) {
    return getByPath(rootSchema, ref.replace("#", ""));
  }
  if (ref.startsWith("defs/$defs/")) {
    return getByPath(defsSchema, `/${ref}`);
  }
  return undefined;
}

function normalizeSchema(schema, rootSchema) {
  if (!schema || !isPlainObject(schema)) {
    return schema;
  }

  if (!schema.$ref) {
    return schema;
  }

  const resolved = resolveRef(schema.$ref, rootSchema);
  if (!resolved || !isPlainObject(resolved)) {
    return schema;
  }

  const { $ref, ...localSchema } = schema;
  return {
    ...resolved,
    ...localSchema,
    properties: {
      ...(resolved.properties || {}),
      ...(localSchema.properties || {}),
    },
  };
}

function canonicalKeyFromSelector(key) {
  const idx = key.indexOf("[");
  return idx === -1 ? key : key.slice(0, idx);
}

function selectorItemSchemaForValue(propSchema, value) {
  if (!propSchema || propSchema.type !== "array") {
    return propSchema;
  }

  if (Array.isArray(value)) {
    return {
      type: "array",
      items: propSchema.items,
    };
  }

  return propSchema.items || propSchema;
}

function validateNode(value, schema, path, rootSchema, errors) {
  let activeSchema = normalizeSchema(schema, rootSchema);

  if (!activeSchema || !isPlainObject(activeSchema)) {
    return;
  }

  if (activeSchema.oneOf && Array.isArray(activeSchema.oneOf)) {
    const oneOfValid = activeSchema.oneOf.some((branch) => {
      const branchErrors = [];
      validateNode(value, branch, path, rootSchema, branchErrors);
      return branchErrors.length === 0;
    });

    if (!oneOfValid) {
      errors.push(`${path}: value does not match any allowed schema branch`);
    }
    return;
  }

  if (activeSchema.enum && Array.isArray(activeSchema.enum)) {
    if (!activeSchema.enum.includes(value)) {
      errors.push(`${path}: value must be one of [${activeSchema.enum.join(", ")}]`);
    }
    return;
  }

  const type = activeSchema.type;

  if (type === "object" || (!type && activeSchema.properties)) {
    if (!isPlainObject(value)) {
      errors.push(`${path}: expected object`);
      return;
    }

    const properties = activeSchema.properties || {};

    for (const required of activeSchema.required || []) {
      if (!(required in value)) {
        errors.push(`${path}: missing required property '${required}'`);
      }
    }

    for (const [key, childValue] of Object.entries(value)) {
      const childPath = path === "$" ? `$.${key}` : `${path}.${key}`;
      const directSchema = properties[key];
      const canonicalSchema = properties[canonicalKeyFromSelector(key)];

      let childSchema = directSchema;
      if (!childSchema && canonicalSchema) {
        childSchema = selectorItemSchemaForValue(canonicalSchema, childValue);
      }

      if (!childSchema) {
        errors.push(`${childPath}: unknown property`);
        continue;
      }

      validateNode(childValue, childSchema, childPath, rootSchema, errors);
    }
    return;
  }

  if (type === "array") {
    if (!Array.isArray(value)) {
      errors.push(`${path}: expected array`);
      return;
    }

    if (Number.isInteger(activeSchema.minItems) && value.length < activeSchema.minItems) {
      errors.push(`${path}: expected at least ${activeSchema.minItems} items`);
    }
    if (Number.isInteger(activeSchema.maxItems) && value.length > activeSchema.maxItems) {
      errors.push(`${path}: expected at most ${activeSchema.maxItems} items`);
    }

    if (activeSchema.items) {
      value.forEach((item, index) => {
        validateNode(item, activeSchema.items, `${path}[${index}]`, rootSchema, errors);
      });
    }
    return;
  }

  if (type === "string") {
    if (typeof value !== "string") {
      errors.push(`${path}: expected string`);
    }
    return;
  }

  if (type === "boolean") {
    if (typeof value !== "boolean") {
      errors.push(`${path}: expected boolean`);
    }
    return;
  }

  if (type === "integer" || type === "number") {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      errors.push(`${path}: expected ${type}`);
      return;
    }

    if (type === "integer" && !Number.isInteger(value)) {
      errors.push(`${path}: expected integer`);
      return;
    }

    if (typeof activeSchema.minimum === "number" && value < activeSchema.minimum) {
      errors.push(`${path}: must be >= ${activeSchema.minimum}`);
    }
    if (typeof activeSchema.maximum === "number" && value > activeSchema.maximum) {
      errors.push(`${path}: must be <= ${activeSchema.maximum}`);
    }
  }
}

function validateAgainstSchema(payload, schema, schemaName) {
  if (schema?.__schemaLoadError) {
    return {
      valid: false,
      errors: [schema.__schemaLoadError],
      schema: schemaName,
    };
  }

  const errors = [];
  validateNode(payload, schema, "$", schema, errors);
  return {
    valid: errors.length === 0,
    errors,
    schema: schemaName,
  };
}

export function validateDataPayload(payload) {
  return validateAgainstSchema(payload, appDataSchema, "app-data.cfgdb");
}

export function validateConfigPayload(payload) {
  return validateAgainstSchema(payload, appConfigSchema, "app-config.cfgdb");
}

/**
 * Validates and coerces a preset to match the firmware schema
 * @param {Object} preset - The preset to validate
 * @returns {Object} - Validated and coerced preset
 * @throws {Error} - If validation fails
 */
export function validatePreset(preset) {
  if (!preset || typeof preset !== "object") {
    throw new Error("Preset must be an object");
  }

  const validated = { ...preset };

  // Required fields
  if (!validated.name || typeof validated.name !== "string") {
    throw new Error("Preset must have a string name");
  }
  if (!validated.id || typeof validated.id !== "string") {
    throw new Error("Preset must have a string id");
  }
  if (!validated.color || typeof validated.color !== "object") {
    throw new Error("Preset must have a color object");
  }

  // Coerce numeric fields to integers
  validated.ts = Math.floor(Number(validated.ts) || Date.now());

  // Coerce boolean
  validated.favorite = Boolean(validated.favorite);

  // Default icon
  if (!validated.icon) {
    validated.icon = "palette";
  }

  // Validate color structure
  if (validated.color.hsv) {
    validated.color.hsv = validateHSV(validated.color.hsv);
  } else if (validated.color.raw) {
    validated.color.raw = validateRaw(validated.color.raw);
  } else {
    throw new Error("Preset color must have either hsv or raw properties");
  }

  return validated;
}

/**
 * Validates and coerces a scene to match the firmware schema
 * @param {Object} scene - The scene to validate
 * @returns {Object} - Validated and coerced scene
 * @throws {Error} - If validation fails
 */
export function validateScene(scene) {
  if (!scene || typeof scene !== "object") {
    throw new Error("Scene must be an object");
  }

  const validated = { ...scene };

  // Required fields
  if (!validated.name || typeof validated.name !== "string") {
    throw new Error("Scene must have a string name");
  }
  if (!validated.id || typeof validated.id !== "string") {
    throw new Error("Scene must have a string id");
  }
  if (!validated.group_id || typeof validated.group_id !== "string") {
    throw new Error("Scene must have a string group_id");
  }

  // Coerce numeric fields to integers
  validated.ts = Math.floor(Number(validated.ts) || Date.now());

  // Coerce boolean
  validated.favorite = Boolean(validated.favorite);

  // Default icon
  if (!validated.icon) {
    validated.icon = "scene";
  }

  // Validate transition if present
  if (validated.transition) {
    validated.transition = validateTransition(validated.transition);
  }

  // Validate settings array
  if (!Array.isArray(validated.settings)) {
    throw new Error("Scene must have a settings array");
  }

  validated.settings = validated.settings.map((setting) => {
    const validatedSetting = { ...setting };

    // Controller ID must be string
    if (
      !validatedSetting.controller_id ||
      typeof validatedSetting.controller_id !== "string"
    ) {
      throw new Error("Scene setting must have a string controller_id");
    }

    // Coerce pos to integer
    validatedSetting.pos = Math.floor(Number(validatedSetting.pos) || 0);

    // Validate transition if present
    if (validatedSetting.transition) {
      validatedSetting.transition = validateTransition(
        validatedSetting.transition,
      );
    }

    // Validate color
    if (validatedSetting.color) {
      if (validatedSetting.color.Preset) {
        // Normalize legacy wrapper to cfgdb oneOf Preset shape: { id: "..." }
        if (
          !validatedSetting.color.Preset.id ||
          typeof validatedSetting.color.Preset.id !== "string"
        ) {
          throw new Error("Preset reference must have string id");
        }
        validatedSetting.color = { id: validatedSetting.color.Preset.id };
      } else if (
        validatedSetting.color.id &&
        typeof validatedSetting.color.id === "string"
      ) {
        validatedSetting.color = { id: validatedSetting.color.id };
      } else if (validatedSetting.color.hsv) {
        validatedSetting.color.hsv = validateHSV(validatedSetting.color.hsv);
      } else if (validatedSetting.color.raw) {
        validatedSetting.color.raw = validateRaw(validatedSetting.color.raw);
      }
    }

    return validatedSetting;
  });

  return validated;
}

/**
 * Validates and coerces a group to match the firmware schema
 * @param {Object} group - The group to validate
 * @returns {Object} - Validated and coerced group
 * @throws {Error} - If validation fails
 */
export function validateGroup(group) {
  if (!group || typeof group !== "object") {
    throw new Error("Group must be an object");
  }

  const validated = { ...group };

  // Required fields
  if (!validated.name || typeof validated.name !== "string") {
    throw new Error("Group must have a string name");
  }
  if (!validated.id || typeof validated.id !== "string") {
    throw new Error("Group must have a string id");
  }
  if (!Array.isArray(validated.controller_ids)) {
    throw new Error("Group must have a controller_ids array");
  }

  // Validate controller IDs are strings
  validated.controller_ids = validated.controller_ids.map((id) => String(id));

  // Coerce numeric fields to integers
  validated.ts = Math.floor(Number(validated.ts) || Date.now());

  // Default icon
  if (!validated.icon) {
    validated.icon = "light_groups";
  }

  return validated;
}

/**
 * Validates HSV color values
 * @param {Object} hsv - HSV color object
 * @returns {Object} - Validated HSV
 */
export function validateHSV(hsv) {
  // Validate required fields
  if (hsv.h === undefined || hsv.h === null) {
    throw new Error("HSV color must have h, s, and v");
  }
  if (hsv.s === undefined || hsv.s === null) {
    throw new Error("HSV color must have h, s, and v");
  }
  if (hsv.v === undefined || hsv.v === null) {
    throw new Error("HSV color must have h, s, and v");
  }

  const validated = {};

  // All values must be integers within range
  validated.h = Math.floor(Number(hsv.h));
  validated.s = Math.floor(Number(hsv.s));
  validated.v = Math.floor(Number(hsv.v));
  validated.ct = Math.floor(Number(hsv.ct) || 0);

  // Clamp to valid ranges
  validated.h = Math.max(0, Math.min(359, validated.h));
  validated.s = Math.max(0, Math.min(100, validated.s));
  validated.v = Math.max(0, Math.min(100, validated.v));
  validated.ct = Math.max(0, Math.min(10000, validated.ct));

  return validated;
}

/**
 * Validates raw color values
 * @param {Object} raw - Raw color object
 * @returns {Object} - Validated raw color
 */
export function validateRaw(raw) {
  // Validate required fields
  if (raw.r === undefined || raw.r === null) {
    throw new Error("Raw color must have r, g, and b");
  }
  if (raw.g === undefined || raw.g === null) {
    throw new Error("Raw color must have r, g, and b");
  }
  if (raw.b === undefined || raw.b === null) {
    throw new Error("Raw color must have r, g, and b");
  }

  const validated = {};

  // All values must be integers within range 0-1023
  validated.r = Math.floor(Number(raw.r));
  validated.r = Math.max(0, Math.min(1023, validated.r));

  validated.g = Math.floor(Number(raw.g));
  validated.g = Math.max(0, Math.min(1023, validated.g));

  validated.b = Math.floor(Number(raw.b));
  validated.b = Math.max(0, Math.min(1023, validated.b));

  // Optional ww and cw default to 0
  validated.ww = raw.ww !== undefined ? Math.floor(Number(raw.ww)) : 0;
  validated.ww = Math.max(0, Math.min(1023, validated.ww));

  validated.cw = raw.cw !== undefined ? Math.floor(Number(raw.cw)) : 0;
  validated.cw = Math.max(0, Math.min(1023, validated.cw));

  return validated;
}

/**
 * Validates transition object
 * @param {Object} transition - Transition object
 * @returns {Object} - Validated transition
 */
export function validateTransition(transition) {
  const validated = { ...transition };

  // Coerce numeric fields to integers
  ["d", "t", "s"].forEach((key) => {
    if (validated[key] !== undefined) {
      validated[key] = Math.floor(Number(validated[key]));
    }
  });

  // Normalize nullable strings from legacy payloads
  if (validated.cmd === undefined) {
    throw new Error("Transition must have a cmd");
  } else if (validated.cmd === null) {
    validated.cmd = "";
  } else if (typeof validated.cmd !== "string") {
    validated.cmd = String(validated.cmd);
  }

  if (validated.q === null || validated.q === undefined) {
    validated.q = "";
  } else if (typeof validated.q !== "string") {
    validated.q = String(validated.q);
  }

  // Boolean field
  if (validated.r !== undefined) {
    validated.r = Boolean(validated.r);
  }

  return validated;
}

/**
 * Validates a batch of items
 * @param {Array} items - Items to validate
 * @param {Function} validator - Validator function to use
 * @returns {Object} - {valid: Array, invalid: Array with errors}
 */
export function validateBatch(items, validator) {
  const results = {
    valid: [],
    invalid: [],
  };

  items.forEach((item, index) => {
    try {
      const validated = validator(item);
      results.valid.push(validated);
    } catch (error) {
      results.invalid.push({
        item,
        index,
        error: error.message,
      });
    }
  });

  return results;
}
