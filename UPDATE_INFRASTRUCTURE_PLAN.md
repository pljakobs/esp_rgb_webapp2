# Version-Aware Update Infrastructure Plan

Status: production discovery/publication deployed; single-device upgrade completed
(user-confirmed), HA client policy released, fleet pending, storage/recovery
qualification deferred. Publication/diagnostic paths are verified. Updated 2026-11-05.
Priority: M1 in [MASTER_PLAN.md](MASTER_PLAN.md), before versioned-line cutover.

## Active Publishing Decision

The current scope supersedes broader designs retained later in this document:
product-aware read-only discovery, SQLite/legacy JSON projection, basic version
bounds, and secured SSH/rsync plus `manage_version.py` publishing. HTTP publishing,
signed-release lifecycle/administration and explicit API-contract management or
negotiation belong to later milestones. Existing implementations retained in the
branch are not public HTTP operations or M1 acceptance requirements.

Keep the secured SSH/rsync publishing process. The adapted server-side
`manage_version.py` updates SQLite after assets arrive; the API serves discovery
and backward-compatible views. HTTP publishing is disabled by default, including
on the local test instance. HTTP upload/promotion instructions elsewhere in this
document are deferred design, not requirements for this rollout. Existing staged
publication code is retained for later security hardening, not enabled for users.

## Current Upgrade and Close-Out Policy (2026-11-05)

Manual upgrades to newer firmware lines require a compatible SoC and unchanged
eligible artifacts, not an installed bridge or source-line qualification. The
minimum API contract is currently shared. Cross-line downgrades are guarded while
ConfigDB schema compatibility is investigated. Automatic firmware updates stay on
the installed line/stage/build type; webapps follow the firmware line and stage.
There is no independent webapp selector or mandatory transition negotiation.
This does not require separate frontend forks: the webapp stays unified and its
current source branches/build triggers are unchanged. Only firmware unversioned
source refs are being retired from build configuration; legacy download/API
compatibility and default-branch workflow hosting remain intact.

The single-device 5.0 to 5.1 flow is user-confirmed complete. Mixed-device fleet
testing is pending. Storage/reserve measurement and interrupted-install/recovery
qualification are explicitly deferred, not silently counted as passed. HA policy
is released as v0.1.27 with 13 isolated tests; testing the full lifecycle in a
running HA instance remains separate. Current publication/diagnostic rollout
evidence is tracked in [MASTER_PLAN.md](MASTER_PLAN.md#close-out-decisions-2026-11-05).

The actual controller manifest must contain exactly four runtime gzip files:
HTML, one JS including all locales, one CSS and the icon sprite. Publisher staging
must exclude VERSION, pin configuration, favicon and other build metadata; checking
only the gzip count inside a larger deployed directory is insufficient.

## Implementation Status (2026-11-03)

`[x]` records local implementation with focused test evidence. It does not mean
deployed, compatible with every historical installation, or ready for cutover.

- [x] Server: additive SQLite firmware identity/integrity fields; version-aware
      firmware options, versions, latest, numeric line ordering, and ESP8266 exclusion.
- [x] Server: legacy-shaped webapp latest manifest and v2 webapp options/versions/
      latest, including capability, firmware/API range, and asset-size filtering.
- [x] Manual upgrades no longer require source-line qualification or installed
  bridge verification; separate cross-line downgrade review remains.
- [x] Deferred HTTP upload implementation validates immutable webapp archives;
  malformed or changed uploads preserve existing bundles. Not an M1 gate.
- [x] Frontend: API service with legacy-API fallback, normalized historical identities,
      release-line/stage/type selection, SemVer ordering, and stale-selection handling.
- [x] Frontend: per-device fleet candidate resolution and artifact revalidation;
  manual upward line changes do not depend on a transition endpoint.
- [x] Home Assistant: line-aware discovery/preferences and pre-install artifact/
  target checks; compatible upgrades need no bridge. Released as v0.1.27.
- [x] Integrate the M1 adapters with `feature/multi-product-ota-releases`, including
      published-release discovery, deterministic legacy projection, non-destructive
      import and old-publisher coexistence. Signed lifecycle work remains deferred.
- [x] Run an isolated loopback server with a temporary database and verify the
      actual frontend and HA discovery clients; publishing requests are rejected.
- [x] Adapt `manage_version.py` for direct database publishing while preserving
      the secured transport and compatible CI command interface.
- [x] Upload per-run publisher bundles from a pinned, tested distribution-server
      revision in both CI publishers; verify the SQLite contract and preserve SSH/rsync.
- [x] Publish the reviewed commit and set `DISTRIBUTION_PUBLISHER_SHA` in both
      repositories; branch names and unset pins are rejected before checkout/publishing.
- [ ] Deploy the compatible server/schema before those workflows and qualify actual server
      database ownership, asset roots, concurrent publishers, and completed artifact sets.
- [x] Remove obsolete frontend catalogue merging and all broad fleet update
      fallbacks; both update flows use API discovery rather than the JSON projection.
- [x] Test Update All against mixed SoCs/build types, unchanged/older candidates,
      unknown identities, historical aliases and a competing `5.1/testing` release
      while the controller remains pinned to `5.0/testing`. Check again before OTA.
- [x] Single-device 5.0 to 5.1 flow (user-confirmed on 2026-11-05).
- [ ] Complete mixed-device/fleet integration tests; unit tests do not flash devices.
- [ ] Fully qualify HA options migration and install lifecycle in Home Assistant.
- [ ] Confirm remaining deployed identity and per-line webapp selection paths;
  independent frontend preferences/negotiation are not part of this close-out.
- [ ] Complete production DTO/OpenAPI qualification, reviewed legacy-record backfill,
      alias policy, signed/publication metadata integration, catalogue projection, and
      whole-release artifact-completeness gates. Integrated signed releases use
      release/artifact/channel identities; imported records use namespaced legacy IDs.
- [ ] Deploy and shadow-test the actual server; qualify existing download paths and
      the legacy `/api/webapp/latest` behavior against deployed controllers.
- [ ] Retain compatible feeds and verify old-client discovery/update paths before
  retiring any endpoint or artifact; no mandatory bridge publication.
- [ ] Deferred: measure safe filesystem/staging budgets, test mixed firmware/frontend pairs,
      and exercise interrupted updates, reboot verification, rollback, and recovery
      on ESP8266, ESP32, and ESP32-C3 hardware.
- [ ] Integrate CI identity/publication and diagnostic lookup, then satisfy M1 gates
      before M2 branch/dependency cutover.

### Verification Evidence

- Integrated OTA worktree: 32 tests passed locally and under production Python with
  `-W error::ResourceWarning -m unittest discover -s tests -v`. This is the current
  integration candidate; the earlier M1 worktree remains preserved separately.
- Both publishing workflows pass YAML and embedded-shell syntax checks (35 shell
  blocks). The script is tested in a separate process with CI-compatible arguments;
  missing/invalid binaries, changed content, mismatched webapp checksums, and an
  unintended database path fail without writing the JSON projection. Retried webapp
  publication preserves bridge compatibility bounds. Culling is intentionally
  non-destructive until upgrade-path retention is qualified.
- The run-specific upload bundle is exercised in a separate process, including its
  pinned API/importer modules and required brand assets. Firmware/webapp bundle names
  have distinct prefixes. Both historical `path` and normalized `filename` webapp
  checksum manifests are accepted. Actual GitHub checkout/deployment awaits a
  published reviewed SHA; no uncommitted revision or invented pin is used.
- Local test URL: `http://127.0.0.1:8766/api/docs`; database-generated catalogue:
  `http://127.0.0.1:8766/version.json`. The instance uses temporary storage and a
  read-only import of the checked-in catalogue. Frontend and HA client smoke tests
  passed; HTTP publishing returned the expected disabled response. Existing binary
  URLs are not redirected to local test assets. No firmware update was performed.
- [Server tests](../lightinator_server/test_version_api.py): 14 passed with
  `.venv/bin/python -W error::ResourceWarning -m unittest test_version_api -v`
  from the server repository. Tests use temporary databases and files, not
  production data; they directly exercise discovery/publication functions.
- [Frontend API tests](src/services/__tests__/firmwareApi.spec.js) and
  [selector tests](src/components/Dialogs/firmwareSelectDialog.spec.js): 23 passed
  with `npx vitest run src/services/__tests__/firmwareApi.spec.js src/components/Dialogs/firmwareSelectDialog.spec.js`.
- [HA API tests](../Lightinator_HA_module/test_firmware_api.py): 9 passed using
  the server virtualenv Python with `-m unittest test_firmware_api -v` from the
  HA repository. These do not start Home Assistant or perform firmware updates.
- The final client `npm run build` passed on 2026-11-04. ESLint could not load the repository's existing
  `plugin:vue/vue3-essential` preset; lint is not recorded as passed.

## Decision and User Flow

Production scope verification on 2026-11-04: 19 GET-only paths; `/api/products`
and default `product=controller`; no HTTP publishing/lifecycle routes, upload
schemas or explicit API-contract filters. All 216 firmware/48 webapp records and
the working legacy experimental feed remain available. Reserved contract metadata
is retained but unsupported requirements fail closed rather than being ignored.

Recovery record:

- Original migration backup: `/var/backups/lightinator/pre-m1-20261103T185303Z`.
- Original-model rollback: `sudo bash /var/backups/lightinator/pre-m1-20261103T185303Z/rollback.sh`.
- Scope-correction code backup/receipt: `/var/backups/lightinator/m1-scope-20261104T080213Z`.
- Private database: `/home/github-deploy/lightinator-server/firmware.db`, service-user
  owned and mode `0600`; the historical database in the webroot is unchanged.
- Active virtualenv: `/var/lib/lightinator/candidates/20261103T185303Z/venv`;
  do not remove it. Source was deployed from the tested integration working tree,
  not a new Git commit. Publish/review a matching revision before enabling pinned CI.
- Original JSON remains a compatibility input for old CI writers; its public URL
  is a database projection. The stale `devel` webapp already lacked files before
  migration; its metadata is retained, but missing bundles are not selected.

Make the complete update chain understand major/minor release lines explicitly.
Yes, the Lightinator server API needs an additive change: the current branch
string combines release line and stage and does not provide compatibility-aware
selector options. Retain the old API and generated catalogue for deployed clients.

The firmware selector becomes:

1. Build type: `debug` / `release`.
2. Release line: `5.0` / `5.1` / future supported major/minor lines.
3. Branch/stage: `develop` / `test` / `stable`.
4. Available full versions for that combination and the controller's target.

SoC is obtained from the controller, not a user-selectable way to bypass hardware
checks. Additional board/layout constraints apply where they affect installability.
Populate selectors from server-provided eligible combinations; do not hard-code
two lines or create options by taking the Cartesian product of unrelated values.
Changing a selector invalidates dependent selections and the selected artifact.
Default to the installed line, stage, and build type; changing line is an explicit
migration, not an ordinary automatic update. Show an empty/no-match state without
falling back to another line, stage, or type. Revalidate before starting an update.

For fleet updates, resolve eligibility independently for every controller and show
skipped/incompatible devices. A single shared selection must not produce one
binary URL for a heterogeneous fleet. Home Assistant uses the same server contract.

## Identity and Terminology

| Field          | Meaning                                                     | Example                      |
| -------------- | ----------------------------------------------------------- | ---------------------------- |
| `release_line` | Numeric major/minor policy and selector                     | `5.1`                        |
| `stage`        | Canonical promotion stage                                   | `develop`, `testing`, `prod` |
| `build_type`   | Firmware build variant                                      | `debug`, `release`           |
| `version`      | Full release version, including prerelease where applicable | `5.1.0-dev.42`               |
| `source_ref`   | Git provenance, not a discovery field                       | `5.1/develop`                |
| `release_id`   | Immutable release/manifest identity                         | Opaque server identifier     |
| `artifact_key` | Transport-safe CI key, not public branch identity           | `5.1-develop`                |

For now, UI labels `test` and `stable` map to existing canonical stages `testing`
and `prod`. This avoids silently renaming the agreed Git stages. Normalize input
aliases at API boundaries, return canonical values, and document the mapping.
Firmware `build_type=release` and `stage=prod` are independent concepts.

Parse release lines as integer major/minor components, never decimal numbers or
lexicographic strings: `5.10` follows `5.9`. Require the version's major/minor to
match its declared line. Establish a documented full-version ordering policy,
including prereleases versus final releases, and an explicit adapter for historical
`V5.x-<build>-<branch>` versions; do not treat the current numeric tuple parser as
a complete SemVer implementation. Stage promotion changes eligibility, not bytes.

Keep `git_version` for diagnostics, but expose structured installed identity from
firmware discovery/info. New clients must not split that string on hyphens to
recover a release line or stage. Legacy adapters resolve known formats and aliases;
an ambiguous identity requires confirmation or a pinned target, not a guessed feed.

## Server Storage and Publication

Owning implementation: [version_api.py](../lightinator_server/version_api.py),
its SQLite migration, publication tooling, and legacy catalogue generation.

- Add normalized release-line and stage fields, immutable release identity,
  source/dependency SHAs, target/build type, and artifact size/checksum metadata.
  Keep the old branch/type/version columns or a compatibility projection during
  migration. Derive and validate canonical source refs rather than conflating them
  with artifact-safe names.
- Backfill only reviewed records: canonical `5.0/develop` is unambiguous;
  `experimental` is not proof of 5.1 because historical experimental builds may
  still have a 5.0 base. Preserve unknown records as legacy-only until qualified.
  Keep a reviewed alias mapping with applicable release/version scope.
- Validate uploads against line policy: initially 5.0 allows all three SoCs with
  RGBWWLed `0.10.1`; 5.1 allows ESP32/C3 only with `0.11.0`. Future lines are
  configuration/policy additions, not parser changes. Never accept arbitrary refs
  as filesystem paths; validate allowed components and encode URLs appropriately.
- Bind artifacts to release identity, target, type, checksum, and immutable bytes.
  Prevent a retry from overwriting an existing identity with different content.
  Publish catalogue/latest pointers only after the required artifact set and
  compatibility metadata validate. Keep previous valid records on failure.
- Firmware compatibility metadata includes supported API identity/capabilities and
  relevant install/layout requirements. Webapp metadata includes supported device
  API range, required baseline capabilities, optional feature requirements,
  package format, installed asset size/file count, and compatibility qualification.
- Minimal release-line/compatibility work belongs to M1. Full multi-product release
  catalogue, signing redesign, and unrelated backend migration remain separate;
  preserve existing authentication/signature protections.

## Additive API Contract

New wire contract: `/api/v2`, implemented locally at the endpoints below.
The table describes the target contract; remaining DTO/qualification work is
listed above. These routes have not been verified on the deployed service.

| Endpoint                          | Required Behavior                                                                                                                                         |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/v2/firmware/options`    | Given controller target/installed context and any selected filters, return eligible release lines, stages, build types, defaults, and migration warnings. |
| `GET /api/v2/firmware/versions`   | Require `soc`, `release_line`, `stage`, `build_type`; return compatible releases in explicit version order, with stable IDs and artifact metadata.        |
| `GET /api/v2/firmware/latest`     | Same constraints; return one eligible release or explicit no-match, never a global latest.                                                                |
| `GET /api/v2/firmware/transition` | Legacy-compatible optional endpoint: upward line changes are ready for a matching target; cross-line downgrades require ConfigDB review. Clients need not call it for upgrades. |
| `GET /api/v2/webapp/options`      | Return eligible frontend stages within the installed firmware release line, subject to API/capability and asset constraints. |
| `GET /api/v2/webapp/versions`     | Return qualified frontend releases and package metadata for the supplied device context.                                                                  |
| `GET /api/v2/webapp/latest`       | Return the newest compatible frontend in the firmware release line and stage, or explicit no-match. |

Example firmware query:

```text
/api/v2/firmware/versions?soc=esp32&release_line=5.1&stage=develop&build_type=release
```

Responses carry the explicit identity fields above, compatibility results, and
artifact URLs/checksums/sizes; clients consume the returned URLs without rebuilding
paths. Option results express hardware-eligible lines without a separate upgrade
qualification requirement. Return lists as empty when
no releases match, `404` for latest with no candidate, and a validation error for
invalid filter combinations. Define concrete DTOs/OpenAPI and fixture examples
before implementation. Reuse shared validation across upload and discovery.

Compatibility context includes installed release/API identity, capabilities, board/
layout where relevant, and the installed frontend identity for a firmware change.
Use a documented bounded encoding for capability collections so embedded clients
can construct requests reliably. Confirm request/response sizes on ESP8266.
Server-side filtering does not replace client/device validation.

### Legacy Adapters

- Preserve existing `/api/firmware/*`, `/api/webapp/*`, and static `version.json`
  consumers with compatible shapes, field names, URLs, and ordering semantics.
  Build old projections from the same authoritative records, not another database.
- Unversioned `develop`/`testing`/`stable` lookups stay on their reviewed legacy
  feed. Do not silently redirect installed 5.0 ESP32 devices to 5.1. Handle
  `experimental` through reviewed historical mapping, not a universal alias rule.
- Verify the deployed server revision and routing: firmware currently calls
  `/api/webapp/latest`; its compatible adapter is implemented and deployed.
  Legacy and canonical 5.0 aliases were verified against the four-file manifest.
- Old clients without enough context receive only qualified legacy-compatible
  records. Unknown compatibility means no automatic migration, not an assumption
  that a higher numeric firmware version is safe.

## Update Consumers and CI

- Firmware info/ConfigDB: retain verifiable installed identity without changing
  legacy field meanings. Optional richer capability/budget metadata is additive;
  independent frontend update preferences are not an upgrade prerequisite.
- Webapp: replace branch string splitting and static catalogue merging with the
  selector contract and explicit selected IDs. Keep adapters for supported old
  firmware/server combinations, and update single-device and fleet flows together.
- Home Assistant: use the same dimensions in options/update entities, migrate
  saved branch preferences, and preserve entity identity. Do not interpret
  `5.1-develop` as a canonical branch or an automatically approved line change.
- Firmware webapp OTA: retain compatible legacy response handling and select the
  newest compatible bundle within the installed firmware line and stage.
- Binary OTA: reuse the existing transfer/partition machinery where compatible;
  validate candidate metadata/format before flashing. Preserve watchdog, progress,
  inactive-partition checks, reboot verification, and failure recovery.
- CI/publication: emit normalized identity and actual target matrix from one
  preparation result; only sanitize artifact keys. Keep once-per-release tasks
  independent of ESP8266 and require completed qualified artifact sets. Diagnostics
  must resolve the exact firmware/target ELF rather than guessing from branch names.

## Next-Generation Web Frontend

Prefer shared frontend code and selectively activated functionality, with justified
line-specific differences where useful. Maintained webapp feeds follow firmware
line and stage; this does not imply a breaking API difference or require separate
configuration ecosystems. A minimum API contract, currently shared, determines
functional compatibility rather than a mandatory bridge/qualification mechanism.

- New virtual-light/pin/button views are enabled only by advertised capabilities.
  Also gate store initialization, subscriptions, routes, and outbound commands:
  hiding controls alone must not trigger unsupported API calls or schema writes.
- ESP8266 and older firmware retain the single-light experience. Absence of a
  capability means unsupported; infer legacy capabilities only through verified
  fixtures/version mappings, not merely SoC or a guessed version threshold.
- Webapp updates stay within the installed firmware line and stage, without a
  separate selector. Compatible manual firmware upgrades remain possible.
- Investigate ConfigDB schema compatibility before allowing cross-line downgrades;
  keep this review separate from forward upgrade eligibility.
- Treat equal nominal flash capacity as a constraint, not extra headroom on ESP32.
  Measure the actual filesystem partition budget, free bytes, file count/metadata,
  and the installer's staging/replacement behavior on both targets. Preserve room
  for configuration and safe failed/retried updates; define a numeric reserve from
  measured worst cases before approving a package.
- Hidden features still occupy flash. Lazy imports improve initial network/browser
  cost but do not save flash when their chunks are installed. Gate CI on the total
  installed asset set, not just compressed archive or initial JavaScript size.
- If a shared bundle cannot fit safely, first reduce/package assets, then consider
  legacy and full asset variants from the same source and shared contracts. Server
  selection must use compatibility and measured device budget, not SoC alone.
  Remotely hosted next-generation assets are an explicit alternative with offline/
  caching/version-pinning requirements, not a silent fallback during OTA failure.

## Implementation Order and M1 Gates

1. Freeze DTOs, identity/stage mapping, version ordering, and compatibility policy.
   Capture fixtures from deployed server/controllers and back up current catalogue.
2. Add additive DB migration, upload validation, v2 discovery/options, and legacy
   projections. Test in staging and shadow-compare old results; do not cut over refs.
3. Add structured discovery metadata and compatible frontend/HA/updater clients.
   Qualify both naming schemes and the existing binary/webapp installation paths.
4. Enforce the four-file runtime payload. Detailed installed/staging reserve
  measurement and recovery qualification are deferred by the close-out decision.
5. Exercise the complete staged chain with representative artifacts for both lines,
   then perform M2's branch/dependency/CI cutover. Enable publishing/migration only
   after the production compatibility adapters and clients are ready.

M1 acceptance covers API option filtering, `5.9` versus `5.10`, prerelease/final
ordering, legacy aliases, old saved preferences, future release-line discovery,
no cross-line automatic updates, ESP8266 rejection of 5.1, and per-device fleet
resolution. Test incomplete publication, changed checksums, absent capabilities,
no-match/error/offline behavior and obsolete cached selections. Single-device OTA
is user-confirmed complete; fleet testing remains pending. Insufficient flash,
interrupted installs and recovery qualification are deferred, not marked passed.
CI and log lookup must retain consistent identity through every step.

M1 is complete only with evidence for the full chain, not because selectors render
or a matrix builds. Existing production feeds remain available until deployed
consumers are verified. Local implementation and unit tests do not constitute
production migration or hardware qualification; those gates remain open.
