# ESP RGBWW API Quick Reference

## Quick Test Commands

```bash
# Ping controller
curl http://192.168.1.100/ping

# Get device info
curl http://192.168.1.100/info

# Get all data
curl http://192.168.1.100/data

# Get configuration
curl http://192.168.1.100/config

# Get current color
curl http://192.168.1.100/color
```

## Common Operations

### Create a Preset

```bash
# Note: /data endpoint requires integer HSV values
curl -X POST http://192.168.1.100/data \
  -H "Content-Type: application/json" \
  -d '{
    "presets[id=\"my-preset\"]": {
      "id": "my-preset",
      "name": "Warm White",
      "ts": 1639000000,
      "favorite": false,
      "color": {
        "hsv": {
          "h": 30,
          "s": 10,
          "v": 100,
          "ct": 2700
        }
      }
    }
  }'
```

### Update Preset Name

```bash
curl -X POST http://192.168.1.100/data \
  -H "Content-Type: application/json" \
  -d '{"presets[id=\"my-preset\"].name": "New Name"}'
```

### Delete a Preset

```bash
curl -X POST http://192.168.1.100/data \
  -H "Content-Type: application/json" \
  -d '{"presets[id=\"my-preset\"]": "DELETE"}'
```

### Set Color (HSV)

```bash
# Note: /color endpoint accepts float HSV values
curl -X POST http://192.168.1.100/color \
  -H "Content-Type: application/json" \
  -d '{
    "hsv": {"h": 240.5, "s": 100.0, "v": 80.3, "ct": 3500},
    "cmd": "fade",
    "t": 2000,
    "d": 1
  }'
```

### Set Color (RAW)

```bash
curl -X POST http://192.168.1.100/color \
  -H "Content-Type: application/json" \
  -d '{
    "raw": {"r": 512, "g": 256, "b": 768, "ww": 0, "cw": 0},
    "cmd": "solid",
    "t": 1000
  }'
```

### Toggle On/Off

```bash
curl -X POST http://192.168.1.100/toggle \
  -H "Content-Type: application/json" \
  -d '{}'
```

### Blink Effect

```bash
curl -X POST http://192.168.1.100/blink \
  -H "Content-Type: application/json" \
  -d '{"t": 500, "channels": ["h", "s", "v"]}'
```

### Update Device Name

```bash
curl -X POST http://192.168.1.100/config \
  -H "Content-Type: application/json" \
  -d '{"general": {"device_name": "Living Room LED"}}'
```

### Enable MQTT

```bash
curl -X POST http://192.168.1.100/config \
  -H "Content-Type: application/json" \
  -d '{
    "network": {
      "mqtt": {
        "enabled": true,
        "server": "mqtt.local",
        "port": 1883,
        "username": "user",
        "password": "pass",
        "topic_base": "home/"
      }
    }
  }'
```

## Critical Type Requirements

### For `/color` Endpoint - Floats Accepted ✅

```json
{
  "hsv": {
    "h": 180.5,   // Float ✓
    "s": 100.0,   // Float ✓
    "v": 75.2,    // Float ✓
    "ct": 3500    // Integer (always) ✓
  }
}
```

```bash
# Example: Set color with float HSV values
curl -X POST http://192.168.1.100/color \
  -H "Content-Type: application/json" \
  -d '{"hsv": {"h": 240.5, "s": 100.0, "v": 80.3, "ct": 3500}}'
```

### For `/data` Endpoint - Integers Required ✅

```json
{
  "presets[id=\"my-preset\"]": {
    "color": {
      "hsv": {
        "h": 180,    // Integer ✓
        "s": 100,    // Integer ✓
        "v": 75,     // Integer ✓
        "ct": 3500   // Integer ✓
      }
    },
    "ts": 1639000000,  // Integer ✓
    "favorite": false   // Boolean ✓
  }
}
```

### ❌ WRONG - Floats in `/data` Stored Items

```json
{
  "presets[id=\"my-preset\"]": {
    "color": {
      "hsv": {
        "h": 180.5,   // Float ✗ - FormatError::BadType!
        "s": 100.0,   // Float ✗ - FormatError::BadType!
        "v": 75.2     // Float ✗ - FormatError::BadType!
      }
    }
  }
}
```

### ✅ CORRECT (Quoted IDs)

```json
{
  "presets[id=\"123\"]": { ... }   // Quoted ✓
}
```

### ❌ WRONG (Unquoted IDs)

```json
{
  "presets[id=123]": { ... }   // Unquoted ✗ - Bad Request!
}
```

## Value Ranges

| Field                  | Type | Range                 | Notes                    |
| ---------------------- | ---- | --------------------- | ------------------------ |
| `h` (hue)              | int  | 0-359                 | Degrees                  |
| `s` (saturation)       | int  | 0-100                 | Percentage               |
| `v` (value/brightness) | int  | 0-100                 | Percentage               |
| `ct` (color temp)      | int  | 2000-10000 or 100-500 | Kelvin or Mirek          |
| `r`, `g`, `b`          | int  | 0-1023                | PWM raw values           |
| `ww`, `cw`             | int  | 0-1023                | White channel raw        |
| `t` (time)             | int  | 0+                    | Milliseconds             |
| `d` (direction)        | int  | 0 or 1                | 0=longest, 1=shortest    |
| `ts` (timestamp)       | int  | 0+                    | Unix timestamp (seconds) |

## Response Codes

| Code | Meaning      | Common Causes                         |
| ---- | ------------ | ------------------------------------- |
| 200  | Success      | Valid request                         |
| 400  | Bad Request  | Invalid JSON, type error, unquoted ID |
| 401  | Unauthorized | API secured, auth required            |
| 404  | Not Found    | Invalid endpoint                      |
| 500  | Server Error | Firmware crash, memory error          |

## Error Messages

### FormatError::BadType

**Cause:** Float value where integer expected

**Fix:** Use `Math.floor()` or ensure all numeric values are integers

```javascript
// Wrong
const h = 35.5;

// Right
const h = Math.floor(35.5); // 35
```

### Bad Request (unquoted ID)

**Cause:** Missing quotes in array notation

**Fix:** Always quote IDs

```javascript
// Wrong
const key = `presets[id=${id}]`;

// Right
const key = `presets[id="${id}"]`;
```

## JavaScript Helpers

### Validate and Coerce Preset

```javascript
import { validatePreset } from 'src/services/schemaValidator.js';

const preset = {
  id: '123',
  name: 'Test',
  ts: Date.now() / 1000,  // May be float
  color: { hsv: { h: 35.5, s: 100.0, v: 75.2 } }  // Floats!
};

const valid = validatePreset(preset);
// Returns: { h: 35, s: 100, v: 75 } - all integers
```

### Safe Update with Quoted ID

```javascript
function updatePreset(id, preset) {
  const payload = {
    [`presets[id="${id}"]`]: preset,
  };

  return fetch("http://192.168.1.100/data", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}
```

### Handle Errors

```javascript
async function safeApiCall(endpoint, payload) {
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.json();

      if (error.error?.includes("FormatError::BadType")) {
        console.error("Type validation failed - check for floats");
      } else if (error.error?.includes("Bad Request")) {
        console.error("Bad request - check ID quoting");
      }

      throw new Error(error.error);
    }

    return await response.json();
  } catch (err) {
    console.error("API call failed:", err);
    throw err;
  }
}
```

## Sync Lock Management

### Check Sync Lock

```javascript
const data = await fetch('http://192.168.1.100/data').then(r => r.json());
const lock = data['sync-lock'];
const now = Math.floor(Date.now() / 1000);
const lockAge = now - lock.ts;

if (lock.id && lockAge < 6) {
  console.warn(`Locked by ${lock.id} (${lockAge}s ago)`);
  // Wait or skip operation
} else {
  // Safe to proceed
}
```

### Acquire Sync Lock

```javascript
const myId = "webapp-12345";
const now = Math.floor(Date.now() / 1000);

await fetch("http://192.168.1.100/data", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    "sync-lock.id": myId,
    "sync-lock.ts": now,
  }),
});
```

### Release Sync Lock

```javascript
await fetch("http://192.168.1.100/data", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    "sync-lock.id": "",
    "sync-lock.ts": 0,
  }),
});
```

## Testing

### Run All Tests

```bash
./run-api-tests.sh
```

### Run Specific Tests

```bash
./run-api-tests.sh -t "GET /data"
./run-api-tests.sh -t "Color"
./run-api-tests.sh -t "Configuration"
```

### Watch Mode

```bash
./run-api-tests.sh -w
```

### Verbose Output

```bash
./run-api-tests.sh -v
```

## Documentation Files

- **API_DOCUMENTATION.md** - Complete API reference (30+ pages)
- **API_TESTING.md** - Test setup and troubleshooting guide
- **api.integration.spec.js** - 40+ integration tests
- **run-api-tests.sh** - Convenient test runner script

## Resources

- [Full API Documentation](./API_DOCUMENTATION.md)
- [Testing Guide](./API_TESTING.md)
- [GitHub Wiki](https://github.com/verybadsoldier/esp_rgbww_firmware/wiki/HTTP-Interface)
- [Schema Validator](./src/services/schemaValidator.js)
