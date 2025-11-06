/**
 * Common validation functions
 * For use in forms and input validation
 */

/**
 * Validates that a value is not empty
 * @param {*} value - Value to validate
 * @returns {boolean|string} true if valid, error message if invalid
 */
export function required(value) {
  if (value === null || value === undefined || value === "") {
    return "This field is required";
  }
  return true;
}

/**
 * Validates IP address format
 * @param {string} value - IP address to validate
 * @returns {boolean|string} true if valid, error message if invalid
 */
export function ipAddress(value) {
  if (!value) return true; // Allow empty (use with required() for mandatory)

  const ipPattern = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (!ipPattern.test(value)) {
    return "Invalid IP address format";
  }

  const parts = value.split(".");
  for (const part of parts) {
    const num = parseInt(part);
    if (num < 0 || num > 255) {
      return "IP address octets must be 0-255";
    }
  }

  return true;
}

/**
 * Validates hostname format
 * @param {string} value - Hostname to validate
 * @returns {boolean|string} true if valid, error message if invalid
 */
export function hostname(value) {
  if (!value) return true;

  const hostnamePattern = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/;
  if (!hostnamePattern.test(value)) {
    return "Invalid hostname format";
  }

  return true;
}

/**
 * Validates number is within range
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {Function} Validator function
 */
export function numberRange(min, max) {
  return (value) => {
    const num = Number(value);
    if (isNaN(num)) {
      return "Must be a number";
    }
    if (num < min || num > max) {
      return `Must be between ${min} and ${max}`;
    }
    return true;
  };
}

/**
 * Validates minimum length
 * @param {number} min - Minimum length
 * @returns {Function} Validator function
 */
export function minLength(min) {
  return (value) => {
    if (!value) return true;
    if (value.length < min) {
      return `Must be at least ${min} characters`;
    }
    return true;
  };
}

/**
 * Validates maximum length
 * @param {number} max - Maximum length
 * @returns {Function} Validator function
 */
export function maxLength(max) {
  return (value) => {
    if (!value) return true;
    if (value.length > max) {
      return `Must be no more than ${max} characters`;
    }
    return true;
  };
}

/**
 * Validates HSV color values
 * @param {Object} hsv - HSV color object
 * @returns {boolean|string} true if valid, error message if invalid
 */
export function hsvColor(hsv) {
  if (!hsv || typeof hsv !== "object") {
    return "Invalid color format";
  }

  const { h, s, v } = hsv;

  if (h === undefined || s === undefined || v === undefined) {
    return "HSV color must have h, s, and v properties";
  }

  if (h < 0 || h > 360) {
    return "Hue must be between 0 and 360";
  }

  if (s < 0 || s > 100) {
    return "Saturation must be between 0 and 100";
  }

  if (v < 0 || v > 100) {
    return "Value must be between 0 and 100";
  }

  return true;
}

/**
 * Validates RGB color values
 * @param {Object} rgb - RGB color object
 * @returns {boolean|string} true if valid, error message if invalid
 */
export function rgbColor(rgb) {
  if (!rgb || typeof rgb !== "object") {
    return "Invalid color format";
  }

  const { r, g, b } = rgb;

  if (r === undefined || g === undefined || b === undefined) {
    return "RGB color must have r, g, and b properties";
  }

  if (r < 0 || r > 255 || g < 0 || g > 255 || b < 0 || b > 255) {
    return "RGB values must be between 0 and 255";
  }

  return true;
}
