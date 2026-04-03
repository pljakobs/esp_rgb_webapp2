# Webapp Refactor TODO

- [ ] Avoid direct store mutation in UI components and route all changes through store update APIs (example: `HostnameCard` writes directly to `configData.data.general.device_name`).
- [ ] Replace repeated inline width and layout styles with shared utility classes or card-level CSS tokens.
- [ ] Refactor `NetworkInit` step indicator markup to be data-driven from a step definition array.
- [ ] Standardize import aliases (`src/...` vs `components/...`) and enforce with ESLint rule/config.
- [ ] Gate debug `console.*` calls behind an environment-aware logger and remove noisy production logs.

