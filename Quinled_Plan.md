# QuinLED Hardware and Named Pin Assignment Plan

Status: proposed, planning only. No runtime configuration changes in this document.
Updated: 2026-11-05. The storage proposal below refines M3/M4, not their
implementation status or the current M1 execution scope.

Cross-project delivery order and release-stage implementation are tracked in
[MASTER_PLAN.md](MASTER_PLAN.md). This document owns the detailed hardware plan.

## Goal and Scope

Support QuinLED board pin names independently of their assigned light functions.
Expose L1-L5 on five-output boards and L1-L15 on the An-Penta-Deca, plus
three common button inputs and an I2C bus. Preserve board-specific extras.
Use the same model for future ESP32 and ESP32-C3 boards and integrate it with
the planned multichannel/multiple-light work, rather than treating every output
as a fixed RGBWW role or every board as one light.

This work belongs to the 5.1.z multiple-light line, supporting ESP32 and ESP32-C3
only. Available board pins must be independent of their use within a virtual
light, beyond the transitional fixed mapping in the current catalogue. Both
Webapp2 and Home Assistant need to create virtual lights and assign pins to them.

Initial scope is analog PWM lighting, configurable button actions, I2C pin
reservation, and the configuration/API foundations. I2C peripherals and
addressable LED libraries need investigation before implementation planning.
Ethernet enablement and individual peripheral drivers remain follow-up features.

## Prerequisite: Versioned Release Lines

First align branch structure, CI, and distribution with the multiple-light work
in firmware [branches.md](../esp_rgbww_firmware/branches.md#L7). Use
`<major>.<minor>/<stage>` branches in firmware and webapp repositories.

- Keep `5.0/develop` and its testing/production stages as the legacy feature line.
  ESP8266 remains on this limited single-light line; preserve compatibility for
  existing ESP32/C3 firmware too. 5.0 builds for all three SoCs for now and pins
  RGBWWLed `0.10.1`.
- Move experimental multiple-light development to 5.1.z, with ESP32/C3-only
  builds and RGBWWLed `0.11.0`. Map `experimental` to `5.1/develop`;
  `5.1/experimental` is not a separate stage.
- Adapt firmware and webapp CI triggers, dispatch choices, version/tag derivation,
  artifact paths, schema dispatch, and promotion handling. Replace ESP8266-only
  guards for once-per-release jobs, since 5.1 has no ESP8266 build.
- Adapt the software distribution API and metadata to versioned lines, stages,
  supported SoCs, and API capabilities, retaining legacy aliases during migration.
  Reject ESP8266 targets on 5.1.
- Audit firmware, webapp, and Home Assistant update consumers. SoC filtering
  alone cannot distinguish compatible 5.0 and 5.1 ESP32 builds. Verify release-line
  selection, API compatibility, and legacy fallback before deciding which updater
  mechanisms need changes.

## Sources and Verified Pinouts

Official guides, checked 2026-11-03:

- [An-Penta-Mini](https://quinled.info/quinled-an-penta-mini-pinout-guide/)
- [An-Penta-Deca](https://quinled.info/quinled-an-penta-deca-pinout-guide/)
- [An-Penta-Plus](https://quinled.info/quinled-an-penta-plus-pinout-guide/)

Values below are GPIO numbers, not connector positions. The Deca guide calls
its outputs LED_1 through LED_15; normalize these to L1-L15 internally while
retaining the printed/vendor names as aliases. Bind each profile to a confirmed
board/MCU variant and revision; do not infer board identity from SoC alone.

| Board pin | Mini (ESP32-C3) | Deca (ESP32) | Plus (ESP32) |
| --------- | --------------- | ------------ | ------------ |
| L1        | 5               | 27           | 33           |
| L2        | 4               | 26           | 32           |
| L3        | 1               | 25           | 12           |
| L4        | 0               | 23           | 4            |
| L5        | 3               | 22           | 2            |
| L6        | -               | 21           | -            |
| L7        | -               | 19           | -            |
| L8        | -               | 18           | -            |
| L9        | -               | 17           | -            |
| L10       | -               | 14           | -            |
| L11       | -               | 13           | -            |
| L12       | -               | 12           | -            |
| L13       | -               | 5            | -            |
| L14       | -               | 4            | -            |
| L15       | -               | 2            | -            |
| Button_1  | 2               | 36           | 36           |
| Button_2  | 8               | 39           | 39           |
| Button_3  | 9               | 34           | 34           |
| Button_4  | -               | 33           | -            |
| I2C SDA   | 6               | 15           | 15           |
| I2C SCL   | 7               | 16           | 16           |

The three common button inputs are documented as pulled high with hardware
debounce. Mini Button_3 can force bootloader mode when held to GND. The Deca
guide additionally lists Button_4/GPIO33 without the same descriptive guarantees;
verify its electrical behavior before enabling it as a normal button.

Default color suggestions, not mandatory output roles:

- Mini/Plus: L1=CW, L2=WW, L3=B, L4=G, L5=R.
- Deca: L1 to L5 are R, G, B, WW, CW. rest is uncommitted

These are wiring templates, not proof of PWM allocation feasibility. With the
current Esp32HardwarePwm constraint, channels belonging to one backend light
must stay within one timer block. Fully using Deca's 15 outputs as three RGBWW
lights requires one logical light to span two timer blocks. Plan to represent
that light internally as an RGB group and a tunable-white group tied together
by RGBWWLed. Validate allocation and coordinated updates before enabling this
template; expose one virtual light to users, not two artificial lights.

Plus also has digital LED relay GPIO13 and data GPIO5. Its Ethernet guide
specifies LAN8720, MDC GPIO23, MDIO GPIO18, and clock GPIO17_OUT. Reserve all
pins used by the selected Ethernet implementation, including implicit RMII pins,
before allowing assignments. Do not expose these resources as spare analog outputs.

### I2C Peripheral and Addressable LED Investigations

- Investigate the documented I2C Stemma QT/Qwiic connector for a small OLED status
  display, environmental or light sensors, and other peripherals such as input
  expanders. Assess voltage/power limits, bus addresses, pull-ups, driver support,
  memory use, and scheduling impact before selecting features. Share one reserved
  bus among supported devices rather than assigning SDA/SCL to individual lights.
- Explore proven addressable LED libraries for digital controllers and the Plus
  data/relay resources before writing a digital-light implementation plan. Check
  Sming and ESP32/C3 support, timing/peripheral ownership, coexistence with analog
  PWM, supported strips, and relay startup/shutdown safety. Record a feasibility
  result and library recommendation; digital support is not committed by this plan.

## Current Gaps

- [public/config/pinconfig.json](public/config/pinconfig.json) mixes physical
  names (`LED1` etc.) with logical roles (`red`, `warmwhite`, etc.) in `channels`.
  The Deca and transitional profiles both have incorrect L13/L14 mappings
  (15/14 instead of 5/4), including duplicate GPIO14.
- The existing `QuinLED An-Penta` five-output profile matches Mini GPIO order,
  but assigns red to L1 and coldwhite to L5, opposite the guide's suggested
  color order. Confirm the intended board identity and installed wiring rather
  than silently reversing existing installations. There is no explicit Plus profile.
- Global `available_pins` lists are not board inventories or per-function
  capability descriptions. They omit some documented QuinLED inputs/outputs;
  simply adding every GPIO to every selector would be unsafe.
- [src/components/Dialogs/pinConfigDialog.vue](src/components/Dialogs/pinConfigDialog.vue)
  defaults to five color roles, requires RGB, and offers the same pin pool for
  outputs and the clear pin. It cannot represent white-only or multiple lights.
- [src/components/cards/ControllerConfigCard.vue](src/components/cards/ControllerConfigCard.vue)
  selects profiles by SoC and display name, merges remote profiles ahead of
  matching local names, and displays raw GPIO choices. Profile updates could
  therefore replace local customizations without an explicit migration.
- Firmware [app/ledctrl.cpp](../esp_rgbww_firmware/app/ledctrl.cpp#L60)
  loads recognized color names into one fixed RGBWW pin structure. Renaming
  those channels to L1-L15 alone will not make the firmware drive them.

## Proposed Configuration Model

Separate three concepts:

1. **Board profile:** stable board ID, revision, SoC, profile version, source URLs,
   and physical resources. Each pin has a stable ID, display name, GPIO, aliases,
   electrical capabilities, restrictions, and reserved/default use. Light-output
   terminals remain PWM outputs; naming flexibility does not make them general I/O.
2. **Virtual light definition:** stable light ID, type (single-channel dimmer,
   tunable white, RGB, RGBW, RGBWW), and the logical functions required by that
   type. Internal PWM groups need not match its public light identity.
3. **Assignment:** bind each light function to a board pin ID, resolving to a
   GPIO only after board and capability validation. Store button bindings and
   I2C bus configuration separately, sharing the same resource ownership rules.

Illustrative new-format fragment, not a payload accepted by current firmware:

```json
{
  "schema_version": 2,
  "board_id": "quinled-an-penta-deca",
  "board_profile_version": 1,
  "lights": [
    {
      "id": "strip_1",
      "type": "rgbww",
      "outputs": {
        "red": "L1",
        "green": "L2",
        "blue": "L3",
        "warmwhite": "L4",
        "coldwhite": "L5"
      }
    },
    {
      "id": "worktop",
      "type": "tunable_white",
      "outputs": { "warmwhite": "L6", "coldwhite": "L7" }
    }
  ]
}
```

Any unassigned output remains inactive. Offer three RGBWW lights on Deca as a
template only after the split timer-block arrangement is qualified, not as a
required grouping. Users can mix supported light types up to the available
outputs and actual PWM backend limits. Each physical GPIO has one owner; the
I2C bus may serve multiple addressed devices through that one owner.

### Shared Catalogue and Legacy Compatibility

The advanced app-config schema belongs exclusively to the 5.1 codebase. Do not
backport its schema, parser, resource model or virtual-light configuration to 5.0.
Keep one capability-aware client ecosystem, but distinct versioned storage
contracts: 5.0 continues using the normal `pinconfig.json` and existing ConfigDB
schema. QuinLED entries there are simple fixed single-light RGBWW configurations.
Keep existing URLs and embedded `config/pinconfig.json` legacy-shaped; publish
the advanced catalogue at a separate explicit path.

5.1 may optionally retain or expose a compatible 5.0 representation. This is a
5.1-side compatibility decision, not a requirement for 5.0 to consume advanced
catalogues or projected virtual-light configurations. Generating legacy presets
from shared pinout data is optional tooling, not a runtime dependency. Select
client behavior by supported API capabilities, not SoC alone. Never rewrite
installed 5.0 configurations into the advanced schema.

## Storage and API Contract Proposal (2026-11-05)

### Evidence and Implementation Boundary

The master plan assigns runtime/resource allocation to M3, assignment editors to
M4, and button actions/I2C activation to M5. This document already had board tables
and a conceptual model; neither those nor M1 work establish multilight support.
Inspection of the current workspace checkout found:

- [public/config/pinconfig.json](public/config/pinconfig.json) is revision 25,
  without a schema version. GPIOs mix integers and strings; disabled clear pins
  use an empty string. ESP32/C3 global lists omit documented board resources.
- [ControllerConfigCard.vue](src/components/cards/ControllerConfigCard.vue)
  fetches remote profiles, matches by name, and lets remote entries replace local
  entries. It copies catalogue data into device storage and writes
  `general.channels`, but the inspected boot loader reads the selected
  `hardware.pinconfigs[].channels` instead.
- [pinConfigDialog.vue](src/components/Dialogs/pinConfigDialog.vue) uses
  `clearPin`, while the catalogue/schema use `clear_pin`. Its original-value
  handling also treats GPIO0 as falsy. Normalize these explicitly.
- [application.cpp](../esp_rgbww_firmware/app/application.cpp) imports a newer
  embedded catalogue into ConfigDB on startup. Reset setup reads `clear_pin`
  from the selected hardware profile, not `general`. Store mutation alone is
  not proof that wiring survives reboot.
- [ledctrl.cpp](../esp_rgbww_firmware/app/ledctrl.cpp) resolves five recognized
  color names into one `PinConfig`; `isPinValid()` checks only a SoC list.
  [ledctrl.h](../esp_rgbww_firmware/include/ledctrl.h) derives `APPLedCtrl` from
  one RGBWWLed instance. This is not a virtual-light registry.
- [app-config.cfgdb](../esp_rgbww_firmware/app-config.cfgdb) owns typed hardware
  profiles. Do not edit generated outputs. Recheck the target 5.0/5.1 worktrees
  before implementation: this is checkout evidence, not a claim about all refs
  or deployed devices.

Design boundary: named inventory and virtual-light assignments change only 5.1.
The discriminating legacy check is an ordinary QuinLED RGBWW preset loaded through
the unchanged 5.0 ConfigDB path, rebooted and verified by its LED/reset loaders.
It must work without the advanced catalogue or any new schema/parser support.

### Four Configuration Layers (5.1 Only)

The advanced schema separates four layers:

| Layer | Scope | Purpose |
| ----- | ----- | ------- |
| `available_pins` | SoC | GPIO capabilities and restrictions: input/output, PWM, strapping, input-only and reserved uses |
| `implemented_pins` | Board/module type and revision | Physically exposed/wired GPIOs, including lighting outputs, SDA, SCL and buttons; terminal IDs, labels and board-specific restrictions |
| `templates` | Board type | Built-in offline starting assignments, optionally supplemented by downloaded templates |
| `configuration` | Individual device | Selected board, stable light IDs, light types, actual assignments and system/peripheral uses |

Board restrictions narrow SoC capabilities; they cannot grant missing capabilities.
Templates never overwrite active configuration. The existing 5.0 field named
`available_pins` remains its plain GPIO list, not this richer capability model.
Package the four layers in these versioned objects:

1. **Catalogue:** `schema_version` describes syntax; `version` remains the
   monotonically increasing catalogue revision. `boards` contains inventories;
   `templates` contains optional assignment suggestions, not wiring facts.
2. **Board profile:** stable `id`, immutable `revision`, SoC/module variant,
    sources, physical `implemented_pins`, and peripheral reservation groups. Pins have IDs,
   integer GPIOs, labels/aliases, allowed functions and electrical/boot constraints.
   A profile revision must not silently change GPIO meaning.
3. **Active configuration:** its own schema/configuration revisions, selected
  board snapshot, `lights`, `system`, `buttons` and `buses`. Persist the selected
  board's operational inventory and actual assignments, not a copy of the full
  remote catalogue. Built-in templates remain available separately from this
  active snapshot. Both initial setup and subsequent boot must work offline.

### Built-In Templates and Offline Setup

In the 5.1 `app-config.cfgdb`, define `hardware.templates` with a bounded set of
built-in schema defaults, analogous to the existing pinconfig catalogue mechanism.
The firmware image must supply these defaults without GitHub, an upstream network,
or a previously installed webapp cache. Template choice remains optional; template
availability at first installation is required. Do not put hardware templates in
`app-data.cfgdb` alongside user color presets/scenes.

Each template has a stable ID/revision, compatible board ID/revision, light types
and function-to-implemented-pin assignments. Ship the corresponding SoC capability
and board inventories with the firmware as well; built-in templates cannot depend
on downloading the definitions needed to resolve or validate them. Offer only
templates supported by the actual build's qualified PWM/resource limits.

The client reads built-in templates from the device for offline first-run setup.
Downloaded catalogues may supplement them after validation, but are never a
prerequisite. Applying a template copies its settings into
`hardware.configuration`, creating stable device light IDs; later catalogue or
template updates do not alter active wiring. Keep built-in defaults recoverable
after factory reset and test generator/default loading on a blank filesystem.
Verify ConfigDB's generated array defaults and memory/storage cost during
implementation rather than assuming schema defaults alone populate the runtime.

Proposed schema homes are `schema/pinconfig-v2.schema.json` in the webapp and a
reusable hardware-assignment definition in firmware ConfigDB schema sources.
These are implementation deliverables, not existing files. Use JSON Schema for
shape and semantic validation for ownership/hardware constraints. Catalogue,
active-config and API-contract versions are independent.

Illustrative catalogue fragment (one output plus SDA/SCL and buttons; the remaining
lighting outputs are omitted, so this is not a complete board profile):

```json
{
  "schema_version": 2,
  "version": 26,
  "boards": [
    {
      "id": "quinled-an-penta-mini",
      "revision": 1,
      "soc": "esp32c3",
      "qualification": "pending",
      "implemented_pins": [
        {
          "id": "L1",
          "gpio": 5,
          "label": "L1",
          "aliases": ["LED_1"],
          "allowed_functions": ["light.pwm"],
          "restrictions": []
        },
        {
          "id": "I2C_SDA",
          "gpio": 6,
          "label": "I2C SDA",
          "allowed_functions": ["i2c.sda"]
        },
        {
          "id": "I2C_SCL",
          "gpio": 7,
          "label": "I2C SCL",
          "allowed_functions": ["i2c.scl"]
        },
        {
          "id": "Button_1",
          "gpio": 2,
          "label": "Button 1",
          "allowed_functions": ["button.input", "system.clear_config"],
          "active_low": true,
          "external_pull": "up",
          "hardware_debounce": true,
          "restrictions": ["strapping"]
        },
        {
          "id": "Button_2",
          "gpio": 8,
          "label": "Button 2",
          "allowed_functions": ["button.input", "system.clear_config"],
          "active_low": true,
          "external_pull": "up",
          "hardware_debounce": true,
          "restrictions": ["strapping"]
        },
        {
          "id": "Button_3",
          "gpio": 9,
          "label": "Button 3",
          "allowed_functions": ["button.input", "system.clear_config"],
          "active_low": true,
          "external_pull": "up",
          "hardware_debounce": true,
          "restrictions": ["strapping", "low_at_boot_enters_bootloader"]
        }
      ]
    }
  ],
  "templates": []
}
```

SDA, SCL and every physical button belong in `implemented_pins`, not solely in
templates or action settings. These entries are mandatory board knowledge in
5.1 even before bus drivers/button actions are enabled. Persist their operational
GPIO mappings, electrical properties and restrictions in the selected-board
snapshot. Enumerating `system.clear_config` as eligible does not assign that
destructive function; it requires explicit configuration and ownership checks.

Full profiles declare all outputs and board-specific extras from the verified
table above. A generic/custom board declares verified exposed pins
for its actual module, never every pin of an SoC. Legacy `available_pins` is not
the v2 authority. Physical availability and legal use differ: an output MOSFET
terminal cannot become a button merely because the GPIO supports input mode.

Illustrative active assignment fragment for a confirmed Mini profile:

```json
{
  "schema_version": 2,
  "revision": 1,
  "board": { "id": "quinled-an-penta-mini", "revision": 1 },
  "lights": [
    {
      "id": "light0",
      "name": "Main",
      "type": "rgbww",
      "outputs": {
        "red": "L5",
        "green": "L4",
        "blue": "L3",
        "warmwhite": "L2",
        "coldwhite": "L1"
      }
    }
  ],
  "system": { "clear_config_pin": null },
  "buttons": [
    { "id": "button0", "pin": "Button_1", "enabled": false }
  ],
  "buses": [
    {
      "id": "i2c0",
      "type": "i2c",
      "sda": "I2C_SDA",
      "scl": "I2C_SCL",
      "enabled": false
    }
  ]
}
```

The selected board snapshot accompanies this assignment in persistence; omitted
here for readability. `light0` is an immutable ID, not an array index. Renaming
or deleting another light must not change it. Display `Light0 / R` or a friendly
name; persist light ID and canonical role separately, not a combined string.
Derive the inverse per-pin view from `lights[].outputs`; do not store a second
writable assignment list.

Bus configuration references the implemented SDA/SCL pin IDs as a pair; enabled
I2C requires both roles, distinct GPIOs, and one shared bus owner. Button
configuration references implemented input IDs and later adds supported actions.
Unused buttons can remain unconfigured; their physical inventory is still known.
Disabled entries above describe intended settings but do not initialize drivers.
Validate SDA/SCL and button bindings against the same ownership rules as lights
and clear/reset, retaining board-imposed reservations even while disabled.

Canonical roles are `red`, `green`, `blue`, `warmwhite`, `coldwhite`;
R/G/B/WW/CW are labels. Define `rgbww` as RGB plus both whites (legacy UI calls
this RGBWWCW). Other types are `dimmer`, `tunable_white`, `rgb`, `rgbw`; agree the
dimmer `brightness` role and RGBW white-role selection in one shared required-role
table. Missing outputs are absent, not GPIO0 or an empty string. `null` disables
optional system functions; translate to legacy `-1` only at the legacy boundary.

`system.clear_config_pin` references an eligible pin ID. It is not hardware
EN/reset or an ordinary button action. Preserve recovery semantics when importing
legacy wiring. Do not assign destructive clear behavior to QuinLED buttons by
default. Represent button inputs/bus reservations now, but activate actions/drivers
only with M5 capabilities. Keep dedicated peripheral terminals unavailable for
incompatible uses even when disabled.

### Unchanged 5.0 Contract and Optional 5.1 Compatibility

5.0 uses the normal `pinconfig.json`: `available_pins` remains a SoC GPIO list;
`pinconfigs` contains existing-style profiles with `name`, `soc`, `model`,
`clear_pin` and fixed color/GPIO `channels`. QuinLED profiles expose one RGBWW
light, not named-resource assignments or multiple virtual lights. Deca presets
may select an explicit group of five outputs; other outputs remain unused.

- Both old and new clients connected to 5.0 use this existing contract. No v2
  parsing, assignment projection or schema migration is required on that device.
- Preserve existing profile names and installed mappings, including reversed
  Mini colors. Offer corrected/new presets explicitly without silently rewiring
  active configurations or overwriting custom profiles.
- Do not add every board GPIO to the legacy output list: input-only pins must
  not become selectable PWM outputs. Verify simple presets against existing
  GPIO validation and reset semantics before publication.
- The advanced schema must not replace the catalogue at a legacy URL/embedded
  path. A 5.0 boot/configuration flow must not depend on v2 availability.

Optionally, 5.1 may preserve a legacy-shaped representation or compatibility API
for a designated supported single light. Decide and test its semantics in 5.1;
never implicitly flatten several lights. Any explicit export or firmware downgrade
requires a separate backed-up migration with loss-of-function warnings. Neither
this optional compatibility view nor advanced schema parsing is backported to 5.0.

### Firmware API and Runtime Changes

Propose capability keys `hardware.assignments.v2`, `hardware.named_pins`,
`lights.multiple`, `buttons.actions` and `buses.i2c`; agree final names in the API
contract. Report real light/PWM limits, supported types, schema versions and
reservations. Missing capability means legacy behavior even on ESP32/C3, without
requiring a capability backport to 5.0.

Add whole-configuration validate/apply operations through the existing API/schema
workflow. Requests carry expected configuration revision, selected board snapshot
and assignments. Firmware-owned GPIO/peripheral restrictions remain authoritative:
client metadata cannot grant access to flash, USB, Ethernet or input-only pins.
Return field-scoped errors, resolved GPIOs and resource allocation. Agree route/RPC
names against the actual 5.1 API rather than assuming a second transport.

Reject duplicate GPIO ownership across aliases, duplicate light IDs, missing
roles, unknown pins, stale revisions, unsupported functions and PWM exhaustion.
Plan allocation before commit; validate and apply the same normalized object.
Do not assume generic chunked ConfigDB writes are atomic across these fields.
Initially persist/reboot as one validated operation; keep outputs safe and retain
the last known good snapshot after interrupted writes or initialization failure.

Replace the singleton assumption with a bounded stable-ID registry, one RGBWWLed
instance per virtual light, and shared pin/PWM allocation. Keep state, calibration
and transitions per light; direct old single-light APIs to an explicit primary
light. Backend split groups remain one public light. Timer-block proposals above
are qualification hypotheses, not a guarantee of fifteen usable outputs.
Inspect pinned RGBWWLed 0.11.0 and Esp32HardwarePwm allocation/timer sharing and
callback teardown before advertising limits. GPIO count is not backend capacity.

### Implementation Slices and Gates

| Slice                | Owning changes                                                                                               | Gate before proceeding                                                                                  |
| -------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| 1: Contract/fixtures | 5.1 catalogue/configuration schemas, built-in hardware.templates defaults and normalizer; shared role/capability definitions | Official board tables; four-layer validation; blank-filesystem offline template setup/reset; no advanced schema changes in 5.0 |
| 2: Legacy presets | Normal pinconfig.json QuinLED RGBWW entries; existing client path | Unchanged 5.0 schema/parser; custom wiring preserved; boot/reset readback without v2 |
| 3: M3 runtime/API    | ConfigDB sources, board resolver, light registry, allocator and validated transaction; regenerate API/schema | Host ownership/migration/failure tests; ESP32/C3 builds; measured PWM limits; no ESP8266 5.1            |
| 4: M4 clients        | Shared assignment service; controller editor, first-run flow and HA configuration/entities                   | Mixed-version tests; no v2 writes to 5.0; stable IDs; remote-update previews                            |
| 5: M5 activation     | Button/system actions and I2C through common resource validation                                             | Conflict, recovery, event and concurrent peripheral/PWM hardware tests                                  |

5.1 webapp editors and first-run setup consume one normalizer/resolver service
instead of duplicating fetching/mapping. Keep catalogue cache separate
from active config, key by stable board ID/revision, and make revision adoption
explicit. Do not copy the full catalogue to each controller. Update
[configDataStore.js](src/stores/configDataStore.js) and
[api.js](src/services/api.js) for negotiated payloads, acknowledgement and validated
transactions as needed. Home Assistant uses the same firmware contract; extend
[firmware_api.py](../Lightinator_HA_module/custom_components/esp_rgbww/firmware_api.py),
flows, coordinator and entity identities, not an independent GPIO authority.

Qualification matrix: old/new clients against unchanged 5.0 and capable
5.1; embedded/remote/offline catalogues; all 5.0 SoCs and both 5.1 SoCs. Include
numeric strings, GPIO0, null/empty/-1 reset values, duplicate Deca pins, mixed light
types, rename, customization, unknown schema, stale revision, malformed/oversize
input, reset conflicts, power loss and failed-apply rollback. Verify per-light
commands/state/presets/MQTT/HA IDs and timer allocation with concurrent transitions,
not only configuration save. Physical revision and heap/PWM qualification remain
required, not implied by these examples.

## Necessary Changes

### Board Catalogue and Validation

- Extend the pin catalogue format with versioned board profiles and aliases.
  Keep schema version separate from the current catalogue revision (`version`).
- Add explicit Mini, Deca, and Plus entries with the verified mappings above;
  preserve generic/custom board profiles for other ESP32/C3 hardware.
- Validate board/SoC/revision compatibility, unique aliases, unique physical GPIO
  ownership, pin direction, PWM capability, and reserved peripheral conflicts.
- Treat ESP32 GPIO34/36/39 as input-only and account for absent internal pull-ups;
  use the board's documented external pull-ups. Validate MCU strapping/boot,
  flash/PSRAM, serial/USB, and recovery constraints for each actual board variant.
- Define button activation, software debounce/event handling on top of hardware
  debounce, and explicit optional reset/clear behavior. Do not automatically turn
  a user button into a destructive configuration-reset input.
- Reserve SDA/SCL as a bus pair when enabled. Do not offer I2C or button connector
  pins as lighting terminals simply because the MCU supports PWM on them.

### Firmware and Multichannel Integration

- Extend ConfigDB hardware/light schemas and generated API contracts to carry
  board identity, resource assignments, buttons, and I2C configuration. Use the
  existing schema-generation workflow rather than editing generated code.
- Introduce one board-resource resolver/validator used by all configuration paths
  (webapp, API, persisted configuration). Resolve aliases before ownership checks.
- Replace the single RGBWW pin-loading assumption with the planned per-light
  runtime and a shared PWM allocation layer. Apply per-light calibration, color
  conversion, transitions, state, presets, and commands through that runtime.
- Encode timer-block grouping constraints in the allocator. Extend RGBWWLed to
  coordinate RGB and tunable-white backend groups across two blocks as one RGBWW
  virtual light, with consistent transitions, calibration, on/off behavior, and
  state reporting. Reject unsupported groupings before persisting assignments.
- Measure backend capacity before advertising support: Deca needs 15 simultaneous
  PWM outputs for full use. Verify ESP32/C3 channel/timer allocation and shared
  frequency/resolution constraints; never infer capacity from GPIO count alone.
- Validate the whole proposed configuration before committing or driving pins.
  Apply/reboot safely, keep outputs off during reassignment, and retain a
  recoverable last-known-good configuration on failure.
- Add configurable button actions: toggle/dim a virtual light, activate a preset,
  execute a supported command, publish an MQTT message, or expose input state
  and press events to Home Assistant for automation. Target stable light/preset
  IDs where applicable; distinguish physical state from momentary press events.
  Define press/release, optional long-press/repeat behavior, and debounce semantics.
- Route commands through validated existing APIs. Define MQTT topic/payload
  configuration, offline behavior, and feedback-loop prevention. Expose physical
  state/events through discovery and the integration rather than claiming the
  device can directly set arbitrary Home Assistant entity state.
- Support I2C initialization and reservation independently of later device-specific
  display/sensor/expander features.
- Follow the capability-gated multiple-light direction in firmware
  [branches.md](../esp_rgbww_firmware/branches.md#L1620), including `lights.multiple`.
  Define named-pin/button/I2C capability identifiers during API design and expose
  actual build limits. Preserve the existing single-light path for older firmware
  and ESP8266; do not assume every ESP32/C3 build implements the new model.

### Webapp and Other Consumers

- Present board selection separately from light creation and wiring assignments.
  Label choices as `L1 (GPIO27)`, `Button_1 (GPIO36)`, or `I2C SDA (GPIO15)`;
  show aliases and restrictions where relevant, while persisting stable IDs.
- Provide virtual-light creation, editing, removal, and pin assignment in both
  Webapp2 and Home Assistant, backed by the same device API and validation rules.
  Keep light/entity IDs stable when names or pin assignments change; confirm
  removal when presets, actions, or automations reference a light.
- Replace mandatory RGB validation with requirements for the chosen light type.
  Display assigned/free/reserved resources and block conflicts before save.
- Update both the controller configuration dialog and first-run
  [src/pages/NetworkInit.vue](src/pages/NetworkInit.vue) to use the same model.
- Offer guided default templates without overwriting custom wiring. Support
  assignment preview, disabled/unassigned resources, and useful validation errors.
- Provide button-action configuration in both clients and expose button state/
  events to Home Assistant. Make actions unavailable when their required command,
  MQTT, or firmware capability is missing.
- Negotiate capabilities before exposing new controls or sending new-format
  writes. Keep legacy setup/editing available for older firmware.
- Coordinate per-light state/events, groups, scenes, presets, MQTT discovery,
  and Home Assistant entities with the multichannel API. Identify each light by
  controller plus stable light ID, not merely a GPIO or display name.

## Migration and Delivery Order

1. Reconcile version/stage branch names and complete CI/distribution/updater
   readiness for the 5.0 legacy and 5.1 ESP32/C3-only lines before branch migration.
2. Add catalogue/schema validation and fixtures; correct source mappings in a
   reviewed new profile revision. Do not silently rewire an active legacy profile.
3. Publish the advanced catalogue separately for 5.1. Keep normal pinconfig.json
  QuinLED RGBWW presets at existing embedded/remote paths for unchanged 5.0.
  Preserve installed wiring and custom profiles. Any legacy-compatible view
  in 5.1 is optional and must never implicitly flatten multiple lights.
4. Implement resource ownership, timer-block-aware PWM allocation, and RGBWWLed
   split-group coordination with the multichannel runtime/API. Then enable
   virtual-light creation and pin assignment in both clients by capability.
5. Add configurable button actions and I2C configuration after firmware support;
   reserve these pins from the outset even when the features are unavailable.
6. Record I2C peripheral and addressable-library feasibility results before
   separately planning selected expansion features or digital-controller support.
7. Qualify Mini, Deca, and Plus on hardware and update dependent integrations.

Migration must preserve explicit existing wiring, clear-pin semantics, and custom
profile edits. Map known names to board IDs only when unambiguous; otherwise ask
for board confirmation. Show the old/new pin diff and require approval for GPIO
changes. Remote catalogue refreshes must not overwrite an installed customized
profile; provide an explicit versioned upgrade with rollback/backup instead.

## Acceptance Checks and Open Decisions

- CI and distribution distinguish 5.0 and 5.1, never publish/select ESP8266 for
  5.1, and still run release metadata jobs without an ESP8266 matrix entry.
  Enforce the agreed RGBWWLed pins (`0.10.1` / `0.11.0`) and preserve all three
  SoCs on 5.0 while mapping both source branches to their versioned develop stages.
- Pinout fixtures reproduce all three official tables, resolve vendor aliases,
  and catch the current Deca duplicate/wrong-pin errors.
- A Mini/Plus RGBWW default follows R=L5, G=L4, B=L3, WW=L2, CW=L1; existing
  user-defined wiring survives catalogue refresh and migration unchanged.
- A Deca supports three independently controlled RGBWW lights when the qualified
  backend permits 15 outputs, including one logical RGBWW light composed of RGB
  and tunable-white groups across timer blocks, plus a mixed dimmer/tunable-white/
  RGB setup. Test synchronized transitions and consistent state across blocks.
- Webapp2 and Home Assistant can create virtual lights and assign named pins
  through the shared API without losing stable light/entity identity. Test
  button preset/command/MQTT actions and Home Assistant state/event automation,
  including bounce, long presses, disconnected consumers, and feedback loops.
- Duplicate ownership, unknown pin aliases, input-only PWM, missing required
  functions, unavailable backend channels, and I2C/button conflicts are rejected
  by firmware as well as UI; rejected writes leave active wiring unchanged.
- Physical tests cover all outputs, independent transitions, reboot persistence,
  safe startup/reassignment, button events, Mini bootloader behavior, and I2C bus
  operation. Include concurrent PWM/I2C/button operation and Plus Ethernet pin
  conflicts, without claiming Ethernet itself is implemented by this work.
- Legacy firmware, ESP8266, first-run setup, custom board profiles, and API clients
  retain their supported single-light behavior. New fields/capabilities are tested
  across mixed firmware/webapp versions; only capable firmware receives v2
  device payloads, and 5.0 retains its normal pinconfig.json RGBWW presets and
  unchanged schema/parser.
- Before implementation, confirm supported board revisions, Deca Button_4 behavior,
  PWM backend limits, the legacy `QuinLED An-Penta` identity, and the final shared
  multichannel schema/API. These are qualification gates, not inferred guarantees.
- I2C investigation identifies feasible OLED/sensor options and bus constraints;
  digital-controller investigation identifies a suitable addressable LED library
  and analog-backend coexistence limits. Do not promote these ideas to supported
  features without the corresponding feasibility and hardware evidence.
