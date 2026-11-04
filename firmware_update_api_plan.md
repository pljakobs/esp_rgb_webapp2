# Firmware Update Refactoring Plan & API Specification

Status: historical refactoring proposal. The version-aware contract, selector
dimensions, compatibility adapters, and shared-frontend strategy are now owned by
[UPDATE_INFRASTRUCTURE_PLAN.md](UPDATE_INFRASTRUCTURE_PLAN.md), scheduled as M1 in
[MASTER_PLAN.md](MASTER_PLAN.md). The API sketches below are not deployed facts
and must not override that newer contract. In particular, debug/release build type,
major/minor release line, and stage are separate dimensions; legacy schema fallbacks
remain at compatibility boundaries until old clients/servers have migrated.

## Implementation Progress (2026-11-04)

- [x] Phase 1 service isolation: [src/services/firmwareApi.js](src/services/firmwareApi.js)
  now handles API discovery, legacy-API fallback, normalized records, and explicit
  line/stage/type requests for single-device and per-device fleet callers.
- [x] Phase 3 API discovery and independent release-line selection are wired into
  the update card/dialog. Selected artifacts are revalidated before OTA.
- [x] Phase 4 per-controller API candidate selection is implemented; it preserves
  the installed line/stage/type rather than selecting one shared fleet binary.
- [x] Focused service/selector/transition tests: 23 passed. Legacy API adapters
  intentionally remain for supported older servers.
- [x] Phase 2 cleanup: remove obsolete catalogue merging and dormant/generic fleet
  fallbacks. API normalization owns compatibility handling.
- [x] Update All requires a newer release within the installed major/minor line,
  stage, feed and build type; unmatched/unknown controllers are skipped. It never
  migrates a `5.0/testing` ESP32 to `5.1/testing` without an explicit manual selection.
- [ ] Replace legacy installed-version parsing with structured device metadata once
  the firmware exposes it; current parsing is centralized in the compatibility layer.
- [ ] Qualify single/fleet update progress, retry, reboot, and watchdog behavior
  end to end on actual supported devices. Retaining existing handlers is not a
  substitute for regression evidence.

These are local implementation statuses, not deployment approval. The older v1
API sketches and phase instructions below are retained as historical design;
the linked M1 plan owns the current v2 contract and remaining acceptance gates.

## 1. Overview
At the time of this proposal, `FirmwareUpdateCard.vue` fetched a static,
monolithic `version.json` file via `otaUrl`. That discovery path has now been
replaced with API usage, and the obsolete catalogue/fallback paths have been removed.

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

