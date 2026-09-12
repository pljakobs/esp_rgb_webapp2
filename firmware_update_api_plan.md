# Firmware Update Refactoring Plan & API Specification

## 1. Overview
The current implementation in `FirmwareUpdateCard.vue` relies on fetching a static, monolithic `version.json` file via `otaUrl` and executing manual array merging, filtering, deduplication, and sorting on the client side. 

This plan details the migration to a targeted FastAPI REST service backed by SQLite, offloading querying and filtering to the server, standardizing response schemas, and updating the Vue client.

---

## 2. API Specification (FastAPI Backend)

### 2.1 Endpoints

#### `GET /api/v1/firmware`
Retrieves available firmware releases filtered by target controller attributes.

* **Query Parameters:**
  * `soc` (string, required): Hardware target (e.g., `esp32`, `esp8266`).
  * `type` (string, optional): Build variant (e.g., `standard`, `relay`).
  * `branch` (string, optional): Git release branch (e.g., `main`, `develop`, `stable`).
  * `include_history` (boolean, optional, default `false`): Include historical builds alongside current releases.

* **Response Schema (`200 OK`):**
```json
{
  "soc": "esp32",
  "count": 2,
  "firmware": [
    {
      "id": 101,
      "soc": "esp32",
      "type": "standard",
      "branch": "main",
      "fw_version": "v5.1.0-42",
      "fw_comment": "Fix Wi-Fi reconnection handling",
      "created_at": "2026-03-10T14:30:00Z",
      "files": [
        {
          "type": "app",
          "url": "[https://ota.example.com/builds/esp32-standard-v5.1.0.bin](https://ota.example.com/builds/esp32-standard-v5.1.0.bin)",
          "offset": "0x10000"
        }
      ]
    }
  ]
}
```

#### `GET /api/v1/firmware/latest`
Returns the single latest compatible firmware binary for automated update workflows.

* **Query Parameters:**
  * `soc` (string, required)
  * `type` (string, required)
  * `branch` (string, optional, default: `stable`)

* **Response Schema (`200 OK`):** Returns a single firmware object matching the target criteria or `404 Not Found`.

---

## 3. Frontend Refactoring Plan (`FirmwareUpdateCard.vue`)

### Phase 1: API Service Layer Isolation
1. Create `src/services/firmwareApi.js` to encapsulate REST interactions with the FastAPI backend.
2. Abstract single target and multi-target queries into clean, async methods returning typed DTOs.

### Phase 2: Eliminate Client-Side Data Transformation
1. **Remove In-Memory Processing:** Deprecate client-side functions in `FirmwareUpdateCard.vue` that merge `data.firmware` and `data.history`, perform manual deduplication, and execute client-side array sorting.
2. **Remove Schema Fallbacks:** Standardize field references across the component. Eliminate fallback property checks like `fw.fw_version || fw.version` and `fw.comment || fw.fw_comment` in favor of strict API contracts (`fw_version`, `fw_comment`).
3. **Branch Parsing Offload:** Replace custom client-side string splitting logic (`getBranchFromVersion`) with direct metadata queries provided by the endpoint or structured store data.

### Phase 3: Single Controller Update Flow (`fetchFirmware` / `showFirmwareDialog`)
1. Refactor `fetchFirmware()` to pass active controller attributes (`soc`, `build_type`, `branch`) directly as query parameters to `GET /api/v1/firmware`.
2. Update `FirmwareSelectDialog` props to consume the pre-filtered, backend-sorted array directly.

### Phase 4: Fleet Update Workflow (`updateAllControllers`)
1. **Per-Device Version Resolution:** Update batch logic so that during controller iteration, target firmware compatibility is determined by passing each unit's reported `soc` and `build_type` to the API service.
2. **Heterogeneous Target Support:** Ensure environments with mixed hardware variants (e.g., ESP8266 and ESP32 units in the same fleet) accurately pull corresponding builds rather than applying a single uniform hardware manifest.
3. **Preserve Operational Reliability:** Maintain existing ping backoff retries, WebSocket `ota_status` handlers, fallback progress timers, and post-update reboot uptime checks (`runtime.uptime`).

---

## 4. Migration & Testing Verification

1. **Schema Validation:** Verify FastAPI response model against existing Quasar component bindings (`FirmwareSelectDialog.vue`, `FirmwareUpdateProgressDialog.vue`).
2. **Regression Testing:** Validate individual and batch update sequences, verifying WebSocket event propagation (`step 0` through `step 4`) and recovery/watchdog timeout behavior.

