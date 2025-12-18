# API Testing Checklist

Use this checklist when testing the ESP RGBWW firmware API.

## Pre-Test Setup

- [ ] Controller powered on and connected to network
- [ ] Controller reachable at specified IP address
- [ ] API security disabled (or credentials configured)
- [ ] Test environment variable set: `export TEST_CONTROLLER_URL=http://192.168.1.100`
- [ ] Dependencies installed: `npm install`

## Connectivity Check

```bash
# Ping controller
curl http://192.168.1.100/ping
# Expected: {"ping":"pong"}

# Get device info
curl http://192.168.1.100/info
# Expected: JSON with deviceid, git_version, uptime, etc.
```

## Run All Tests

```bash
./run-api-tests.sh
```

**Expected Result:** All 40+ tests pass

## Individual Test Suites

### System Information Tests

```bash
./run-api-tests.sh -t "System Information"
```

- [ ] GET /ping returns pong
- [ ] GET /info returns device information

### Data Endpoint Tests

```bash
./run-api-tests.sh -t "GET /data"
```

- [ ] Returns complete data structure
- [ ] sync-lock has correct types (string id, integer ts)
- [ ] Presets have integer timestamps and HSV values
- [ ] Scenes have correct structure
- [ ] Groups have string controller_ids array
- [ ] Controllers have required fields

```bash
./run-api-tests.sh -t "POST /data"
```

- [ ] Create preset with quoted ID succeeds
- [ ] Reject preset with float values (FormatError)
- [ ] Reject preset with unquoted ID (Bad Request)
- [ ] Update existing preset fields
- [ ] Create group with controller_ids array
- [ ] Create scene with transitions
- [ ] Delete preset with DELETE command
- [ ] Handle compound IDs correctly

### Configuration Tests

```bash
./run-api-tests.sh -t "Configuration"
```

- [ ] GET /config returns all sections
- [ ] General settings have correct types
- [ ] Passwords are masked in response
- [ ] Network settings present
- [ ] Color settings have integer values
- [ ] POST /config updates device name
- [ ] POST /config updates MQTT settings
- [ ] Invalid configuration rejected or ignored

### Color Control Tests

```bash
./run-api-tests.sh -t "Color"
```

- [ ] GET /color returns HSV and RAW
- [ ] POST /color sets HSV with fade
- [ ] POST /color sets RAW with solid
- [ ] Rejects invalid HSV range (h > 359)

### Animation Tests

```bash
./run-api-tests.sh -t "Animation"
```

- [ ] POST /toggle toggles controller
- [ ] POST /blink executes blink
- [ ] POST /stop stops animation
- [ ] POST /pause pauses animation
- [ ] POST /continue continues animation
- [ ] POST /skip skips animation

### Network Management Tests

```bash
./run-api-tests.sh -t "Network"
```

- [ ] GET /networks lists available networks
- [ ] POST /scan_networks initiates scan
- [ ] GET /connect returns connection status

### System Control Tests

```bash
./run-api-tests.sh -t "System Control"
```

- [ ] POST /system with debug command succeeds
- [ ] Invalid system command rejected

### OTA Update Tests

```bash
./run-api-tests.sh -t "OTA"
```

- [ ] GET /update returns status

## Manual API Tests

### Create a Test Preset

```bash
curl -X POST http://192.168.1.100/data \
  -H "Content-Type: application/json" \
  -d '{
    "presets[id=\"test-manual-1\"]": {
      "id": "test-manual-1",
      "name": "Manual Test Preset",
      "ts": 1700000000,
      "favorite": false,
      "color": {"hsv": {"h": 120, "s": 80, "v": 70, "ct": 3000}}
    }
  }'
```

- [ ] Response: `{"success": true}`
- [ ] Verify with: `curl http://192.168.1.100/data | grep test-manual-1`

### Update Preset Name

```bash
curl -X POST http://192.168.1.100/data \
  -H "Content-Type: application/json" \
  -d '{"presets[id=\"test-manual-1\"].name": "Updated Name"}'
```

- [ ] Response: `{"success": true}`
- [ ] Verify update in GET /data

### Delete Test Preset

```bash
curl -X POST http://192.168.1.100/data \
  -H "Content-Type: application/json" \
  -d '{"presets[id=\"test-manual-1\"]": "DELETE"}'
```

- [ ] Response: `{"success": true}`
- [ ] Verify deletion in GET /data

### Test Type Validation (Should Fail)

```bash
# Send float values (should get FormatError)
curl -X POST http://192.168.1.100/data \
  -H "Content-Type: application/json" \
  -d '{
    "presets[id=\"bad-preset\"]": {
      "id": "bad-preset",
      "name": "Bad",
      "ts": 1700000000,
      "color": {"hsv": {"h": 120.5, "s": 80.0, "v": 70.2}}
    }
  }'
```

- [ ] Response: 400 Bad Request
- [ ] Error message contains "FormatError"

### Test Unquoted ID (Should Fail)

```bash
# Unquoted ID (should get Bad Request)
curl -X POST http://192.168.1.100/data \
  -H "Content-Type: application/json" \
  -d '{
    "presets[id=unquoted-test]": {
      "id": "unquoted-test",
      "name": "Unquoted",
      "ts": 1700000000,
      "color": {"hsv": {"h": 0, "s": 0, "v": 100}}
    }
  }'
```

- [ ] Response: 400 Bad Request

### Test Color Control

```bash
# Set color to red
curl -X POST http://192.168.1.100/color \
  -H "Content-Type: application/json" \
  -d '{
    "hsv": {"h": 0, "s": 100, "v": 80, "ct": 3000},
    "cmd": "fade",
    "t": 1000,
    "d": 1
  }'
```

- [ ] Response: `{"success": true}`
- [ ] Visual confirmation: Light fades to red
- [ ] Wait 1 second for transition

```bash
# Get current color
curl http://192.168.1.100/color
```

- [ ] Response contains hsv and raw
- [ ] HSV h value approximately 0

### Test Toggle

```bash
curl -X POST http://192.168.1.100/toggle \
  -H "Content-Type: application/json" \
  -d '{}'
```

- [ ] Response: `{"success": true}`
- [ ] Visual confirmation: Light toggles on/off

## Type Validation Checks

### Integer Requirements

Test that these fields are integers (not floats):

- [ ] `ts` (timestamp)
- [ ] `h` (hue: 0-359)
- [ ] `s` (saturation: 0-100)
- [ ] `v` (value: 0-100)
- [ ] `ct` (color temp: 0-10000)
- [ ] `r`, `g`, `b` (0-1023)
- [ ] `ww`, `cw` (0-1023)
- [ ] `t` (time in ms)
- [ ] `d` (direction: 0 or 1)
- [ ] `s` (speed)

### String Requirements

Test that these fields are strings:

- [ ] All `id` fields
- [ ] All `name` fields
- [ ] All `controller_id` fields
- [ ] Array items in `controller_ids`

### Boolean Requirements

Test that these fields are booleans:

- [ ] `favorite`
- [ ] `dhcp`
- [ ] `enabled` (various configs)

## Error Handling Checks

- [ ] Float values return FormatError::BadType
- [ ] Unquoted IDs return Bad Request
- [ ] Invalid ranges return validation error
- [ ] Invalid endpoints return 404
- [ ] Missing required fields return error
- [ ] Invalid JSON returns 400

## Performance Checks

- [ ] GET /data responds in < 500ms
- [ ] POST /data responds in < 500ms
- [ ] GET /config responds in < 500ms
- [ ] Color changes apply in < 100ms

## Cleanup

```bash
# Delete any remaining test items
curl -X POST http://192.168.1.100/data \
  -H "Content-Type: application/json" \
  -d '{
    "presets[id=\"test-manual-1\"]": "DELETE",
    "presets[id=\"bad-preset\"]": "DELETE",
    "presets[id=\"unquoted-test\"]": "DELETE"
  }'
```

- [ ] All test items deleted
- [ ] Controller in clean state

## Documentation Review

- [ ] API_DOCUMENTATION.md reviewed
- [ ] API_QUICK_REFERENCE.md examples work
- [ ] API_TESTING.md instructions clear
- [ ] All curl commands tested

## Final Verification

- [ ] All automated tests pass: `./run-api-tests.sh`
- [ ] All manual tests pass
- [ ] No errors in firmware logs
- [ ] Controller responsive after tests
- [ ] Documentation accurate

## Test Results

**Date:** ******\_\_\_******  
**Tester:** ******\_\_\_******  
**Controller IP:** ******\_\_\_******  
**Firmware Version:** ******\_\_\_******

**Total Tests Run:** **\_** / 40+  
**Tests Passed:** **\_**  
**Tests Failed:** **\_**  
**Known Issues:** **************\_**************

**Notes:**

---

---

---

**Sign-off:** ******\_\_\_******
