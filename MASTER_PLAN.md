# Lightinator Cross-Project Master Plan

Status: M1 read-only discovery deployed; CI preparation is on separate feature branches; canonical branch cutover, client rollout, and device qualification remain open.
Updated: 2026-11-04.

This document coordinates work across the workspace. It owns delivery order,
cross-project dependencies, and acceptance gates. Linked plans own their detailed
designs. Existing plans are not evidence that a feature is implemented; verify
code and deployed behavior before marking a milestone complete.

## Agreed Baseline

| Source branch  | Canonical branch | RGBWWLed pin | Firmware SoCs                 |
| -------------- | ---------------- | ------------ | ----------------------------- |
| `develop`      | `5.0/develop`    | `0.10.1`     | `esp8266`, `esp32`, `esp32c3` |
| `experimental` | `5.1/develop`    | `0.11.0`     | `esp32`, `esp32c3`            |

5.0 remains the legacy single-light feature line, including ESP32/C3 builds for
now. 5.1 is the ESP32-family multiple-light line; ESP8266 must never be selected
for a 5.1 build or update. `5.1/experimental` is not a separate stage.
Use the matching `5.0/testing`, `5.0/prod`, `5.1/testing`, and `5.1/prod` stages
when those promotion paths are enabled. Promotion does not change the version line.

Keep one compatible configuration/catalogue ecosystem and capability-gated clients,
not separate application/configuration forks. Firmware and webapp may release
independently when their API contracts remain compatible.

Firmware update selection has independent build type (`debug`/`release`), major/
minor release line, and stage (`develop`/`test`/`stable` UI labels), followed by
eligible full versions. UI `test`/`stable` map to canonical `testing`/`prod`.
The complete update chain must support these dimensions before branch cutover.

## Projects and Responsibilities

| Project                      | Responsibility in this roadmap                                                                                              |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `esp_rgbww_firmware`         | Branch/dependency pins, SoC builds, ConfigDB/API contracts, virtual-light runtime, hardware resource ownership, OTA checks. |
| `esp_rgb_webapp2`            | Versioned CI/deployment, compatibility negotiation, virtual-light/pin/button configuration, control UI and update UX.       |
| `lightinator_server`         | Release upload/discovery, line/SoC/API eligibility, legacy adapters, later product-aware immutable releases.                |
| `Lightinator_HA_module`      | Compatible updates and discovery, stable per-light entities, virtual-light/pin configuration, button state/events.          |
| `lightinator-log-service`    | Correct artifact/symbol resolution across release lines and targets, crash-report compatibility.                            |
| `sming` / `Esp32HardwarePwm` | Build/runtime dependencies and qualified PWM channel/timer behavior; change only when required by a concrete dependency.    |

## Delivery Sequence

| Milestone | Outcome                                                                                                                                         | Depends On                                             | Status        |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ | ------------- |
| M1        | Version-aware publication, server discovery/options, updater clients, legacy adapters, and shared-frontend compatibility/storage qualification. | None                                                   | In progress: local implementation/tests |
| M2        | Versioned development-line cutover, exact RGBWWLed pins, correct CI matrices; qualify contracts for next-generation runtime work.               | M1 readiness gates; CI preparation can proceed earlier | CI prep on feature branches; cutover pending |
| M3        | Multiple virtual lights and resource-aware PWM allocation in firmware.                                                                          | M1, M2 contract baseline                               | Planned       |
| M4        | QuinLED named pins and virtual-light management in Webapp2 and Home Assistant.                                                                  | M3 API/runtime; catalogue design can proceed earlier   | Planned       |
| M5        | Configurable button actions and I2C bus configuration.                                                                                          | M3, M4 resource model                                  | Planned       |
| M6        | Qualified firmware/webapp/integration releases and diagnostic lookup.                                                                           | Acceptance gates for the features being shipped        | Planned       |

Peripheral and addressable-library investigations can run independently. Their
implementation is not a prerequisite for analog lighting or M1. Full distribution
service modernization remains a separate workstream; explicit version-line
discovery and compatibility adapters are nevertheless required in M1.

## M1: Complete Version-Aware Update Chain

Current scope: product-aware, read-only discovery; SQLite and its legacy JSON
projection; basic firmware/frontend version bounds; and secured SSH/rsync plus
the database-writing `manage_version.py`. HTTP uploads, release administration,
signed-release lifecycle APIs and explicit firmware API-contract management are
later-milestone work, not M1 deployment requirements. Deferred implementations
and their tests may remain in the integration branch, but their public routes
and schemas are not registered by the deployed discovery application.

Production verification on 2026-11-04: 19 GET-only discovery paths, product
selection retained, all 216 firmware/48 webapp records preserved, and working
legacy experimental discovery. No controller firmware was changed.

Detailed design: [UPDATE_INFRASTRUCTURE_PLAN.md](UPDATE_INFRASTRUCTURE_PLAN.md).

Publishing decision: retain the secured SSH/rsync process and adapt the
server-side `manage_version.py` to write SQLite. HTTP publishing is disabled by
default and deferred until separately hardened; it is not an M1 prerequisite.

### Local Progress (2026-11-03)

Checked items mean implemented and covered by focused local tests, not published
or hardware-qualified. Changes are in the working trees; no release or branch
cutover has been performed.

- [x] Add version-aware firmware options/versions/latest discovery, canonical line/
  stage normalization, stable candidate IDs, and repeatable SQLite metadata migration.
- [x] Switch frontend firmware discovery from fetching `version.json` to the API,
  with fallback to the legacy API only when v2 is unavailable.
- [x] Add independent build-type, release-line, stage, and full-version selection;
  clear stale selections and preserve the installed line by default.
- [x] Resolve fleet candidates through per-controller line/stage/type API requests
  and revalidate selected artifacts before sending the firmware OTA request.
- [x] Add version-line selection and canonical identity handling to Home Assistant,
  with isolated client tests and pre-install artifact/transition revalidation.
- [x] Add the legacy-shaped `/api/webapp/latest` adapter and v2 webapp discovery
  with compatibility/capability/asset-size filtering.
- [x] Add explicit cross-line qualification and bridge-first transition checks;
  retain same-line updates without requiring the new migration endpoint.
- [x] Integrate discovery and the read-only `version.json` projection with the
  existing `feature/multi-product-ota-releases` catalogue, preserving legacy rows.
- [x] Start isolated loopback discovery at `http://127.0.0.1:8766/api/docs` and
  verify the actual frontend and HA API clients. HTTP publishing is disabled;
  imported download URLs remain unchanged and no device was flashed.
- [x] Adapt the secured server-side `manage_version.py` publisher to write SQLite
  directly without reading or writing the JSON projection; test CI-compatible commands.
- [x] Retain per-run publisher uploads through SSH/rsync, sourcing a tested bundle
  from a pinned distribution-server commit and checking its SQLite publisher contract.
- [ ] Publish the reviewed server commit and set `DISTRIBUTION_PUBLISHER_SHA` in
  both CI repositories; missing/non-immutable pins intentionally block publishing.
- [ ] Qualify the adapted script and existing CI/rsync paths on the deployed server.
- [x] Stage and validate webapp uploads; reject changed releases without replacing
  existing bridge bundles. Preserve legacy endpoint response shapes in unit tests.
- [x] Remove frontend catalogue merging and generic fleet fallback code. Manual
  discovery and Update All consume API records, never fetch the JSON projection.
- [x] Keep Update All within each controller's installed major/minor line, stage,
  legacy feed and build type; require a newer release and recheck before OTA.
  An ESP32 pinned to `5.0/testing` cannot automatically move to `5.1/testing`.
- [ ] Exercise complete single-device/fleet flows in browser and device tests.
- [ ] Qualify Home Assistant options/saved-preference migration in a running HA
  instance; isolated API tests do not cover the full options flow.
- [ ] Implement/qualify firmware structured identity, independent webapp preferences,
  and the device-side webapp OTA transition/negotiation path.
- [ ] Integrate normalized CI/publication metadata, complete-artifact promotion,
  legacy catalogue projections, and diagnostic artifact lookup.
- [ ] Measure the final installed frontend and safe staging/reserve budget on both
  targets; qualify capability-gated frontend behavior against both firmware APIs.
- [ ] Deploy adapters first, publish and retain real qualified bridge releases,
  verify old-client upgrade paths, and exercise hardware OTA failure/recovery.

Evidence: 14 server unit tests, 23 frontend service/selector tests, and 9 isolated
Home Assistant API tests passed for the client/M1 work. The integrated OTA
worktree now passes 32 server tests locally and on the production host, including separate-process CLI publication,
plus live frontend and HA discovery smoke
checks against the isolated loopback server. The final client production build
passed on 2026-11-04. Frontend lint is
currently blocked by the existing missing `plugin:vue/vue3-essential` preset.
See the detailed plan for test commands and production backup/receipt locations.
Production discovery is verified; physical OTA and the full client/CI chain remain
open. Checked implementation tests for deferred work do not make that work M1 scope.

Both modified publishing workflows passed YAML parsing and syntax checks for all
35 embedded shell blocks. Deploy the compatible SQLite server/schema and configure
the reviewed publisher SHA before enabling these workflow changes. CI tests that
revision, uploads run-specific code/dependencies, and removes only its own bundle.
The `--publisher-contract` probe prevents fallback to an old JSON writer.
Automatic culling currently retains all releases/assets to protect bridges.

### Remaining Milestone Requirements

- Extend the server API/storage additively with explicit release-line, stage, and
  build-type dimensions, eligible selector options, and version/compatibility-aware
  discovery. Preserve deployed APIs and catalogue projections through adapters.
- Update Webapp2, Home Assistant, firmware metadata/webapp OTA, CI publishing, and
  log lookup to use one structured identity. Do not derive feeds from sanitized
  version suffixes. Keep ordinary updates on their selected line.
- Prefer one capability-aware frontend supporting both firmware lines, with an
  independent frontend release version. Gate API calls as well as visible controls.
  Measure installed assets and safe update overhead on both targets before deciding
  whether legacy/full package variants are necessary; hidden features still use flash.
- Deploy and verify server adapters and bridge-capable clients before canonical
  branch publication. Verify the deployed `/api/webapp/latest` route, migration
  order, old clients, per-controller fleet selection, and actual OTA recovery.

M1 acceptance is end-to-end update-chain evidence, not merely new selectors or
successful builds. The detailed plan defines policy, rollout, and test coverage.

## M2: Versioned Release Stages

### CI Preparation Status

The current build and release procedure is documented in
[CI_RELEASE_PROCESS.md](../esp_rgbww_firmware/CI_RELEASE_PROCESS.md). CI preparation
is implemented on the separate firmware and webapp feature branches; local policy
suites and GitHub workflow-validation runs passed. The preparation covers versioned
triggers, immutable source checkout, line-specific matrices and version counters,
RGBWWLed pin checks, external SPA delivery, and the M1 pinned SSH/rsync publisher.

This is not branch cutover or a qualified production release. The versioned release
branches have not been created, complete firmware matrix builds have not been run,
and device/browser/HA release flows remain unqualified.

### Remaining Cutover Gates

- Establish `5.0/develop` from the current advanced firmware line while pinning
  RGBWWLed `0.10.1`; establish `5.1/develop` from its source line with `0.11.0`.
  Preserve old refs and confirm consumers before changing defaults/protections.
- Fix local/Host firmware version fallbacks so they do not hard-code `V5.0`.
- Pin the Sming builder image by digest and action revisions; `latest`, floating
  hosted runners, and tag-based action refs currently prevent byte-reproducible builds.
- Make same-line version allocation collision-safe and make firmware publication
  fail closed when any expected SoC/build artifact is missing.
- Carry and persist exact source/dependency provenance in the catalogue; current
  M1 publisher compatibility records do not represent the later manifest model.
- Run every required firmware variant, Host checks, external-webapp compatibility
  tests, server staging checks, and device/browser/HA qualification before enabling
  canonical production publication.

The existing expected build matrix remains:

| Case                                        | Expected Result                                                  |
| ------------------------------------------- | ---------------------------------------------------------------- |
| `5.0/develop`                               | RGBWWLed `0.10.1`; ESP8266, ESP32, ESP32-C3 builds               |
| `5.1/develop`                               | RGBWWLed `0.11.0`; ESP32 and ESP32-C3 builds only                |
| PR into either line                         | Target-line policy; PR revision tested; no publishing/tag writes |
| Manual dispatch                             | Selected canonical ref/SHA and matching dependency pin           |
| Wrong component pin or unsupported line     | Early explicit failure                                           |
| 5.1 missing/incorrect SoC metadata          | Publication rejected; no all-SoC fallback                        |
| Incomplete artifacts or failed required job | No catalogue/latest update                                       |
| Retry or simultaneous line builds           | No cross-line version/tag/artifact collision                     |

Run the existing Host smoke checks and all required hardware build variants for
both lines. Stage upload/discovery tests must verify both versioned paths and
legacy compatibility, including updater and log-symbol lookup.

Only after these gates pass, publish canonical development refs, update protection/
dispatch/default-ref settings as applicable, and enable their development-channel
publishing. Keep known-good artifacts and legacy aliases until consumers are
verified. Rollback restores routing to a qualified release, not rebuilt artifacts.

## Later Milestones and Linked Plans

| Workstream                                            | Detailed Plan / Reference                                                                                                                                                                                                  | Coordination Requirement                                                                                                                    |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Release lines and independent API-compatible releases | Firmware [branches.md](../esp_rgbww_firmware/branches.md)                                                                                                                                                                  | This master plan fixes the immediate exact component pins and development mappings; keep policy synchronized.                               |
| ConfigDB migration                                    | [JSON migration](../esp_rgbww_firmware/CONFIGDB_JSON_MIGRATION_PLAN.md), [inbound JSON](../esp_rgbww_firmware/CONFIGDB_JSON_INBOUND_PLAN.md), [JSON-RPC messages](../esp_rgbww_firmware/CONFIGDB_JSONRPC_MESSAGES_PLAN.md) | Verify completed work before scheduling gaps; establish one shared contract for both clients.                                               |
| Firmware API design                                   | [apiClass_plan.md](../esp_rgbww_firmware/apiClass_plan.md), [API_SCHEMA.md](../esp_rgbww_firmware/API_SCHEMA.md)                                                                                                           | Reconcile existing proposals with the actual schema/runtime before extending per-light configuration and commands.                          |
| QuinLED and multiple lights                           | [Quinled_Plan.md](Quinled_Plan.md)                                                                                                                                                                                         | M3/M4 share stable light IDs, named resources, capability gates, and legacy catalogue compatibility.                                        |
| Host/build qualification                              | [CONTAINERIZED_HOST_CI_PLAN.md](../esp_rgbww_firmware/CONTAINERIZED_HOST_CI_PLAN.md)                                                                                                                                       | Reuse existing checks; Host is a test target, not a supported OTA SoC.                                                                      |
| Update infrastructure and shared frontend             | [UPDATE_INFRASTRUCTURE_PLAN.md](UPDATE_INFRASTRUCTURE_PLAN.md), [firmware_update_api_plan.md](firmware_update_api_plan.md), [hybrid delivery proposal](plan-hybridWebappDelivery.prompt.md)                                | M1 owns the new contract, legacy adapters, client migration, and measured frontend budget. Older API sketches are not the current contract. |
| Distribution service                                  | [plan.md](../lightinator_server/plan.md), [backend_Migration.md](../lightinator_server/backend_Migration.md)                                                                                                               | Explicit line/stage discovery is M1; full product-aware catalogue modernization remains separately scoped.                                  |
| Home Assistant integration                            | [README.md](../Lightinator_HA_module/README.md)                                                                                                                                                                            | Track implementation against shared M2-M5 contracts; this reference is not a separate implementation plan.                                  |
| Diagnostic service                                    | [FIRMWARE_AGNOSTIC_PLAN.md](../lightinator-log-service/FIRMWARE_AGNOSTIC_PLAN.md), [CRASH_REPORT_MODULE_PLAN.md](../lightinator-log-service/CRASH_REPORT_MODULE_PLAN.md)                                                   | Preserve unambiguous product/version/target identity for artifact and symbol lookup.                                                        |

M3 must qualify Esp32HardwarePwm capacity and timer-block grouping before
advertising all 15 Deca outputs. Coordinate split RGB/tunable-white backend groups
as one RGBWW virtual light. M4 supplies creation and pin assignment in Webapp2 and
Home Assistant through the same validated firmware API. M5 adds button commands,
presets, MQTT publication, and Home Assistant state/events, plus I2C reservation.
OLED/sensor support and addressable LED support remain investigation-led additions.

## Plan Maintenance and Scope

- Update this document when a dependency, decision, milestone status, or cross-project
  gate changes. Keep implementation details and test evidence in the owning project.
- Completion requires linked PR/commit and verification evidence, not just a checked
  checklist. Mark partial implementation explicitly and distinguish local from deployed.
- Resolve conflicts between linked plans here, then update the owning detailed plan;
  do not let contradictory branch names or SoC policies persist across documents.
- Next execution scope is M1 update infrastructure and compatibility qualification.
  Prepare M2 CI changes as needed, but cut over only after M1 gates. Runtime
  multilight, pin configuration, peripheral drivers, and full product-aware
  distribution redesign are not part of this infrastructure milestone.
