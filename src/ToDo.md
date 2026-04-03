# Webapp Refactor TODO

- [x] Avoid direct store mutation in UI components and route all changes through store update APIs (example: `HostnameCard` writes directly to `configData.data.general.device_name`).
- [x] Replace repeated inline width and layout styles with shared utility classes or card-level CSS tokens.
- [x] Refactor `NetworkInit` step indicator markup to be data-driven from a step definition array.
- [x] Standardize import aliases (`src/...` vs `components/...`) and enforce with ESLint rule/config.
- [x] Gate debug `console.*` calls behind an environment-aware logger and remove noisy production logs.
- [x] the buttons for presets and scenes in the favorites card should be more elegant, more user friendly, more recognizable. They should invite the user to press them and ituitively show that this is a light setting. The button should show the name and the color / the five color swatch for raw presets. I am not sure that the scrolling list is ideal, maybe a tabbed control for all groups would be better (only for those that actually have favorite presets or scenes, of course )
- [ ] color temp slider should only be shown if the color model is RGBWW - not for any other color model
