## Plan: Hybrid Webapp Delivery for ESP8266

Adopt a hybrid delivery model: provision a full baseline webapp into `lfs0` during initial flashing, then keep webapp freshness through OTA-era background updates after reboot into new firmware. Avoid partition-level filesystem rewrites during OTA to preserve config and runtime state.

**Steps**

1. Phase 1 - Define runtime source-of-truth for web assets.
   Reuse `version.json` and extend it with a `webapp` array. Firmware and webapp versions do not need 1:1 mapping, but both must expose compatibility constraints:

- `webapp.min_firmware`
- `firmware.min_webapp`
  CI publish must fail if compatibility windows do not overlap.

2. Add a single webapp state object in firmware config/state with fields: active source (lfs), installed version/hash, and last check status. _blocks steps 3-8_
   Add a `webapp` block to `app-config.cfgdb` and persist at least:

- `active_source` (`lfs_current`, `lfs_previous`)
- `installed_version`  ← **required**: the API returns `version` strings; the device must compare this against the persisted value to avoid re-flashing an already-current webapp. Branch is embedded in the version string (last dash-segment) so no separate field is needed.
- `installed_md5`
- `last_check_status`
  Keep hash even when version exists; version alone is not a sufficient freshness/integrity signal.

3. Reuse existing file serving chain in [app/webserver.cpp](app/webserver.cpp#L450) to formalize precedence: valid active LFS webapp -> previous valid LFS webapp -> maintenance page fallback. Keep captive-portal redirect semantics unchanged. _depends on 2_
   Minimal change expected, but add a validity gate before preferring an LFS candidate (complete install marker + manifest/hash match).
4. Provisioning strategy: write a full baseline webapp filesystem image into `lfs0` only during initial flash/factory provisioning. _depends on 2_
   Do not use filesystem image writes for OTA updates. For field servicing, support two flash modes:

- `factory_flash`: writes `lfs0` baseline image
- `preserve_config_flash`: skips `lfs*` rewrite and only updates firmware image

  Keep storage namespaces separated:

- web UI files under `/www/*`
- config/state under `/cfg/*`

5. Phase 2 - Background acquisition and validation.
6. Implement post-OTA/background webapp fetch workflow after network-ready startup (non-blocking): after reboot into new firmware, schedule refresh check. Wire trigger from startup flow in [app/application.cpp](app/application.cpp#L356) and service start in [app/application.cpp](app/application.cpp#L640). _depends on 3, parallel with 7_
7. Add MD5 integrity verification for downloaded payloads (selected decision) and persist verified hash/version in config DB using existing update/save patterns in [app/application.cpp](app/application.cpp#L430) and OTA persistence style in [app/otaupdate.cpp](app/otaupdate.cpp#L1100). _depends on 2, parallel with 6_
8. Store downloaded assets into `staging` in LittleFS, validate full bundle, then activate with a single pointer/marker switch (not multi-file in-place overwrite). Keep previous known-good LFS version for rollback. _depends on 6,7_
9. Phase 3 - Manifest and freshness policy.
10. Extend deployment manifest format (currently produced in [deploy_release_ghpages.sh](deploy_release_ghpages.sh#L53)) to include webapp version + MD5 + asset list/URL bundle metadata. _depends on 2_
11. On boot/service start, compare installed LFS hash/version with upstream manifest metadata. If unchanged, use LFS immediately; if changed, continue serving existing valid LFS (or embedded if none) while refreshing in background. _depends on 8,10_
12. Add policy guardrails: retry backoff, max fetch duration, and failure markers so repeated failures do not degrade boot responsiveness. _depends on 11_
13. Phase 4 - Build and CI integration.
    Webapp artifacts must be uploaded to lightinator.de similarly to firmware artifacts. Extend `deploy_release_ghpages.sh` to publish webapp bundle + metadata in one manifest update. Revisit `version.json` lifecycle to support two independently versioned deliverables.
14. Update firmware/webapp handoff in CI so initial provisioning artifacts include baseline `lfs0` webapp image for factory flashing, while OTA pipelines publish downloadable webapp bundles/metadata only. Keep existing branch mapping behavior in workflows. _depends on 4,10_
15. Add explicit CI assertions for esp8266 debug ROM headroom (fail with actionable message if threshold crossed), and compatibility assertions between firmware and webapp manifest entries. _depends on 14_
16. Phase 5 - Rollout and hardening.
17. Gate rollout behind config flag (e.g., hybrid webapp enabled) for staged enablement by branch/profile. _depends on 12,14_
18. Validate downgrade/rollback behavior: missing/corrupt LFS, interrupted download, and manifest unavailable; ensure deterministic fallback to embedded bootstrap. _depends on 17_

**Version API**

The version catalogue is served by `version_api.py` on `https://lightinator.de/api/`.
All filter axes are optional query parameters; omitting an axis returns all values on that axis.

Firmware discovery of a compatible webapp:

```
// 1. Extract branch from own version string (last dash-segment)
//    e.g. "V5.0-599-testing" → branch = "testing"

// 2. Ask for the latest compatible webapp on the same branch
GET /api/webapp/latest?branch={firmware_branch}&firmware_version={firmware_version}

// 3. If 404 (no webapp published for this branch yet), fall back to "experimental"
GET /api/webapp/latest?branch=experimental&firmware_version={firmware_version}

// 4. If still 404 → no update available

// 5. Compare response.version against persisted installed_version
//    If newer → download response.files, verify MD5s, activate
```

The `firmware_version` parameter enforces `min_firmware` server-side; the device
does not need to implement that logic. The device **must** persist its installed
webapp version (see step 2 below) so it can skip re-flashing an already-current version.

Other useful endpoints:

```
GET /api/firmware/socs                         // ["esp32", "esp32c3", "esp8266"]
GET /api/firmware/branches?soc=esp32           // ["crash-reporting", "develop", "experimental", "testing"]
GET /api/firmware/types?soc=esp32&branch=testing
GET /api/firmware/latest?soc=esp32&branch=testing&type=release   // single object
GET /api/firmware/latest?soc=esp32&type=debug  // array — one latest per branch
GET /api/webapp/branches
GET /api/webapp/versions?branch=experimental&firmware_version=V5.0-599-testing
```

**Webapp Version JSON Structure**

Use the following structure for each webapp entry in `version.json`:

{
"version": "5.2.0",
"type":"debug", // either "debug", "release", release shall omit most console logs and dev tools
"branch" : "experimental", // firmware and webapp branch must match
"min_firmware": "5.2.0",
  "files": [
    {
    "path": "assets/index-D9Bjyxvm.js.gz",
    "md5": "8f14e45fceea167a5a36dedd4bea2543"
    },
    {
    "path": "assets/index-BlL0XVrq.css.gz",
    "md5": "c9f0f895fb98ab9159f51fd0297e236d"
    },
    {
    "path": "index.html.gz",
    "md5": "45c48cce2e2d7fbdea1afc51c7c6ad26"
    }
  ]
}

Notes:

- `version` is the published webapp version string.
- `files` contains all downloadable files that make up this version.
- `md5` is the required integrity hash for each file and is validated before if we activation.

**Relevant files**

- /home/pjakobs/devel/esp_rgbww_firmware/app/webserver.cpp - Reuse onFile() lookup order and fallback behavior.
- /home/pjakobs/devel/esp_rgbww_firmware/app/application.cpp - Hook startup trigger points for non-blocking fetch and persisted state load.
- /home/pjakobs/devel/esp_rgbww_firmware/app/otaupdate.cpp - Reuse download/persistence/watchdog patterns for robust transfers.
- /home/pjakobs/devel/esp_rgbww_firmware/component.mk - Controls webapp version embedding and build-time integration.
- /home/pjakobs/devel/esp_rgbww_firmware/include/fileList.h - Generated embedded asset list to shrink to bootstrap-only set.
- /home/pjakobs/devel/esp_rgbww_firmware/app/fileMap.cpp - Embedded flash-string map generation output.
- /home/pjakobs/devel/esp_rgbww_firmware/deploy_release_ghpages.sh - Manifest generation to extend with webapp hash metadata.
- /home/pjakobs/devel/esp_rgb_webapp2/.github/workflows/deploy.yml - Source webapp distribution job and artifact publishing behavior.

**Verification**

1. CI size gate: run esp8266 debug build and confirm rom0.bin <= 0xFE000 with minimum headroom threshold check.
2. Factory flash test: baseline `lfs0` image contains full webapp and serves immediately on first boot without network.
3. Preserve-config flash test: flashing firmware without rewriting `lfs*` keeps existing configdb and existing webapp untouched.
4. Freshness test: unchanged upstream hash results in no download and immediate LFS serve.
5. Update test: changed upstream hash after OTA reboot triggers background refresh without blocking UI.
6. Resilience test: power interruption during download leaves system bootable and serving previous known-good LFS webapp.
7. Corruption test: tampered payload (MD5 mismatch) is rejected and does not replace valid LFS content.
8. Regression test: captive portal/AP mode behavior in onFile() remains unchanged.

**Decisions**

- Integrity algorithm: MD5 (chosen).
- First-boot behavior: serve full baseline webapp from provisioned `lfs0` image.
- OTA behavior: after reboot into new firmware, check manifest and refresh webapp in background if needed.
- Scope included: firmware web serving/fetch policy, manifest extensions, CI size gating, rollback/fallback behavior.
- Scope excluded: dedicated lightweight webapp variant.

**Further Considerations**

1. Packaging choice for download payload: Option A per-file download (simpler resume/fallback), Option B single archive bundle (smaller overhead), Option C dual strategy (archive preferred, per-file fallback).
2. Freshness authority: Option A manifest MD5 only, Option B MD5 + semantic version compatibility window, Option C branch-pinned hash channel.
3. Activation policy: Option A activate new LFS files immediately after full validation, Option B activate on next reboot for maximum safety.

---

