# API Testing Guide

## Overview

This document describes how to run the comprehensive API integration tests against a live ESP RGBWW firmware controller.

## Test Files

- **API_DOCUMENTATION.md** - Complete API reference with schemas, examples, and type requirements
- **src/services/**tests**/api.integration.spec.js** - Integration test suite (80+ tests)

## Prerequisites

1. **Running Controller**: You need a live ESP RGBWW controller on your network
2. **Node.js**: Tests use Vitest framework (already configured in package.json)
3. **Network Access**: Controller must be reachable from your machine

## Configuration

### Set Controller URL

Export the controller URL as an environment variable:

```bash
export TEST_CONTROLLER_URL=http://192.168.1.100
```

Or set it inline when running tests:

```bash
TEST_CONTROLLER_URL=http://192.168.1.100 npm test api.integration.spec.js
```

**Default:** `http://192.168.1.100` (if not specified)

### Controller Requirements

The controller should have:

- Firmware version 4.2.0 or later
- Network connectivity
- Optional: API security disabled (for easier testing) or provide auth credentials

## Running Tests

### Run All API Tests

```bash
npm test -- src/services/__tests__/api.integration.spec.js
```

### Run Specific Test Suite

```bash
# System information tests only
npm test -- api.integration.spec.js -t "System Information"

# Data endpoint tests only
npm test -- api.integration.spec.js -t "GET /data"

# Configuration tests only
npm test -- api.integration.spec.js -t "Configuration"

# Color control tests only
npm test -- api.integration.spec.js -t "Color"
```

### Watch Mode (for development)

```bash
npm test -- api.integration.spec.js --watch
```

### Verbose Output

```bash
npm test -- api.integration.spec.js --reporter=verbose
```

## Test Coverage

### Test Suites

1. **System Information** (2 tests)
   - GET /ping
   - GET /info

2. **GET /data - Retrieve Application Data** (6 tests)
   - Complete data structure validation
   - sync-lock type checking
   - Preset validation (integers, ranges)
   - Scene structure validation
   - Group validation
   - Controller validation

3. **POST /data - Update Application Data** (8 tests)
   - Create preset with quoted ID ✅
   - Reject float values (FormatError) ❌
   - Reject unquoted ID ❌
   - Update existing fields
   - Create group with controller_ids array
   - Create scene with transitions
   - Delete preset with DELETE command
   - Compound ID handling

4. **GET /config - Retrieve Configuration** (5 tests)
   - Complete configuration structure
   - General settings type validation
   - Password masking verification
   - Network settings validation
   - Color settings integer validation

5. **POST /config - Update Configuration** (3 tests)
   - Update device name
   - Update MQTT settings
   - Reject invalid configuration

6. **GET /color - Current Color** (1 test)
   - HSV and RAW color retrieval

7. **POST /color - Set Color** (3 tests)
   - Set HSV color with fade
   - Set RAW color with solid
   - Reject invalid HSV range ❌

8. **Animation Control** (6 tests)
   - POST /toggle
   - POST /blink
   - POST /stop
   - POST /pause
   - POST /continue
   - POST /skip

9. **Network Management** (3 tests)
   - GET /networks
   - POST /scan_networks
   - GET /connect

10. **System Control** (2 tests)
    - POST /system (debug command)
    - Reject invalid system command ❌

11. **OTA Update** (1 test)
    - GET /update status

**Total: 40 test cases** covering all major endpoints

## Common Issues

### Connection Refused

**Error:**

```
ECONNREFUSED 192.168.1.100:80
```

**Solution:**

- Check controller IP address
- Verify controller is powered on and connected to network
- Try pinging the controller: `ping 192.168.1.100`

### Authentication Required

**Error:**

```
401 Unauthorized
```

**Solution:**

- Disable API security in controller config, or
- Add authentication headers to test requests (modify `apiRequest` function)

### Timeout Errors

**Error:**

```
Test timeout exceeded
```

**Solution:**

- Increase timeout in test file (currently 10 seconds)
- Check network latency to controller
- Controller may be overloaded - wait and retry

### FormatError::BadType

**This is expected!** Tests intentionally send invalid data (floats instead of integers) to verify firmware validation. These tests should **fail** with 400 status code.

## Test Data Cleanup

Tests automatically clean up created items in `afterAll()` hook:

- Test presets are deleted
- Test scenes are deleted
- Test groups are deleted

If tests crash or are interrupted, you may need to manually delete test items:

```bash
curl -X POST http://192.168.1.100/data \
  -H "Content-Type: application/json" \
  -d '{"presets[id=\"test-preset-123\"]": "DELETE"}'
```

## Schema Validation

Tests verify critical type requirements from firmware schemas:

### Integer Requirements (NOT floats)

- **Timestamps**: `ts` fields must be integers
- **HSV values**: `h` (0-359), `s` (0-100), `v` (0-100) must be integers
- **Color temperature**: `ct` (0-10000) must be integer
- **RAW values**: `r`, `g`, `b`, `ww`, `cw` (0-1023) must be integers
- **Transition times**: `t`, `d`, `s` must be integers

### String Requirements

- **All IDs**: Must be strings, even if numeric: `"123"` not `123`
- **Array notation**: IDs must be quoted: `[id="123"]` not `[id=123]`

### Boolean Requirements

- Use `true`/`false`, not `1`/`0`

## Expected Test Results

**Passing tests** (should be 200 OK):

- ✅ All GET endpoints
- ✅ Valid POST requests with correct types
- ✅ Proper array notation with quoted IDs
- ✅ Integer values in correct ranges

**Failing tests** (should be 400 Bad Request):

- ❌ Float values instead of integers
- ❌ Unquoted IDs in array notation
- ❌ Out-of-range values
- ❌ Invalid system commands

## Continuous Integration

To run tests in CI:

```yaml
# Example GitHub Actions workflow
- name: Run API Integration Tests
  env:
    TEST_CONTROLLER_URL: http://test-controller.local
  run: npm test -- api.integration.spec.js
```

## Debugging Tests

### Enable Debug Logging

Add console logs in test file:

```javascript
console.log("Request:", JSON.stringify(payload, null, 2));
console.log("Response:", JSON.stringify(response.data, null, 2));
```

### Use Verbose Vitest Reporter

```bash
npm test -- api.integration.spec.js --reporter=verbose --reporter=json --outputFile=test-results.json
```

### Check Firmware Logs

Connect via serial monitor to see firmware debug output during tests.

## Contributing

When adding new endpoints:

1. Update **API_DOCUMENTATION.md** with endpoint spec
2. Add tests to **api.integration.spec.js**
3. Include both success and error test cases
4. Verify type validation (integer vs float)
5. Test with real hardware

## References

- [API Documentation](./API_DOCUMENTATION.md) - Complete API reference
- [GitHub Wiki](https://github.com/verybadsoldier/esp_rgbww_firmware/wiki/HTTP-Interface) - Original API docs
- [app-data.cfgdb](../esp_rgbww_firmware/app-data.cfgdb) - Data schema
- [app-config.cfgdb](../esp_rgbww_firmware/app-config.cfgdb) - Config schema
- [Schema Validator](./src/services/schemaValidator.js) - Type validation module
