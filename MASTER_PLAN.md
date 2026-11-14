# Lightinator Cross-Project Master Plan

Status: M2 and M3 are done per user decision on 2026-11-14. M4 is awaiting review across the unified webapp and Home Assistant. M5 requires design work. M6 remains open until all other milestones are complete. M1 fleet/HA qualification remains open; storage/recovery qualification is deferred.
Updated: 2026-11-14.

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

Firmware build sources are the versioned `5.0/*` and `5.1/*` release refs.
Retire unversioned firmware build/publish/swarm triggers and manual source choices;
retain old refs, legacy download aliases and any default-branch workflow hosting
until those are separately migrated. Do not delete historical releases.
The webapp remains unified: no separate required 5.1 webapp fork or canonical
webapp branch cutover is approved. Leave its existing branches and triggers alone;
future 5.1 feature work and fixes for both lines are a separate branch-policy decision.

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

| Milestone | Outcome                                                                                                                                                              | Depends On                                             | Status                                                             |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------ |
| M1        | Version-aware publication, server discovery/options, updater clients, legacy adapters, and compatible frontend delivery. Storage/recovery qualification is deferred. | None                                                   | Close-out: fleet pending; publication hardening in rollout         |
| M2        | Versioned development-line cutover, exact RGBWWLed pins, correct CI matrices; qualify contracts for next-generation runtime work.                                    | M1 readiness gates; CI preparation can proceed earlier | Done (user decision, 2026-11-14)                                    |
| M3        | 5.1 hardware/light schemas, built-in offline templates, validated assignments, multiple virtual lights and resource-aware PWM allocation.                            | M1, M2 contract baseline                               | Done (user decision, 2026-11-14)                                    |
| M4        | Offline board/template setup, named-pin and virtual-light management in the unified webapp and Home Assistant.                                                       | M3 API/runtime; catalogue design can proceed earlier   | Awaiting review                                                    |
| M5        | Activate configurable button actions and I2C buses using the definitions and reservations established in M3.                                                         | M3, M4 resource model                                  | Design work required                                               |
| M6        | Qualified firmware/webapp/integration releases and diagnostic lookup.                                                                                                | Completion of M1-M5 and applicable acceptance gates    | Open until all other milestones are complete                       |

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

### Close-Out Decisions (2026-11-05)

The current policy supersedes the earlier bridge-first design. Manual firmware
upgrades are allowed on a compatible SoC under the existing minimum API contract;
no source-line qualification or installed bridge webapp is required. Automatic
firmware updates remain within the installed line, stage and build type. Webapp
updates follow the installed firmware line and stage, with no separate selector.
Cross-line downgrades remain guarded pending ConfigDB schema compatibility review.

| Close-Out Item                                                          | Current Evidence / Decision                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| HA upgrade policy                                                       | Released as [v0.1.27](https://github.com/pljakobs/Lightinator_HA_module/releases/tag/v0.1.27); 13 isolated client tests pass. Running-HA lifecycle qualification is not implied.                                                                                                                                                                                                                                                                           |
| Single-device 5.0 to 5.1 flow                                           | Completed, user-confirmed on 2026-11-05.                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Mixed-device/fleet update flow                                          | Pending.                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Storage, staging reserve and interrupted-install/recovery qualification | Deferred by the user; not represented as completed or a prerequisite for this close-out iteration.                                                                                                                                                                                                                                                                                                                                                         |
| Publication and diagnostics                                             | Ten live firmware targets verified: matching binary SHA256/size, ELF architecture, map/merged images, complete checksum manifests and repaired direct aliases. [Firmware PR #165](https://github.com/pljakobs/esp_rgbww_firmware/pull/165) is merged and deployed; [PR #166](https://github.com/pljakobs/esp_rgbww_firmware/pull/166) prevents older retries from regressing latest pointers. Diagnostic identity fix `de4c07d` is pushed with CI passing. |

The controller webapp payload is exactly four gzip files: HTML, one JS bundle
including all seven languages, one CSS bundle and the icon sprite. Build metadata,
pin configuration and favicon are not controller OTA assets. CI and publisher
staging enforce this contract; `V5.0-417-develop` was verified through legacy and
v2 discovery. [Webapp PR #295](https://github.com/pljakobs/esp_rgb_webapp2/pull/295)
integrates the same updater policy into the existing experimental stream;
`V5.1-418-develop` is also published with four verified file hashes. These are
release-feed records from unified frontend code, not a required frontend fork.

The generic legacy `version.json` deliberately offers only 5.0 firmware to protect
old clients without release-line selection. Explicit legacy firmware API queries
and v2 discovery both expose the maintained 5.0 and 5.1 lines.

### Implementation Checklist

Checked items mean implemented with the evidence stated below; they do not imply
full browser, Home Assistant or recovery qualification. Historical local test
counts are retained as historical evidence, not the current release status.

- [x] Add version-aware firmware options/versions/latest discovery, canonical line/
      stage normalization, stable candidate IDs, and repeatable SQLite metadata migration.
- [x] Switch frontend firmware discovery from fetching `version.json` to the API,
      with fallback to the legacy API only when v2 is unavailable.
- [x] Add independent build-type, release-line, stage, and full-version selection;
      clear stale selections and preserve the installed line by default.
- [x] Resolve fleet candidates through per-controller line/stage/type API requests
      and revalidate selected artifacts before sending the firmware OTA request.
- [x] Add version-line selection and canonical identity handling to Home Assistant,
      with isolated client tests and pre-install artifact revalidation.
- [x] Add the legacy-shaped `/api/webapp/latest` adapter and v2 webapp discovery
      with compatibility/capability/asset-size filtering.
- [x] Remove mandatory cross-line qualification and bridge-first checks from manual
      upgrades; retain target validation and a separate ConfigDB downgrade guard.
- [x] Integrate discovery and the read-only `version.json` projection with the
      existing `feature/multi-product-ota-releases` catalogue, preserving legacy rows.
- [x] Start isolated loopback discovery at `http://127.0.0.1:8766/api/docs` and
      verify the actual frontend and HA API clients. HTTP publishing is disabled;
      imported download URLs remain unchanged and no device was flashed.
- [x] Adapt the secured server-side `manage_version.py` publisher to write SQLite
      directly without reading or writing the JSON projection; test CI-compatible commands.
- [x] Retain per-run publisher uploads through SSH/rsync, sourcing a tested bundle
      from a pinned distribution-server commit and checking its SQLite publisher contract.
- [x] Publish the reviewed server commit and set `DISTRIBUTION_PUBLISHER_SHA` in
      both CI repositories; missing/non-immutable pins intentionally block publishing.
- [x] Exercise the adapted script and existing CI/rsync paths on the deployed server.
- [x] Preserve immutable webapp bundles and legacy endpoint response shapes in tests.
      HTTP upload code remains deferred, not a deployed M1 requirement.
- [x] Remove frontend catalogue merging and generic fleet fallback code. Manual
      discovery and Update All consume API records, never fetch the JSON projection.
- [x] Keep Update All within each controller's installed major/minor line, stage,
      legacy feed and build type; require a newer release and recheck before OTA.
      An ESP32 pinned to `5.0/testing` cannot automatically move to `5.1/testing`.
- [x] Exercise the single-device 5.0 to 5.1 flow (user-confirmed).
- [ ] Exercise the mixed-device/fleet flow in browser and device tests.
- [ ] Qualify Home Assistant options/saved-preference migration in a running HA
      instance; isolated API tests do not cover the full options flow.
- [ ] Confirm deployed installed identity and firmware-line/stage webapp selection
      across remaining client flows; independent webapp preferences are not required.
- [ ] Integrate normalized CI/publication metadata, complete-artifact promotion,
      legacy catalogue projections, and diagnostic artifact lookup.
- [ ] Deferred: measure installed assets and safe staging/reserve budgets and qualify
      interrupted-install/recovery behavior on ESP8266, ESP32 and ESP32-C3.

Evidence: 14 server unit tests, 23 frontend service/selector tests, and 9 isolated
Home Assistant API tests passed for the client/M1 work. The integrated OTA
worktree now passes 32 server tests locally and on the production host, including separate-process CLI publication,
plus live frontend and HA discovery smoke
checks against the isolated loopback server. The final client production build
passed on 2026-11-04. Frontend lint is
currently blocked by the existing missing `plugin:vue/vue3-essential` preset.
See the detailed plan for test commands and production backup/receipt locations.
Production discovery and the user-confirmed single-device OTA are verified; fleet
testing and the running-HA lifecycle remain unqualified. Checked implementation
tests for deferred work do not make that work M1 scope.

Both modified publishing workflows passed YAML parsing and syntax checks for all
35 embedded shell blocks. Deploy the compatible SQLite server/schema and configure
the reviewed publisher SHA before enabling these workflow changes. CI tests that
revision, uploads run-specific code/dependencies, and removes only its own bundle.
The `--publisher-contract` probe prevents fallback to an old JSON writer.
Automatic culling currently retains all releases/assets to protect installed clients.

### Remaining Milestone Requirements

- Preserve the implemented version-aware discovery and legacy adapters while
  completing deployment and compatibility qualification across supported clients.
- Complete and verify consistent structured identity across firmware metadata,
  webapp OTA, CI publishing, and log lookup. Do not derive feeds from sanitized
  version suffixes. Keep ordinary updates on their selected line.
- Maintain compatible frontend functionality through shared capability activation
  and justified line-specific differences; retain firmware-line/stage webapp feeds.
- Complete publication/diagnostic rollout and per-controller fleet verification.
  Running-HA lifecycle testing remains distinct from the released API client fix.
- Keep storage/recovery qualification deferred and ConfigDB downgrade safety under
  explicit review; neither introduces an upgrade qualification system.

M1 acceptance is end-to-end update-chain evidence, not merely new selectors or
successful builds. The detailed plan defines policy, rollout, and test coverage.

## M2: Versioned Release Stages

Status: **Done**, per user decision on 2026-11-14. Retained backlog and release
qualification notes below do not reopen M2 or claim fresh verification.

### Development-Line Implementation Status

The current build and release procedure is documented in
[CI_RELEASE_PROCESS.md](../esp_rgbww_firmware/CI_RELEASE_PROCESS.md). Earlier CI
preparation used separate firmware and webapp feature branches; local policy
suites and GitHub workflow-validation runs passed. The implementation covers versioned
triggers, immutable source checkout, line-specific matrices and version counters,
RGBWWLed pin checks, external SPA delivery, and the M1 pinned SSH/rsync publisher.

The firmware `5.0/develop` and `5.1/develop` refs have been created, their required
build variants have run and development artifacts have been published. This does
not qualify production promotion or the remaining fleet/HA/recovery flows.

- [x] Create the versioned development refs, run their required build variants,
      and publish development artifacts.
- [x] Implement versioned triggers, line-specific matrices and version counters,
      component version checks, external SPA delivery, and the pinned publisher.

### Retained Follow-Ups (Not M2 Completion Gates)

Decision on 2026-11-05: retain the following items as backlog and proceed with M3.
They are not marked completed or freshly verified. Production promotion and
default/protection changes still require their applicable checks.

- [ ] Preserve the established `5.0/develop` / RGBWWLed `0.10.1` and `5.1/develop` /
      `0.11.0` mappings; confirm consumers before changing defaults/protections or
      enabling further promotion paths.
- [ ] Fix local/Host firmware version fallbacks so they do not hard-code `V5.0`.
- [ ] Pin the Sming builder image by digest and action revisions; `latest`, floating
      hosted runners, and tag-based action refs currently prevent byte-reproducible builds.
- [ ] Verify and complete same-line collision-safe version allocation and fail-closed
      publication when required artifacts are missing; recent CI changes may already
      address part of this item. Do not treat the previous requirement as a fresh audit.
- [ ] Carry and persist exact source/dependency provenance in the catalogue; current
      M1 publisher compatibility records do not represent the later manifest model.
- [ ] Revisit API schema hashing and CI drift checks: distinguish changes to
  authoritative ConfigDB sources and storage metadata from changes to the
  public API contract, while preserving trustworthy source provenance.
- [ ] Run every required firmware variant, Host checks, external-webapp compatibility
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

For backlog qualification, run the existing Host smoke checks and all required
hardware build variants for both lines. Stage upload/discovery tests must verify
versioned paths and legacy compatibility, including updater and log-symbol lookup.

Canonical development refs and development-channel publication are established.
Further production promotion and default/protection changes remain separately
qualified; the backlog does not block M3 development. Keep known-good artifacts
and legacy aliases until consumers are verified. Rollback restores routing to a
qualified release, not rebuilt artifacts.

## Later Milestones and Linked Plans

| Workstream                                            | Detailed Plan / Reference                                                                                                                                                                                                  | Coordination Requirement                                                                                                                    |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Release lines and independent API-compatible releases | Firmware [README](../esp_rgbww_firmware/README.md)                                                                                                                                                                         | This master plan fixes the immediate exact component pins and development mappings; keep policy synchronized.                               |
| ConfigDB migration and firmware API                   | Firmware [API_SCHEMA.md](../esp_rgbww_firmware/API_SCHEMA.md), [FIRMWARE_ARCHITECTURE.md](../esp_rgbww_firmware/FIRMWARE_ARCHITECTURE.md)                                                                                | The current schema and runtime are authoritative; historical migration sketches are not current implementation guidance.                    |
| QuinLED and multiple lights                           | [Quinled_Plan.md](Quinled_Plan.md)                                                                                                                                                                                         | M3/M4 share stable light IDs, named resources, capability gates, and legacy catalogue compatibility.                                        |
| Host/build qualification                              | Firmware [HOST_EMULATOR_TESTS.md](../esp_rgbww_firmware/HOST_EMULATOR_TESTS.md)                                                                                                                                             | Reuse existing checks; Host is a test target, not a supported OTA SoC.                                                                      |
| Update infrastructure and shared frontend             | [UPDATE_INFRASTRUCTURE_PLAN.md](UPDATE_INFRASTRUCTURE_PLAN.md)                                                                                                                                                             | M1 owns the current contract, legacy adapters, client migration and measured frontend budget.                                               |
| Distribution service                                  | [plan.md](../lightinator_server/plan.md), [backend_Migration.md](../lightinator_server/backend_Migration.md)                                                                                                               | Explicit line/stage discovery is M1; full product-aware catalogue modernization remains separately scoped.                                  |
| Home Assistant integration                            | [README.md](../Lightinator_HA_module/README.md)                                                                                                                                                                            | Track implementation against shared M2-M5 contracts; this reference is not a separate implementation plan.                                  |
| Diagnostic service                                    | [FIRMWARE_AGNOSTIC_PLAN.md](../lightinator-log-service/FIRMWARE_AGNOSTIC_PLAN.md), [CRASH_REPORT_MODULE_PLAN.md](../lightinator-log-service/CRASH_REPORT_MODULE_PLAN.md)                                                   | Preserve unambiguous product/version/target identity for artifact and symbol lookup.                                                        |

### M3: Firmware Schema and Runtime Foundations

Status: **Done**, per user decision on 2026-11-14. Historical checklists below
are retained as evidence and review context, not current milestone blockers.
Final cross-project and hardware qualification remains tracked under M6.

Detailed design:
[Quinled_Plan.md](Quinled_Plan.md#storage-and-api-contract-proposal-2026-11-05).
The firmware implementation is reported implemented by the user on 2026-11-08.
The merged [PR #167](https://github.com/pljakobs/esp_rgbww_firmware/pull/167)
evidence and open-gate lists dated 2026-11-07 below are historical snapshots;
they are not a current audit. Implementation does not itself establish physical
hardware qualification. M4a uses the current OpenAPI and referenced schemas.

#### Historical Implementation and Open Gates (2026-11-07)

- The draft implements a separate SoC pin-capability ConfigDB, a versioned
  embedded gzip catalogue with `/catalog` readback, numeric-GPIO assignments,
  owned virtual lights and queued configuration reloads. HTTP, WebSocket and
  generic MQTT route commands by persistent numeric light index; spontaneous
  color events currently represent only the default light. HA-specific MQTT
  handling remains deferred.
- Local Host and ESP32-C3 builds passed; the full local Host API/RGBWW suite
  passed 83 tests with one intentional live-OTA skip. The PR's Host smoke check
  passed after the Python 3.8 test-import fix. No physical hardware qualification
  or completed M3 release is implied.
- Resource validation currently happens during reload after the ConfigDB commit:
  invalid changes can remain persisted while running outputs retain their previous
  configuration. Candidate validation before persistence, safe rejected writes,
  released-5.0 migration, per-light restore state and advertised capabilities
  remain open. Board-level constraints and actual PWM/timer capacity require
  further validation and hardware qualification.
- The agreed default-light contract requires exactly one default when lights
  exist; an empty light list is valid. Do not silently substitute index zero.
  Validate this rule before persistence when candidate validation is implemented.
- The draft pins RGBWWLed commit `7e84f40` while its version string remains
  `0.11.0`. Reconcile exact dependency provenance and the M2 release-pin policy
  before promotion; the version string alone does not establish the commit.

#### Historical M3 Implementation Checklist (2026-11-07)

This checklist records the draft state of the subsequently merged PR #167.
Unchecked items are historical review leads, not an assertion of current missing
implementation and not blockers to the agreed M3 completion status.

- [x] Seed separate SoC GPIO capabilities and provide the embedded, versioned
  hardware catalogue through `/catalog`.
- [x] Store numeric-GPIO light assignments and initialize owned virtual lights;
  queue runtime reloads after configuration commits.
- [x] Route light-specific HTTP, WebSocket and generic MQTT commands by persistent
  index, with default-light handling and default-only spontaneous events.
- [x] Support named RGB-family raw channels and ordered non-RGB raw arrays,
  preserving missing/null channels and treating zero as off.
- [x] Generate API schema projections; pass focused schema/controller checks,
  local Host and ESP32-C3 builds, and the full local Host API/RGBWW suite
  (83 passed, one intentional skip). PR Host smoke passed.
- [ ] Validate configuration candidates before persistence and prove rejected
  writes preserve persisted configuration and active outputs.
- [ ] Complete released-5.0 migration, per-light restore and light-aware data
  references, runtime API/capability advertisement, and client compatibility.
- [ ] Resolve dependency provenance; qualify board constraints, PWM/timer
  capacity, reset/restart and physical hardware.

#### Coordinated Delivery Sequence

Treat the schema change as a cross-project feature, not a schema-only change.
M3a and M3b are hard-linked parts of one feature branch and delivery unit: schema
changes must ship with the firmware code that uses them, not as an independently
released schema update. Develop and validate them together. Client development
may use agreed fixtures earlier, but activation requires the working M3 contract.
M4a is the priority client follow-up; M4b may be delivered later and does not block
M3 or M4a completion.

1. **M3a: Update the schema.** Define the 5.1 app-config/app-data structures,
   built-in templates, supporting board definitions and migration rules. Generate
   typed accessors/API schemas and shared valid/invalid payload fixtures. Leave
   the 5.0 schemas and normal pinconfig.json contract unchanged.
2. **M3b: Enable schema use in firmware.** Load defaults and persisted settings,
   migrate existing wiring safely, and initialize actual lights from the new
   configuration. Read active settings with `GET /config`; clients resolve
   templates from `GET /catalog` and submit assignments through `POST /config`,
   assigning stable device light IDs and indexes. Template and custom paths must
   share candidate validation, persistence and runtime initialization; there is
   no separate template-application endpoint.
   Advertise support only when this path works, not merely when fields exist.
3. **M4a: Update the webapp.** Add template selection/application and explicit
   custom light/pin configuration, using device-provided offline definitions and
   the M3b API. Disable advanced controls and do not issue advanced reads or
   writes on 5.0 firmware or firmware without the required capability. Retain
   normal legacy RGBWW configuration there.
4. **M4b: Update Home Assistant.** Add template selection/application and custom
   configuration through the same M3b API, with readback, validation errors and
   stable per-light entities. Apply the same 5.0/capability guards; do not keep
   an independent writable assignment model in the integration.

M3 requires focused schema/runtime tests as one integrated feature before client
activation. M4a acceptance covers webapp template/custom configuration, readback
and restart persistence independently of M4b. Apply equivalent acceptance to Home
Assistant when M4b is implemented; report its pending status separately rather
than blocking the webapp delivery. Test mixed 5.0/5.1 controllers and verify that
neither client sends advanced schema requests to 5.0. M5 peripheral action/driver
qualification remains separate from M3's input polling and I2C initialization.

- **M3a: Storage contract and offline defaults.** Store SoC GPIO capabilities in
  the separate `pins.cfgdb`; provide board inventories and templates through the
  embedded gzip catalogue and `/catalog`. Store actual numeric-GPIO assignments
  under AppConfig `hardware.configuration`. Board inventories include lighting
  outputs, SDA, SCL and button inputs with electrical restrictions. Configuration
  covers stable-ID lights, types, assignments, color settings, clear pin, buttons
  and buses; remaining per-light startup/restore requirements need implementation.
- First installation and factory reset must not require GitHub, an upstream
  network or a pre-existing client cache. Catalogue updates must not overwrite
  active assignments. Verify blank-filesystem and reset behavior and measure
  memory/storage cost; the embedded seed and working-copy flow are implemented.
- Extend [app-data.cfgdb](../esp_rgbww_firmware/app-data.cfgdb) with stable-ID
  per-light restore state and light-aware preset/scene/group references. Keep
  hardware templates and wiring in app-config, not app-data; do not persist live
  button events or every transition update. Migrate global color settings and
  singular last-color explicitly rather than retaining two writable authorities.
- **M3b: Validated runtime and API.** Implement shared GPIO ownership, board/SoC
  validation, whole-configuration validate/apply, revision checks, safe persistence
  and restart, a bounded RGBWWLed registry, and PWM allocation. Expose actual
  supported schemas/types/limits through capabilities for both clients.
- Validate and reserve SDA/SCL/button resources in M3; M5 still owns configurable
  actions and further peripheral qualification. Qualify Esp32HardwarePwm capacity and timer grouping before
  advertising all 15 Deca outputs; any split RGB/tunable-white backend groups
  remain one public RGBWW virtual light.

M3 gates: schema/code generation, ownership/conflict and migration tests, offline
default availability, rejected writes preserving both persisted and active wiring,
Host checks and ESP32/C3 builds. GPIO count alone does not establish usable PWM
capacity.

#### Client Compatibility and Future Scene Considerations

- Each client must discover the current controller's advertised API version and
  feature capabilities, then choose its supported request/schema profile per
  controller. Define and advertise a stable runtime contract for this: the
  generated `api-version.json` is a build artifact, not proof that devices expose
  a negotiated API version. A version identifies the contract; capabilities and
  each configured light's type determine available controls, HSVCT components,
  raw shape and channel order. Do not assume firmware release line alone proves
  support. Refresh cached capabilities after firmware/configuration changes.
- Controllers without negotiation use the known legacy single-light contract;
  unknown or unsupported contracts must not receive speculative advanced reads
  or writes. Keep safe legacy operations available where compatibility is known.
  Define supported API versions, unknown-version behavior and schema evolution
  independently of firmware version and update-channel selection.
- **Future consideration — scene design remains open.** Per-setting light-target
  resolution during scene execution and safe storage/synchronization across mixed
  firmware versions are unresolved design questions, not M4 acceptance criteria.
  The representation and safeguards below are proposals only; defer scene
  execution and synchronization changes until the design is agreed.
- Proposed additive scene representation: keep `controller_id` unchanged and
  add an optional structured `light_id` field to each scene setting, rather than
  encoding both identifiers into `controller_id`. Missing `light_id` means the
  legacy/default-light target. Resolve a stable light ID to the controller's
  current numeric command index; an explicit missing/deleted ID is an error,
  never a fallback to another light. Define ID lifetime/reuse rules so deleted
  references cannot silently target a replacement. Multiple settings may target
  the same controller and different lights; sequence/queue ordering is per light.
- Current scene storage and synchronization replicate records to controllers,
  including legacy devices. Before enabling new fields, prove old ConfigDB and
  clients preserve them through read/write and synchronization, or design a
  versioned storage/projection strategy that cannot lose or misapply explicit
  targets. Decide an interim save/sync policy before implementation; do not strip
  explicit targets or silently route them to a default light. Preserve existing
  legacy behavior until the mixed-version contract is agreed.
- Extend the authoritative AppData/transport schemas, generated projections,
  clients and shared fixtures together once the representation and storage
  strategy are agreed. Test old/new reader-writer round trips, mixed fleets,
  version negotiation, per-profile controls, deleted/renamed lights, independent
  per-light queues, offline controllers and partial failures.

### M4: Offline Setup and Assignment Clients

Status: **Awaiting review**, per user decision on 2026-11-14. Review the current
webapp and Home Assistant implementations against the acceptance criteria below;
historical implementation snapshots do not establish the current gap list.
Webapp delivery includes merged PR #297; Home Assistant now includes virtual-light
entities, light management, hardware configuration and per-light preset controls.

Delivery priority: M4a (webapp) follows integrated M3; M4b (Home Assistant) may
follow later. Each client has its own acceptance gate against the shared API.

#### M4a: Virtual-Light WebUI Adaptation (2026-11-08)

The user reports M3 implemented and authorizes planning the client adaptation.
The earlier M3 draft evidence above is historical, not a fresh assessment of the
completed firmware. Use the current firmware
[OpenAPI definition](../esp_rgbww_firmware_m3/openapi.json) and its referenced
ConfigDB/JSON-RPC schemas as the implementation contract. Its inferred document
version is not the controller's negotiated API version. The initial M4a mode
selection follows the firmware-only decision below; do not invent endpoints.

Scope: extend the existing unified WebUI, retaining its Quasar components and
legacy single-light behavior. Board/template setup remains tracked above;
Home Assistant, scene-storage redesign and M5 actions are not part of this slice.

Compatibility is mandatory: choose the UI/request mode from the **current
controller's firmware version** (user decision on 2026-11-08: firmware version
is sufficient as the discriminator; runtime API negotiation is not a prerequisite).
5.0 controllers retain the existing
single-light ColorModelCard, legacy pin configuration and color pickers; do not
show virtual-light CRUD/selectors or send advanced assignment payloads to them.
Enable virtual-light mode for the supported 5.1 firmware line using its documented
M3 schema. Unknown firmware lines must not activate speculative advanced access.
For 5.1, light definitions replace the legacy controller pin-configuration
workflow. PWM frequency/resolution, spread spectrum and phase shift remain
controller-wide under `hardware.pwm`, shared by every light, not copied into
individual light definitions. Place the controller card on **Color Settings**,
beside light definitions, not on System Settings. It is PWM-only on 5.1 and
retains its complete legacy pin/PWM UI on 5.0. Reevaluate both cards together
when switching controllers so incompatible pin controls cannot remain active.
Reevaluate mode on every controller switch and firmware/API change, including
switches in both directions between 5.0 and 5.1. Invalidate stale light selection,
drafts and pending operations so no request can leak into another controller or
an incompatible profile. Picker dialogs use their target controller's profile,
not an application-wide mode.

Implement in this order:

1. **Contract and shared state.** Select the current controller's firmware profile
  and use the documented light types and limits. Read active light assignments from
  `GET /config`; read device-provided board/pin definitions through `GET /catalog`
  only when supported. Keep selection and color state scoped to controller and
  stable light ID; resolve the persistent numeric index when sending a command.
  Refresh configuration/capabilities after apply or controller/firmware changes.
  Unsupported or unknown firmware profiles retain known-safe legacy controls and receive
  no speculative advanced reads/writes.
2. **ColorModelCard light editor.** Add/select/delete virtual lights, edit their
  names, select their supported color model, and configure the number and identity
  of associated numeric GPIOs. Named RGB-family channels follow the selected
  model; non-RGB channels follow the schema's ordered channel representation and
  device limits. Present board labels alongside GPIO identity when available.
  Preserve stable IDs/indexes across rename, model and wiring edits; do not reuse
  deleted IDs. New IDs/indexes must satisfy the firmware contract. Include default
  light selection: exactly one default for a nonempty list; an empty list is valid.
  Deleting the default requires an explicit replacement when other lights remain.
3. **Safe configuration apply.** Edit a local draft, not active store state. Validate
  required channels, unique/available GPIO ownership, reserved button/bus/clear
  pins and advertised limits, with firmware validation authoritative. Preview
  destructive model/pin changes and confirm deletion. Submit a whole assignment
  candidate through `POST /config`, preserving unrelated configuration and using
  revision checks if supported. Do not split a candidate into partial commits.
  Keep rejected edits visible with errors while retaining active configuration;
  read back accepted configuration before treating it as applied. Support cancel,
  loading, failure and empty-light states.
4. **Light-aware pickers.** Add a light selector to the main ColorPickerCard and
  applicable picker dialogs. Derive HSV/CT availability and RAW channel controls
  from the selected light's type/capabilities, not global legacy color settings.
  Address reads/writes to that light using the documented `light` selector;
  preserve named RAW objects and ordered arrays, null/missing channels and zero.
  Fetch state on selection and prevent stale responses/events or queued changes
  from updating another light after a switch. Explicit missing/deleted targets
  are errors, never a fallback to the default. Empty configurations disable color
  commands. Route spontaneous events only where their target is unambiguous.
  Audit favorites/presets and dialog callers so unsupported scene/group targets
  cannot silently execute on the selected or default light; retain safe legacy
  scenes without adding unqualified targeted scene storage/synchronization.
5. **Qualification.** Add focused tests for capability guards, light CRUD, stable
  identity/default invariants, model/channel mapping, pin conflicts/reservations,
  atomic rejected writes and readback. Test picker selection, target routing,
  stale fetch/event isolation, deletion and all supported control profiles,
  including non-RGB RAW arrays. Verify mixed legacy/advanced controllers issue no
  advanced requests to 5.0. Cover 5.0-to-5.1 and 5.1-to-5.0 controller switches,
  missing/unsupported firmware versions and firmware changes, proving legacy controls
  still work and stale selections/drafts/requests never cross profiles.
  Build the unified bundle and check desktop/mobile UI;
  qualify device readback/restart persistence separately from mocked browser tests.

- [x] Implement firmware-profile selection and controller/light-scoped state.
- [x] Extend ColorModelCard with light CRUD, names, color models and GPIO assignment.
- [x] Implement validated draft/apply/readback without optimistic active rewiring.
- [x] Extend main/dialog color pickers with target selection and relevant controls.
- [ ] Pass focused compatibility/routing tests, build and browser checks; record
    device persistence evidence separately before declaring M4a qualified.

  Initial local implementation evidence (2026-11-08): the focused helper/API/store/
  control suites pass; the unified Quasar build passes. An isolated Playwright run
  with all device HTTP/WebSocket traffic mocked verifies light add/delete and atomic
  apply/readback, white-light controls and RAW arrays, target-preserving dialog
  commands, desktop/mobile layout, and 5.1 -> 5.0 -> 5.1 switching across pages.
  Color Settings now hosts the light editor and controller card: PWM-only for 5.1,
  full legacy pin/PWM configuration for 5.0. New icons use `svgIcon` and the supplied
  sprite; dropdowns reuse `mySelect`. Firmware watcher lifetime is store-owned so
  page navigation cannot disable mode switching.
  Selection regression coverage (2026-11-09) checks that periodic runtime-info and
  same-address controller refreshes do not reload lights or reset the picker.
  Same-controller reloads retain an existing selected light; controller changes
  and removed selections resolve to the configured default.
  Profile-specific picker UX (2026-11-09): single-channel lights expose one
  brightness slider without HSV/RAW tabs; WWCW lights offer Tunable white
  (brightness/CT) and RAW (independent warm/cold channels); RGB profiles retain
  HSV/RAW. Main and configuration card titles use localized "Lights configuration".
  The redundant main-card picker-dialog launcher is removed; existing editing
  dialogs retain profile-specific controls.

  This is an initial implementation, not full M4a qualification. Template application,
  per-light calibration/startup editing, targeted scene/preset storage and sync,
  complete localization, live per-light event handling, PWM capacity qualification
  and actual device restart persistence remain pending. Advanced favorites/preset
  tabs are not activated; existing legacy scene dialogs remain unchanged. The new
  light-aware dialog preserves an explicit
  light ID. Client-side configuration comparison detects intervening changes, but
  does not claim a server-enforced compare-and-swap transaction.

Local testing target: `192.168.29.69` is the user-provided 5.1 controller for the
local Quasar dev server. Set its address through the ignored
`src/config/localOverrides.js` development override; production continues to use
the serving controller's hostname. Verify its firmware line and schema before
advanced tests; API negotiation is not required for this initial slice. This target does not replace separate 5.0 compatibility
testing, and test setup alone does not authorize flashing or destructive resets.

- Use one shared device API in the unified webapp and Home Assistant for board
  selection, virtual-light creation/editing and named-pin assignments. Keep
  light/entity IDs stable across renames and wiring changes.
- First-run setup reads templates and board definitions from the controller;
  selecting a template creates actual configuration and device light IDs without
  an upstream fetch. Applying later templates or profile revisions requires an
  explicit preview/confirmation; existing wiring and customizations survive.
- Show available/assigned/reserved resources and validation errors. Gate new
  controls and writes by each controller's API contract and capabilities,
  including bus/button activation controls that remain unavailable until M5
  support is present. Apply the scene compatibility contract above to controls,
  groups, presets and scene editing/execution as appropriate.

M4 gates: offline first-run/template application, restart/readback, mixed 5.0/5.1
client tests, API negotiation and per-light capability handling, stable per-light
command/state routing, and no advanced payloads sent to 5.0. Scene target
execution and mixed-version scene storage/synchronization are future design work,
not M4 gates. No separate required 5.1 webapp fork is introduced.

### M5: Button Actions and I2C Activation

Status: **Design work required**, per user decision on 2026-11-14. Agree the
button action/event contract, I2C/peripheral lifecycle and shared client controls
before treating the implementation proposals below as an approved design.

M3's draft already initializes configured I2C and polls/debounces button inputs;
this is not qualification of button actions or hardware behavior. Complete typed
button actions and I2C configuration using the persisted pin definitions and
ownership model. Configure SDA/SCL as a bus pair; qualify shared bus
initialization independently of later peripheral drivers. Add supported
button actions and Home Assistant events according to the design direction below, with
debounce, recovery semantics and conflict checks. Add corresponding client
controls through the same API. OLED/sensor drivers and addressable LED support
remain investigation-led additions, not implied by an enabled I2C bus.

#### Button Action Design Direction (2026-11-14)

Button configuration should support a flexible choice of typed actions rather
than hard-code every press as a light toggle.

| Action | Intended behavior | Design status |
| ------ | ----------------- | ------------- |
| Light on/off | Switch a configured target light on or off; the simplest local action. | Proposed; explicit on/off versus toggle and target selection still need definition. |
| Button-pressed event | Emit a simple "button X pressed" notification over both WebSocket and MQTT for a home automation system to interpret. The event identifies the originating controller and button rather than prescribing an automation. | Proposed; wire payload, MQTT topic and delivery semantics remain to be designed. |
| Run an animation | Execute a configured animation when the button is pressed. | **TBD** pending animation redesign and the local-versus-swarm execution decision. |

For animation execution, distinguish a local controller reading the animation
structure and executing its commands from a swarm execution in which the
controller sends commands to other controllers. Neither mode is approved yet;
do not implement animation button bindings before resolving that contract.

Further design decisions include whether a press selects one action or can
combine actions, supported press gestures, and stable target identity/error
handling. Do not infer multi-action lists, long/double presses or animation
execution from the flexibility requirement alone. Keep destructive clear/reset
behavior separate from ordinary button actions.

- [x] Implement configured I2C initialization and debounced button polling in
  draft PR #167; physical behavior remains unqualified.
- [ ] Design the typed button actions and shared WebSocket/MQTT pressed-event
  contract; resolve on/off semantics, target selection and action composition.
- [ ] TBD: resolve animation redesign and local-versus-swarm execution before
  specifying animation button bindings.
- [ ] Implement and qualify configurable actions, events, client controls and
  concurrent peripheral behavior.

### M6: Feature Qualification and Release

Status: **Open until all other milestones are complete**, per user decision on
2026-11-14. Completion requires M1-M5 to be closed and the applicable qualification
and release evidence below; M2/M3 completion does not itself close M6.

Qualify the shipped M3-M5 subset on Mini, Deca and Plus board revisions: offline
installation/reset, migration and restart persistence, safe reassignment/failure
recovery, independent light transitions, measured heap/PWM limits, and concurrent
PWM/button/I2C behavior where enabled. Check Plus peripheral reservations and
Mini bootloader/recovery behavior. Record hardware evidence and compatible
webapp/HA behavior before advertising or releasing those features; this does not
mark separately deferred M1 storage/OTA-recovery qualification complete.

### Version Boundary

Advanced schema changes are exclusive to 5.1. 5.0 retains its existing schema and
normal pinconfig.json with simple QuinLED RGBWW presets at existing URLs/embedded
paths. A legacy-compatible representation in 5.1 is optional, not a schema/parser
backport or projection requirement for 5.0. Only capable 5.1 firmware receives v2
assignments. M3 implementation is reported complete; qualification evidence and
M1 follow-ups remain separate.

## Plan Maintenance and Scope

- Update this document when a dependency, decision, milestone status, or cross-project
  gate changes. Keep implementation details and test evidence in the owning project.
- Completion requires linked PR/commit and verification evidence, not just a checked
  checklist. Mark partial implementation explicitly and distinguish local from deployed.
- Resolve conflicts between linked plans here, then update the owning detailed plan;
  do not let contradictory branch names or SoC policies persist across documents.
- Next execution scope is review of M4 across the unified webapp and Home
  Assistant, plus design work for M5. M2 and M3 are done; retained historical
  checklists and follow-ups do not reopen them. M1 qualification and deferred
  recovery work remain tracked separately. M6 stays open until all other
  milestones are complete and its own acceptance gates are satisfied.
  Full distribution redesign remains separate.
