# QuinLED Hardware and Named Pin Assignment Plan

Status: proposed, planning only. No runtime configuration changes in this document.

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
- Deca: each consecutive group of five is R, G, B, WW, CW.

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

Maintain one configuration/catalogue ecosystem rather than separate 5.0 and 5.1
forks. Keep legacy entries and payloads usable unchanged by older firmware.
Extend only entries targeting 5.1 controllers with named resources and virtual
light assignments; select them by supported schema/API capabilities, not SoC alone.
If older readers reject unknown fields, provide a filtered legacy projection
from the same source catalogue rather than requiring them to parse 5.1 entries.
Do not rewrite ESP8266 or installed 5.0 ESP32/C3 configurations into the new schema.

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
3. Extend only 5.1-targeted catalogue entries with stable board identities and
  named resources. Preserve transitional fixed mappings and legacy payloads;
  allow a single-light projection to the five legacy color/GPIO fields only
  when unambiguous. Never flatten multiple virtual lights into a legacy payload.
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
  across mixed firmware/webapp versions; only 5.1-targeted entries gain the new
  schema, and legacy readers receive compatible catalogue entries/projections.
- Before implementation, confirm supported board revisions, Deca Button_4 behavior,
  PWM backend limits, the legacy `QuinLED An-Penta` identity, and the final shared
  multichannel schema/API. These are qualification gates, not inferred guarantees.
- I2C investigation identifies feasible OLED/sensor options and bus constraints;
  digital-controller investigation identifies a suitable addressable LED library
  and analog-backend coexistence limits. Do not promote these ideas to supported
  features without the corresponding feasibility and hardware evidence.
