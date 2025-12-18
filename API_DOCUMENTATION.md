# ESP RGBWW Firmware HTTP API Documentation

**Version:** 4.2.0+  
**Base URL:** `http://<controller-ip>/`  
**Content-Type:** `application/json`  
**Authentication:** Optional HTTP Basic Auth (configurable)

---

## Table of Contents

1. [General Information](#general-information)
2. [Data Endpoints](#data-endpoints)
   - [GET /data](#get-data)
   - [POST /data](#post-data)
3. [Configuration Endpoints](#configuration-endpoints)
   - [GET /config](#get-config)
   - [POST /config](#post-config)
4. [System Information](#system-information)
   - [GET /info](#get-info)
   - [GET /ping](#get-ping)
5. [Color Control](#color-control)
   - [GET /color](#get-color)
   - [POST /color](#post-color)
6. [Animation Control](#animation-control)
7. [System Control](#system-control)
8. [Network Management](#network-management)
9. [OTA Update](#ota-update)
10. [Error Codes](#error-codes)
11. [Data Type Reference](#data-type-reference)

---

## General Information

### Response Format

All successful responses return HTTP 200 with JSON body.

**Success Response:**

```json
{ "success": true }
```

**Error Response:**

```json
{ "error": "error message" }
```

### HTTP Error Codes

- `200 OK` - Request successful
- `400 BAD REQUEST` - Invalid request format or validation error
- `401 UNAUTHORIZED` - Authentication required or failed
- `404 NOT FOUND` - Endpoint does not exist
- `500 INTERNAL SERVER ERROR` - Firmware error

---

## Data Endpoints

### GET /data

Retrieve all application data including presets, scenes, groups, and controllers.

**Schema Reference:** `app-data.cfgdb`

#### Response

```json
{
  "sync-lock": {
    "id": "controller-id-or-empty",
    "ts": 1639000000
  },
  "last-color": {
    "h": 180,
    "s": 100,
    "v": 75,
    "ct": 3500
  },
  "presets": [
    {
      "id": "preset-123",
      "name": "Warm White",
      "ts": 1639000000,
      "favorite": false,
      "icon": "palette",
      "color": {
        "hsv": {
          "h": 30,
          "s": 10,
          "v": 100,
          "ct": 2700
        }
      }
    }
  ],
  "scenes": [
    {
      "id": "scene-456",
      "name": "Evening Scene",
      "ts": 1639000000,
      "group_id": "group-789",
      "favorite": true,
      "icon": "scene",
      "transition": {
        "cmd": "fade",
        "t": 2000,
        "d": 1,
        "s": 50
      },
      "settings": [
        {
          "controller_id": "ctrl-1",
          "pos": 0,
          "color": {
            "hsv": {
              "h": 30,
              "s": 80,
              "v": 60,
              "ct": 3000
            }
          },
          "transition": {
            "cmd": "fade",
            "t": 1000,
            "d": 1
          }
        }
      ]
    }
  ],
  "groups": [
    {
      "id": "group-789",
      "name": "Living Room",
      "ts": 1639000000,
      "icon": "light_groups",
      "controller_ids": ["ctrl-1", "ctrl-2"]
    }
  ],
  "controllers": [
    {
      "id": "ctrl-1",
      "name": "LED Strip 1",
      "ip-address": "192.168.1.100",
      "icon": "lights/led-strip-variant",
      "ts": 1639000000
    }
  ]
}
```

#### Data Type Requirements (CRITICAL)

**Type requirements depend on the endpoint:**

**For `/color` endpoint (GET/POST):**

- **HSV values:** Floats accepted (type: `number`)
  - `h` (hue): Float `0.0-359.0`
  - `s` (saturation): Float `0.0-100.0`
  - `v` (value/brightness): Float `0.0-100.0`
  - `ct` (color temperature): Integer `0-10000` (Kelvin) or `100-500` (mirek)
- **Raw values:** Integers (type: `integer`)
  - `r`, `g`, `b`, `ww`, `cw`: Integer `0-1023`

**For `/data` endpoint (stored data - presets, scenes, groups):**

- **Timestamps (`ts`)**: Integer (Unix timestamp in seconds)
- **HSV values in stored items:** MUST be integers (type: `integer` in hsvct)
  - `h` (hue): Integer `0-359`
  - `s` (saturation): Integer `0-100`
  - `v` (value/brightness): Integer `0-100`
  - `ct` (color temperature): Integer `0-10000` (Kelvin)
- **Raw values:**
  - `r`, `g`, `b`, `ww`, `cw`: Integer `0-1023`
- **Transition values:**
  - `t` (time): Integer (milliseconds)
  - `d` (direction): Integer `0` or `1`
  - `s` (speed): Integer (ramp speed)
- **Booleans**: `true` or `false` (not `1`/`0`)
- **IDs**: Always strings (even if numeric)

**Firmware will return `FormatError::BadType` for:**

- Float values in `/data` stored items (presets/scenes use `hsvct` schema requiring integers)
- Numeric IDs instead of strings (e.g., `123` instead of `\"123\"`)
- Out-of-range values

---

### POST /data

Update application data using array notation with UPDATE/DELETE commands.

#### Request Format

**Array Notation Syntax:**

```
<array_name>[id="<item_id>"].<field>
```

**CRITICAL:** IDs MUST be quoted strings in array notation.

**Examples:**

```json
{
  "presets[id=\"preset-123\"].name": "New Name",
  "presets[id=\"preset-123\"].color.hsv.h": 180,
  "scenes[id=\"scene-456\"].favorite": true,
  "groups[id=\"group-789\"].controller_ids": ["ctrl-1", "ctrl-2"]
}
```

#### Command Operations

**UPDATE - Modify or create items:**

```json
{
  "presets[id=\"new-preset\"]": {
    "id": "new-preset",
    "name": "Sunset",
    "ts": 1639000000,
    "favorite": false,
    "color": {
      "hsv": {
        "h": 30,
        "s": 90,
        "v": 80,
        "ct": 2500
      }
    }
  }
}
```

**DELETE - Remove items:**

```json
{
  "presets[id=\"old-preset\"]": "DELETE"
}
```

#### Common Errors

**Bad Request Examples:**

❌ **Unquoted ID:**

```json
{
  "presets[id=123].name": "Test"  // WRONG
}
```

✅ **Correct:**

```json
{
  "presets[id=\"123\"].name": "Test"
}
```

❌ **Float instead of integer:**

```json
{
  "presets[id=\"123\"].color.hsv.h": 35.5  // WRONG
}
```

✅ **Correct:**

```json
{
  "presets[id=\"123\"].color.hsv.h": 35
}
```

#### Response

```json
{ "success": true }
```

**Error Response:**

```json
{ "error": "FormatError::BadType: Expected integer" }
```

---

## Configuration Endpoints

### GET /config

Retrieve all configuration settings.

**Schema Reference:** `app-config.cfgdb`

#### Response

```json
{
  "general": {
    "is_initialized": true,
    "device_name": "Living Room LED",
    "buttons_debounce_ms": 50,
    "buttons_config": "",
    "pin_config_url": "https://raw.githubusercontent.com/.../pinconfig.json",
    "supported_color_models": ["RGB", "RGBWW", "RGBCW", "RGBWWCW"],
    "current_pin_config_name": "mrpj"
  },
  "network": {
    "connection": {
      "dhcp": true,
      "ip": "192.168.1.100",
      "netmask": "255.255.255.0",
      "gateway": "192.168.1.1"
    },
    "ap": {
      "secured": true,
      "password": "********",
      "ssid": "ESP_RGBWW_123456"
    },
    "mqtt": {
      "enabled": true,
      "server": "mqtt.local",
      "port": 1883,
      "username": "user",
      "password": "********",
      "topic_base": "home/",
      "homeassistant": {
        "enable": true,
        "discovery_prefix": "homeassistant",
        "node_id": "rgbww_led1"
      }
    },
    "ntp": {
      "enabled": true,
      "server": "pool.ntp.org",
      "interval": 3600
    },
    "mdns": {
      "enabled": true,
      "name": "livingroom-led"
    }
  },
  "color": {
    "startup_color": "last",
    "color_mode": 0,
    "brightness": {
      "red": 100,
      "green": 100,
      "blue": 100,
      "ww": 100,
      "cw": 100
    },
    "colortemp": {
      "ww": 2700,
      "cw": 6000
    },
    "hsv": {
      "model": 0,
      "red": 0,
      "yellow": 0,
      "green": 0,
      "cyan": 0,
      "blue": 0,
      "magenta": 0
    }
  },
  "security": {
    "api_secured": false,
    "api_password": "********"
  },
  "sync": {
    "cmd_master_enabled": false,
    "cmd_slave_enabled": false,
    "cmd_slave_topic": "home/led/command",
    "color_master_enabled": false,
    "color_master_interval_ms": 0,
    "color_slave_enabled": false,
    "color_slave_topic": "home/led1/command",
    "clock_master_enabled": false,
    "clock_master_interval": 30,
    "clock_slave_enabled": false,
    "clock_slave_topic": "home/led1/clock"
  },
  "events": {
    "color_interval_ms": 500,
    "color_min_interval_ms": 500,
    "trans_fin_interval_ms": 1000,
    "server_enabled": true
  },
  "hardware": {
    "version": 0,
    "pwm": {
      "timer": {
        "speed_mode": "LOWSPEED",
        "frequency": 1000,
        "resolution": 10,
        "number": 0
      },
      "spreadSpectrum": {
        "mode": "ON",
        "width": 15,
        "subsampling": 4
      },
      "phaseShift": {
        "mode": "ON"
      }
    }
  },
  "ota": {
    "url": "http://lightinator.de/version.json"
  },
  "telemetry": {
    "statsEnabled": "OFF",
    "logEnabled": "OFF",
    "url": "lightinator.de:1883",
    "user": "rgbww",
    "password": "********",
    "numReboots": 5
  }
}
```

**Note:** Passwords are masked in responses for security.

---

### POST /config

Update configuration settings. Can update one or more fields.

#### Request

**Partial update (recommended):**

```json
{
  "general": {
    "device_name": "Bedroom LED"
  },
  "network": {
    "mqtt": {
      "enabled": true,
      "server": "192.168.1.50",
      "username": "newuser",
      "password": "newpass"
    }
  }
}
```

**Set passwords:**

```json
{
  "security": {
    "api_secured": true,
    "api_password": "mysecretpass"
  },
  "network": {
    "ap": {
      "secured": true,
      "password": "appassword"
    }
  }
}
```

#### Response

```json
{ "success": true }
```

**Error:**

```json
{ "error": "Invalid configuration field" }
```

---

## System Information

### GET /info

Get controller information, version, network status, and system stats.

#### Response

```json
{
  "deviceid": "538282",
  "current_rom": "0",
  "git_version": "4.2.0-rc1",
  "git_date": "2019-06-26",
  "webapp_version": "0.3.3-shojo7",
  "sming": "3.8.0",
  "event_num_clients": 1,
  "uptime": 321540,
  "heap_free": 22536,
  "rgbww": {
    "version": "0.9.0",
    "queuesize": 100
  },
  "connection": {
    "connected": true,
    "ssid": "MyNetwork",
    "dhcp": true,
    "ip": "192.168.2.53",
    "netmask": "255.255.255.0",
    "gateway": "192.168.2.1",
    "mac": "a0:20:a6:08:36:aa"
  }
}
```

---

### GET /ping

Simple connectivity check.

#### Response

```json
{ "ping": "pong" }
```

---

## Color Control

### GET /color

Get current color values in both HSV and RAW modes.

#### Response

```json
{
  "raw": {
    "r": 512,
    "g": 256,
    "b": 768,
    "ww": 400,
    "cw": 200
  },
  "hsv": {
    "h": 126.98,
    "s": 96.97,
    "v": 75.32,
    "ct": 3180
  }
}
```

**HSV Values (returned as floats):**

- `h` - Hue (float): `0.0-359.0`
- `s` - Saturation (float): `0.0-100.0`
- `v` - Value/Brightness (float): `0.0-100.0`
- `ct` - Color Temperature (integer): `100-500` (mirek) or `2000-10000` (Kelvin)

**RAW Values (integers):**

- `r`, `g`, `b`, `ww`, `cw` - Channel values (integer): `0-1023`

---

### POST /color

Set color with transition options.

#### Request

**HSV Mode (floats accepted):**

```json
{
  "hsv": {
    "h": 200.5,
    "s": 100.0,
    "v": 85.3,
    "ct": 3500
  },
  "cmd": "fade",
  "t": 2000,
  "s": 50,
  "d": 1,
  "q": "single",
  "r": false
}
```

**RAW Mode:**

```json
{
  "raw": {
    "r": 1023,
    "g": 512,
    "b": 256,
    "ww": 0,
    "cw": 0
  },
  "cmd": "solid",
  "t": 5000
}
```

**Parameters:**

- `cmd` - Command type:
  - `fade` - Fade to color over time `t`
  - `solid` - Show color for duration `t`
- `t` - Time in milliseconds (transition duration or display time)
- `s` - Speed (ramp speed value)
- `d` - Direction:
  - `1` - Shortest path (default)
  - `0` - Longest path
- `q` - Queue policy (see [Queue Policies](https://github.com/verybadsoldier/esp_rgbww_firmware/wiki/Queue-Policies))
- `r` - Requeue flag (see [Requeue Flag](https://github.com/verybadsoldier/esp_rgbww_firmware/wiki/Requeue-Flag))
- `name` - Named animation (see [Named Animations](https://github.com/verybadsoldier/esp_rgbww_firmware/wiki/Named-Animations))
- `channels` - Target channels (see [Independent Animation Channels](https://github.com/verybadsoldier/esp_rgbww_firmware/wiki/Independent-Animation-Channels))

#### Response

```json
{ "success": true }
```

---

## Animation Control

### POST /stop

Stop animation and clear queues.

```json
{
  "channels": ["h", "s", "v"]
}
```

### POST /pause

Pause current animation (preserves queue).

```json
{
  "channels": ["h", "s"]
}
```

### POST /continue

Resume paused animation.

```json
{}
```

### POST /skip

Skip current animation, execute next in queue.

```json
{
  "channels": ["h"]
}
```

### POST /blink

Execute blink effect.

```json
{
  "channels": ["h", "s", "v"],
  "t": 500,
  "q": "single"
}
```

### POST /toggle

Toggle controller on/off.

```json
{}
```

**Response:** `{ "success": true }`

---

## System Control

### POST /system

Execute system commands.

#### Request

**Restart:**

```json
{ "cmd": "restart" }
```

**Factory Reset:**

```json
{ "cmd": "reset" }
```

**Forget WiFi:**

```json
{ "cmd": "forget_wifi" }
```

**Stop Access Point:**

```json
{ "cmd": "stop_ap" }
```

**Switch ROM:**

```json
{ "cmd": "switch_rom" }
```

**Debug Mode:**

```json
{
  "cmd": "debug",
  "enable": true
}
```

#### Response

```json
{ "success": true }
```

---

## Network Management

### GET /networks

List available WiFi networks.

#### Response

```json
{
  "scanning": false,
  "available": [
    {
      "id": "1",
      "ssid": "Network_1",
      "signal": -53,
      "encryption": "WPA2"
    },
    {
      "id": "2",
      "ssid": "Network_2",
      "signal": -65,
      "encryption": "WPA"
    }
  ]
}
```

**Notes:**

- Networks sorted by signal strength (best to worst)
- `scanning: true` indicates scan in progress

---

### POST /scan_networks

Initiate network scan.

#### Request

```json
{}
```

#### Response

```json
{ "success": true }
```

---

### POST /connect

Connect to WiFi network.

#### Request

```json
{
  "ssid": "MyNetwork",
  "password": "mypassword"
}
```

**Note:** Omit `password` for open networks.

#### Response

```json
{ "success": true }
```

---

### GET /connect

Check connection status.

#### Response

**Connecting (status: 1):**

```json
{ "status": 1 }
```

**Connected (status: 2):**

```json
{
  "status": 2,
  "ip": "192.168.1.100",
  "dhcp": true,
  "ssid": "MyNetwork"
}
```

**Failed (status: 3):**

```json
{
  "status": 3,
  "error": "Connection timeout"
}
```

**Status Codes:**

- `0` - Idle (not connecting)
- `1` - Connecting
- `2` - Connected
- `3` - Failed

---

## OTA Update

### POST /update

Initiate OTA update.

#### Request

```json
{
  "rom": {
    "url": "http://server.com/release/rom0.bin"
  },
  "spiffs": {
    "url": "http://server.com/release/spiff_rom.bin"
  }
}
```

**Note:** Both `rom` and `spiffs` required.

#### Response

```json
{ "success": true }
```

---

### GET /update

Check OTA progress.

#### Response

```json
{
  "rom_status": 1,
  "webapp_status": 0
}
```

**Status Values:**

- `0` - No update
- `1` - Update in progress
- `2` - Update successful
- `3` - Update failed

---

## Error Codes

### Common Errors

| Status Code | Error Message                 | Cause                                                 |
| ----------- | ----------------------------- | ----------------------------------------------------- |
| 400         | `FormatError::BadType`        | Type mismatch (float instead of int, wrong data type) |
| 400         | `Bad Request`                 | Invalid JSON, unquoted ID in array notation           |
| 400         | `Invalid configuration field` | Unknown config parameter                              |
| 400         | `Validation error`            | Out-of-range value (e.g., h=400, valid range 0-359)   |
| 401         | `Unauthorized`                | API secured but no/wrong credentials provided         |
| 404         | `Not Found`                   | Invalid endpoint                                      |
| 500         | `Internal Server Error`       | Firmware crash or memory error                        |

### Debugging Tips

1. **FormatError::BadType**: Check all numeric fields are integers, not floats
2. **Bad Request with compound IDs**: Ensure IDs are quoted: `[id="123"]` not `[id=123]`
3. **Validation errors**: Check value ranges (h: 0-359, s/v: 0-100, etc.)
4. **Sync-lock conflicts**: Wait for sync-lock.ts to expire (6 seconds timeout)

---

## Data Type Reference

### Color Objects

**HSV (Hue-Saturation-Value):**

_For `/color` endpoint (floats accepted):_

```json
{
  "hsv": {
    "h": 180.5,    // Hue: 0.0-359.0 (float)
    "s": 100.0,    // Saturation: 0.0-100.0 (float)
    "v": 75.3,     // Value/Brightness: 0.0-100.0 (float)
    "ct": 3500     // Color Temperature: 2000-10000 Kelvin (integer)
  }
}
```

_For `/data` endpoint stored items (integers required):_

```json
{
  "hsv": {
    "h": 180,      // Hue: 0-359 (integer)
    "s": 100,      // Saturation: 0-100 (integer)
    "v": 75,       // Value/Brightness: 0-100 (integer)
    "ct": 3500     // Color Temperature: 2000-10000 Kelvin (integer)
  }
}
```

**RAW (Direct PWM):**

```json
{
  "raw": {
    "r": 512,      // Red: 0-1023 (integer)
    "g": 256,      // Green: 0-1023 (integer)
    "b": 768,      // Blue: 0-1023 (integer)
    "ww": 400,     // Warm White: 0-1023 (integer)
    "cw": 200      // Cold White: 0-1023 (integer)
  }
}
```

### Transition Objects

```json
{
  "transition": {
    "cmd": "fade",    // "fade" or "solid" (string)
    "t": 2000,        // Time in ms (integer)
    "d": 1,           // Direction: 1=shortest, 0=longest (integer)
    "s": 50,          // Speed/ramp (integer)
    "q": "single",    // Queue policy (string)
    "r": false        // Requeue flag (boolean)
  }
}
```

### Preset Object

```json
{
  "id": "preset-123",       // String (required)
  "name": "Warm White",     // String (required)
  "ts": 1639000000,         // Integer timestamp (required)
  "favorite": false,        // Boolean (optional, default: false)
  "icon": "palette",        // String (optional, default: "palette")
  "color": {                // Color object (required)
    "hsv": { /* ... */ }    // or "raw": { /* ... */ }
  }
}
```

### Scene Object

```json
{
  "id": "scene-456",           // String (required)
  "name": "Evening",           // String (required)
  "ts": 1639000000,            // Integer timestamp (required)
  "group_id": "group-789",     // String (required)
  "favorite": true,            // Boolean (optional)
  "icon": "scene",             // String (optional)
  "transition": { /* ... */ }, // Transition object (optional)
  "settings": [                // Array of setting objects (required)
    {
      "controller_id": "ctrl-1", // String (required)
      "pos": 0,                  // Integer (required)
      "color": { /* ... */ },    // Color object (required)
      "transition": { /* ... */ } // Transition object (optional)
    }
  ]
}
```

### Group Object

```json
{
  "id": "group-789",              // String (required)
  "name": "Living Room",          // String (required)
  "ts": 1639000000,               // Integer timestamp (required)
  "icon": "light_groups",         // String (optional)
  "controller_ids": [             // Array of strings (required)
    "ctrl-1",
    "ctrl-2"
  ]
}
```

### Controller Object

```json
{
  "id": "ctrl-1",                       // String (required)
  "name": "LED Strip 1",                // String (required)
  "ip-address": "192.168.1.100",        // String (required)
  "icon": "lights/led-strip-variant",   // String (optional)
  "ts": 1639000000                      // Integer timestamp (required)
}
```

---

## Best Practices

### 1. Type Validation

**Use correct types based on endpoint:**

_For `/color` endpoint (floats accepted):_

```javascript
// ✅ CORRECT - floats accepted
await fetch('/color', {
  method: 'POST',
  body: JSON.stringify({
    color: { hsv: { h: 35.5, s: 100.0, v: 75.2 } }
  })
});
```

_For `/data` endpoint (integers required):_

```javascript
// ❌ WRONG - floats in stored data
const preset = {
  color: { hsv: { h: 35.5, s: 100.0, v: 75.2 } }
};

// ✅ CORRECT - integers for stored data
const preset = {
  color: { hsv: { h: 35, s: 100, v: 75 } }
};

// Convert floats when storing
const toInteger = (float) => Math.round(float);
```

### 2. ID Quoting

**Always quote IDs in array notation:**

```javascript
// ❌ WRONG
fetch('/data', {
  body: JSON.stringify({ [`presets[id=${id}]`]: preset })
});

// ✅ CORRECT
fetch('/data', {
  body: JSON.stringify({ [`presets[id="${id}"]`]: preset })
});
```

### 3. Sync Lock Management

**Check sync-lock before sync operations:**

```javascript
const data = await fetch('/data').then(r => r.json());
const lock = data['sync-lock'];
const now = Date.now() / 1000;

if (lock.id && lock.ts > now - 6) {
  console.warn(`Sync locked by ${lock.id}`);
  // Wait or skip sync
}
```

### 4. Error Handling

**Always handle firmware errors:**

```javascript
try {
  const response = await fetch('/data', {
    method: 'POST',
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const error = await response.json();
    if (error.error.includes('FormatError::BadType')) {
      console.error('Type validation failed - check for floats in stored data');
      // Note: /data requires integers, convert floats before sending
    }
  }
} catch (err) {
  console.error('Network or firmware error:', err);
}
```

---

## Version History

- **v4.2.0+** - Current documentation
- Schema validation enforced (integers required)
- Compound ID support with quoted notation
- Sync-lock mechanism implemented

---

## Additional Resources

- [Ramp Speed](https://github.com/verybadsoldier/esp_rgbww_firmware/wiki/Ramp-Speed)
- [Queue Policies](https://github.com/verybadsoldier/esp_rgbww_firmware/wiki/Queue-Policies)
- [Named Animations](https://github.com/verybadsoldier/esp_rgbww_firmware/wiki/Named-Animations)
- [Independent Animation Channels](https://github.com/verybadsoldier/esp_rgbww_firmware/wiki/Independent-Animation-Channels)
- [Device Synchronization](https://github.com/verybadsoldier/esp_rgbww_firmware/wiki/Device-Synchronization)
