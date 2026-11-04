# Lightinator Cross-Project Master Plan

Status: M1 read-only discovery deployed; client/CI rollout and device qualification remain open.
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
| M2        | Versioned development-line cutover, exact RGBWWLed pins, correct CI matrices; qualify contracts for next-generation runtime work.               | M1 readiness gates; CI preparation can proceed earlier | Planned       |
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

### 1. Prepare Refs and Dependency Pins

- Record source commit IDs, local/remote refs, uncommitted changes, protected/default
  branches, and external consumers before changing refs. Preserve unrelated work.
- Resolve RGBWWLed release `0.10.1` and `0.11.0` to verified immutable commits;
  confirm actual tag spelling and component version metadata. Do not invent SHAs
  or edit a version string to pretend a different component revision is installed.
  Remark: RGBWWLed will see some major change for channel handling, 0.11.0 is not the last fixed version
- Pin the `Components/RGBWWLed` gitlink separately on each firmware line. Keep
  recursive submodule checkout at the recorded commit; never use a floating
  `git submodule update --remote` in a release build. Review the existing
  `.gitmodules` `origin/feature/fade` branch hint so it does not contradict pins.
- Prepare CI changes on the source lines before cutover, then establish
  `5.0/develop` from `develop` and `5.1/develop` from `experimental` with the
  appropriate line-specific pin changes. Keep firmware-to-webapp mappings explicit;
  a shared frontend need not mirror firmware release lines or branch identities.
  Do not merge 5.1-only runtime changes into 5.0 to share CI edits.
- Keep old refs available during a bounded migration window. Push/delete refs,
  change branch protections/defaults, and enable publishing only as explicit
  rollout operations; this planning document does not perform those actions.
- 5.1 will extend the test surface and therefore will need tests that are not applicable to 5.0

### 2. Resolve Build Context Once

In firmware [.github/workflows/build_firmware.yml](../esp_rgbww_firmware/.github/workflows/build_firmware.yml),
make the preparation job emit canonical branch, version line, stage, source SHA,
artifact-safe branch key, required RGBWWLed version/commit, and SoC JSON/CSV.

- Push: resolve the version line from the pushed canonical branch.
- Pull request: use the base branch for line/matrix policy and test the PR merge
  revision. Do not infer the release line from an arbitrary feature-branch name.
- Manual dispatch: resolve and validate the selected branch, and check out that
  branch's exact resolved SHA consistently in every job.
- Temporarily map `develop` to `5.0/develop` and `experimental` to `5.1/develop`
  when handling migration aliases. Reject unknown release lines rather than
  silently defaulting to develop or all SoCs.
- Use one policy for matrix, metadata, and pin validation. After checkout, fail
  if the submodule commit/version does not match the selected release line.

### 3. Adapt Build and Test Workflows

- Replace the fixed SoC list with `5.0 = [esp8266, esp32, esp32c3]` and
  `5.1 = [esp32, esp32c3]`. Preserve existing debug/release and image variants.
- Update push/PR filters, dispatch choices, branch-to-webapp mappings, and
  development-stage runtime-webapp handling for both canonical branches.
- Remove ESP8266 as the condition for generic once-per-release work such as
  version-info upload, release tagging, and webapp schema dispatch. Prefer a
  dedicated job after required tests/builds succeed; if using a representative
  matrix cell, constrain every variant axis so the work runs exactly once.
- Retain the ESP8266-only condition for its partition-map generation.
- Scope version/tag discovery and prerelease numbering to the selected `5.0` or
  `5.1` line; current global `v5.*` discovery must not let one line advance another.
  Preserve the selected major/minor and handle retries/concurrent runs without
  colliding tags or publishing different artifacts under one version.
- Update firmware [component.mk](../esp_rgbww_firmware/component.mk) version
  fallbacks, currently hard-coded to `V5.0`, so local and Host builds report the
  correct line when CI does not supply an explicit version.
- Update [swarm_test.yml](../esp_rgbww_firmware/.github/workflows/swarm_test.yml)
  filters/dispatch checkout; keep Host validation for both lines and retain the
  restriction against running untrusted PR code on the self-hosted runner.
- Update webapp [test.yml](.github/workflows/test.yml) and
  [deploy.yml](.github/workflows/deploy.yml): versioned refs, firmware dispatch
  mapping, line-derived version strings instead of fixed `V5.0`, and nested paths.
  Audit slash-containing branch names in substitutions, URLs, and artifact names.

### 4. Apply M1 Publication and Discovery Contract

In firmware [deploy-pages.yml](../esp_rgbww_firmware/.github/workflows/deploy-pages.yml):

- Select the exact successful triggering run and source SHA, not the publishing
  workflow's default branch or an unrelated newer run. Exclude PR builds from
  release publication and use explicit approved canonical branches.
- Keep artifact keys sanitized consistently between producer and consumer
  (`5.1-develop`), while canonical metadata/paths retain `5.1/develop`.
  Preserve a compatibility path for older artifacts where needed.
- Require the declared SoC list to agree with the release line. Allow the legacy
  all-SoC metadata fallback only for known legacy 5.0 artifacts, never for 5.1.
- Require every expected build artifact before updating catalogue/latest records;
  missing ESP8266 on 5.1 is intentional, missing ESP32/C3 is a failed publication.
- Carry canonical branch, firmware version, source/dependency SHAs, and supported
  SoCs through version-info, uploads, webapp dispatch, and discovery metadata.
- Audit existing server upload/discovery and updater handling for slash-containing
  stages. Preserve deployed legacy clients while ensuring ESP8266 cannot discover
  5.1 and an ESP32 client is not moved between lines by SoC matching alone.
- Check the log service can resolve artifacts from versioned paths. Do not require
  the entire proposed product-aware catalogue redesign to complete M1.

### 5. Validate and Cut Over

First add focused policy tests for branch/event resolution, matrices, version
isolation, pin mismatch rejection, artifact naming, and publish eligibility.
Lint YAML and embedded shell, then run non-publishing CI qualification:

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
