/**
 * Schema validator for firmware data structures
 * Based on app-data.cfgdb and defs.cfgdb schemas
 */

/**
 * Validates and coerces a preset to match the firmware schema
 * @param {Object} preset - The preset to validate
 * @returns {Object} - Validated and coerced preset
 * @throws {Error} - If validation fails
 */
export function validatePreset(preset) {
  if (!preset || typeof preset !== 'object') {
    throw new Error('Preset must be an object');
  }

  const validated = { ...preset };

  // Required fields
  if (!validated.name || typeof validated.name !== 'string') {
    throw new Error('Preset must have a string name');
  }
  if (!validated.id || typeof validated.id !== 'string') {
    throw new Error('Preset must have a string id');
  }
  if (!validated.color || typeof validated.color !== 'object') {
    throw new Error('Preset must have a color object');
  }

  // Coerce numeric fields to integers
  validated.ts = Math.floor(Number(validated.ts) || Date.now());
  
  // Coerce boolean
  validated.favorite = Boolean(validated.favorite);
  
  // Default icon
  if (!validated.icon) {
    validated.icon = 'palette';
  }

  // Validate color structure
  if (validated.color.hsv) {
    validated.color.hsv = validateHSV(validated.color.hsv);
  } else if (validated.color.raw) {
    validated.color.raw = validateRaw(validated.color.raw);
  } else {
    throw new Error('Preset color must have either hsv or raw properties');
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
  if (!scene || typeof scene !== 'object') {
    throw new Error('Scene must be an object');
  }

  const validated = { ...scene };

  // Required fields
  if (!validated.name || typeof validated.name !== 'string') {
    throw new Error('Scene must have a string name');
  }
  if (!validated.id || typeof validated.id !== 'string') {
    throw new Error('Scene must have a string id');
  }
  if (!validated.group_id || typeof validated.group_id !== 'string') {
    throw new Error('Scene must have a string group_id');
  }

  // Coerce numeric fields to integers
  validated.ts = Math.floor(Number(validated.ts) || Date.now());
  
  // Coerce boolean
  validated.favorite = Boolean(validated.favorite);
  
  // Default icon
  if (!validated.icon) {
    validated.icon = 'scene';
  }

  // Validate transition if present
  if (validated.transition) {
    validated.transition = validateTransition(validated.transition);
  }

  // Validate settings array
  if (!Array.isArray(validated.settings)) {
    throw new Error('Scene must have a settings array');
  }

  validated.settings = validated.settings.map(setting => {
    const validatedSetting = { ...setting };

    // Controller ID must be string
    if (!validatedSetting.controller_id || typeof validatedSetting.controller_id !== 'string') {
      throw new Error('Scene setting must have a string controller_id');
    }

    // Coerce pos to integer
    validatedSetting.pos = Math.floor(Number(validatedSetting.pos) || 0);

    // Validate transition if present
    if (validatedSetting.transition) {
      validatedSetting.transition = validateTransition(validatedSetting.transition);
    }

    // Validate color
    if (validatedSetting.color) {
      if (validatedSetting.color.Preset) {
        // Preset reference - just validate structure
        if (!validatedSetting.color.Preset.id || typeof validatedSetting.color.Preset.id !== 'string') {
          throw new Error('Preset reference must have string id');
        }
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
  if (!group || typeof group !== 'object') {
    throw new Error('Group must be an object');
  }

  const validated = { ...group };

  // Required fields
  if (!validated.name || typeof validated.name !== 'string') {
    throw new Error('Group must have a string name');
  }
  if (!validated.id || typeof validated.id !== 'string') {
    throw new Error('Group must have a string id');
  }
  if (!Array.isArray(validated.controller_ids)) {
    throw new Error('Group must have a controller_ids array');
  }

  // Validate controller IDs are strings
  validated.controller_ids = validated.controller_ids.map(id => String(id));

  // Coerce numeric fields to integers
  validated.ts = Math.floor(Number(validated.ts) || Date.now());
  
  // Default icon
  if (!validated.icon) {
    validated.icon = 'light_groups';
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
    throw new Error('HSV color must have h, s, and v');
  }
  if (hsv.s === undefined || hsv.s === null) {
    throw new Error('HSV color must have h, s, and v');
  }
  if (hsv.v === undefined || hsv.v === null) {
    throw new Error('HSV color must have h, s, and v');
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
    throw new Error('Raw color must have r, g, and b');
  }
  if (raw.g === undefined || raw.g === null) {
    throw new Error('Raw color must have r, g, and b');
  }
  if (raw.b === undefined || raw.b === null) {
    throw new Error('Raw color must have r, g, and b');
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
  // Validate required field
  if (!transition.cmd || typeof transition.cmd !== 'string') {
    throw new Error('Transition must have a cmd');
  }

  const validated = { ...transition };

  // Coerce numeric fields to integers
  ['d', 't', 's'].forEach(key => {
    if (validated[key] !== undefined) {
      validated[key] = Math.floor(Number(validated[key]));
    }
  });
  if (validated.q !== undefined && typeof validated.q !== 'string') {
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
    invalid: []
  };

  items.forEach((item, index) => {
    try {
      const validated = validator(item);
      results.valid.push(validated);
    } catch (error) {
      results.invalid.push({
        item,
        index,
        error: error.message
      });
    }
  });

  return results;
}
