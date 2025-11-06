# Build Workflow Architecture

## Three Parallel Build Tracks

This project uses three parallel build tracks for coordinated webapp and firmware releases:

### 1. **Development Track** (`devel` → `develop`)

- **Webapp Branch**: `devel`
- **Firmware Branch**: `develop`
- **Purpose**: Active development, frequent changes
- **Artifacts**: Published to `https://pljakobs.github.io/esp_rgb_webapp2/devel/`

### 2. **Testing Track** (`testing` → `testing`)

- **Webapp Branch**: `testing`
- **Firmware Branch**: `testing`
- **Purpose**: Release candidates, beta testing
- **Artifacts**: Published to `https://pljakobs.github.io/esp_rgb_webapp2/testing/`

### 3. **Stable Track** (`stable` → `stable`)

- **Webapp Branch**: `stable`
- **Firmware Branch**: `stable`
- **Purpose**: Production releases
- **Artifacts**: Published to `https://pljakobs.github.io/esp_rgb_webapp2/stable/`

## Workflow Sequence

### Webapp Build (esp_rgb_webapp2)

1. Push to `devel`, `testing`, or `stable` branch
2. `frontendBuild` workflow runs:
   - Builds Quasar app
   - Generates version info (V5.0-{build_num}-{branch})
   - Creates fileList.h
   - Publishes artifacts to `gh-pages/{branch}/`
3. On success, triggers firmware build

### Firmware Build (esp_rgbww_firmware)

1. Receives `repository_dispatch` event with branch info
2. Maps webapp branch to firmware branch:
   - `devel` → `develop`
   - `testing` → `testing`
   - `stable` → `stable`
3. Downloads webapp artifacts from branch-specific URL
4. Builds firmware for all platforms (ESP8266, ESP32, ESP32C3)
5. Publishes firmware artifacts

## Branch Mapping

| Webapp Branch | Firmware Branch | Artifact URL                                        |
| ------------- | --------------- | --------------------------------------------------- |
| devel         | develop         | https://pljakobs.github.io/esp_rgb_webapp2/devel/   |
| testing       | testing         | https://pljakobs.github.io/esp_rgb_webapp2/testing/ |
| stable        | stable          | https://pljakobs.github.io/esp_rgb_webapp2/stable/  |

## Upgrading Between Tracks

To promote changes from one track to another:

```bash
# Development → Testing
git checkout testing
git merge devel
git push

# Testing → Stable
git checkout stable
git merge testing
git push
```

This will trigger the appropriate build workflows automatically.

## Manual Triggers

### Webapp Only

```bash
# From GitHub Actions UI, select frontendBuild workflow
# Choose branch: devel, testing, or stable
```

### Firmware Only

```bash
# From GitHub Actions UI, select firmwareBuild workflow
# Choose branch: develop, testing, or stable
```

## Artifact Structure

```
gh-pages/
├── devel/
│   ├── index.html
│   ├── spa-files.zip
│   └── fileList.h
├── testing/
│   ├── index.html
│   ├── spa-files.zip
│   └── fileList.h
└── stable/
    ├── index.html
    ├── spa-files.zip
    └── fileList.h
```

## Version Format

All builds use the format: `V5.0-{build_number}-{branch}`

Example:

- `V5.0-123-devel`
- `V5.0-45-testing`
- `V5.0-67-stable`

## Key Changes from Previous Setup

1. **Branch-specific artifacts**: Each branch publishes to its own directory
2. **keep_files: true**: Prevents overwriting artifacts from other branches
3. **Automatic triggering**: Webapp builds automatically trigger corresponding firmware builds
4. **Branch mapping**: Handles naming differences between repos (devel↔develop)
5. **Success checking**: Firmware only triggers on successful webapp builds
