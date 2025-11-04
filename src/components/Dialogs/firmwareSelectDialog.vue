<template>
  <q-dialog ref="dialogRef" @hide="onDialogHide" persistent>
    <q-card
      class="shadow-4 q-pa-md"
      style="max-width: 500px; max-height: 640px"
    >
      <q-card-section>
        <div class="text-h6">
          <svgIcon name="systemsecurityupdate_outlined" size="24px" class="q-mr-sm" />
          Firmware update
        </div>
      </q-card-section>

      <q-separator />

      <q-card-section class="centered-content">
        <div>
          <p>Currently running firmware:</p>
          <table class="styled-table">
            <tbody>
              <tr>
                <td class="label">Branch:</td>
                <td>{{ currentInfo.branch || "stable" }}</td>
              </tr>
              <tr>
                <td class="label">Build type:</td>
                <td>{{ currentInfo.build_type }}</td>
              </tr>
              <tr>
                <td class="label">Version:</td>
                <td>{{ currentInfo.git_version }}</td>
              </tr>
              <tr>
                <td class="label">Webapp version:</td>
                <td>{{ currentInfo.webapp_version }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="selection-container q-mt-md">
          <div class="text-subtitle2 text-center q-mb-sm">
            Select firmware to install:
          </div>

          <!-- Branch selector -->
          <div class="row q-mb-md">
            <div class="col-4 q-pr-md">
              <div class="text-caption">Branch:</div>
              <mySelect
                v-model="selectedBranch"
                :options="availableBranches"
                dense
                emit-value
                map-options
                option-label="label"
                option-value="value"
                class="branch-select"
              >
                <template v-slot:option="scope">
                  <q-item v-bind="scope.itemProps">
                    <q-item-section>
                      <q-item-label>{{ scope.opt.label }}</q-item-label>
                    </q-item-section>
                    <q-item-section side>
                      <q-badge :color="scope.opt.color" />
                    </q-item-section>
                  </q-item>
                </template>
              </mySelect>
            </div>

            <!-- Build Type selector -->
            <div class="col-4 q-pr-md">
              <div class="text-caption">Build Type:</div>
              <mySelect
                v-model="selectedType"
                :options="availableTypes"
                dense
                emit-value
                map-options
                option-label="label"
                option-value="value"
                class="type-select"
                :disable="!selectedBranch"
              />
            </div>

            <!-- Version selector -->
            <div class="col-4">
              <div class="text-caption">Version:</div>
              <mySelect
                v-model="selectedVersionId"
                :options="availableVersions"
                dense
                emit-value
                map-options
                option-label="label"
                option-value="id"
                class="version-select"
                :disable="!selectedType"
                @update:model-value="
                  (val) => {
                    console.log('Version selected:', val);
                  }
                "
              >
                <template v-slot:option="scope">
                  <q-item v-bind="scope.itemProps">
                    <q-item-section>
                      <q-item-label>{{ scope.opt.label }}</q-item-label>
                      <q-item-label caption v-if="scope.opt.date">{{
                        formatDate(scope.opt.date)
                      }}</q-item-label>
                    </q-item-section>
                  </q-item>
                </template>
              </mySelect>
            </div>
          </div>

          <!-- Selected firmware summary -->
          <div
            v-if="selectedFirmware"
            class="selected-firmware q-pa-sm q-mt-md rounded-borders"
          >
            <div class="text-subtitle2 text-center">Selected Firmware:</div>
            <div>
              <strong>Branch:</strong> {{ selectedFirmware.branch || "stable" }}
            </div>
            <div><strong>Type:</strong> {{ selectedFirmware.type }}</div>
            <div>
              <strong>Version:</strong> {{ selectedFirmware.fw_version }}
            </div>
          </div>
        </div>
      </q-card-section>

      <q-card-actions align="right">
        <q-btn flat label="Cancel" color="primary" @click="onDialogCancel" />
        <q-btn
          flat
          :label="updateButtonLabel"
          color="primary"
          :disable="!selectedFirmware"
          @click="startUpdate"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script>
import { ref, computed, watch, onMounted } from "vue";
import { useDialogPluginComponent } from "quasar";

export default {
  name: "FirmwareSelectDialog",
  props: {
    firmwareOptions: {
      type: Array,
      required: true,
    },
    currentInfo: {
      type: Object,
      required: true,
    },
    otaUrl: {
      type: String,
      required: true,
    },
  },
  emits: [...useDialogPluginComponent.emits],

  setup(props, { emit }) {
    const { dialogRef, onDialogHide, onDialogOK, onDialogCancel } =
      useDialogPluginComponent();

    // Selection state - initialize with current values
    const selectedBranch = ref(props.currentInfo.branch || "stable");
    const selectedType = ref(props.currentInfo.build_type || "release");
    const selectedVersionId = ref(null);

    // Color helper for branches - defined before it's used
    const getBranchColor = (branch) => {
      if (!branch) return "primary";

      switch (branch) {
        case "stable":
          return "positive";
        case "testing":
          return "warning";
        case "develop":
          return "negative";
        default:
          return "primary";
      }
    };

    // Safely get unique branches from firmware options
    const getUniqueBranches = () => {
      if (!props.firmwareOptions || !Array.isArray(props.firmwareOptions)) {
        return [];
      }
      return [
        ...new Set(props.firmwareOptions.map((fw) => fw.branch || "stable")),
      ];
    };

    // Available branches
    const availableBranches = computed(() => {
      // Debug log to check inputs
      console.log("Firmware options:", props.firmwareOptions);

      // Safely extract unique branches
      const branches = [];
      if (props.firmwareOptions && Array.isArray(props.firmwareOptions)) {
        props.firmwareOptions.forEach((fw) => {
          const branch = fw.branch || "stable";
          if (!branches.some((b) => b.value === branch)) {
            branches.push({
              label: branch.charAt(0).toUpperCase() + branch.slice(1), // Capitalize
              value: branch,
              color: getBranchColor(branch),
            });
          }
        });
      }

      // Sort branches in a predictable order
      branches.sort((a, b) => {
        const order = { stable: 0, testing: 1, develop: 2 };
        return (order[a.value] || 99) - (order[b.value] || 99);
      });

      console.log("Available branches:", branches);
      return branches;
    });

    // Available build types for selected branch
    const availableTypes = computed(() => {
      if (!selectedBranch.value || !props.firmwareOptions) return [];

      const types = [
        ...new Set(
          props.firmwareOptions
            .filter((fw) => (fw.branch || "stable") === selectedBranch.value)
            .map((fw) => fw.type),
        ),
      ];

      return types
        .map((type) => ({
          label: type.charAt(0).toUpperCase() + type.slice(1), // Capitalize
          value: type,
        }))
        .sort((a, b) => {
          // Release first, then debug
          if (a.value === "release" && b.value !== "release") return -1;
          if (a.value !== "release" && b.value === "release") return 1;
          return a.value.localeCompare(b.value);
        });
    });

    // Available versions for selected branch and type
    const availableVersions = computed(() => {
      if (
        !selectedBranch.value ||
        !selectedType.value ||
        !props.firmwareOptions
      )
        return [];

      console.log(
        `DEBUG: Getting versions for branch=${selectedBranch.value}, type=${selectedType.value}`,
      );

      const result = props.firmwareOptions
        .filter(
          (fw) =>
            (fw.branch || "stable") === selectedBranch.value &&
            fw.type === selectedType.value,
        )
        .map((fw, index) => ({
          label: fw.fw_version,
          value: fw.fw_version,
          id: fw.id || `${fw.soc}_${fw.type}_${fw.fw_version}_${index}`,
          date: fw.date,
          fw: fw,
        }))
        .sort((a, b) => {
          // Sort by version in descending order (newest first)
          return b.value.localeCompare(a.value, undefined, { numeric: true });
        });

      console.log("DEBUG: Available versions:", result);
      return result;
    });

    // Add this watch right after the existing watch handlers (around line 310)
    // Add this after the watch for selectedType
    watch(selectedVersionId, (newId) => {
      console.log("DEBUG: Selected version ID changed to:", newId);
      if (newId) {
        const version = availableVersions.value.find((v) => v.id === newId);
        console.log(
          "DEBUG: Selected firmware:",
          version ? version.fw : "not found",
        );
      }
    });

    // The selected firmware object
    const selectedFirmware = computed(() => {
      if (!selectedVersionId.value || !availableVersions.value) return null;

      const version = availableVersions.value.find(
        (v) => v.id === selectedVersionId.value,
      );
      return version ? version.fw : null;
    });

    // Format date helper
    const formatDate = (dateStr) => {
      if (!dateStr) return "";
      try {
        const date = new Date(dateStr);
        return date.toLocaleDateString();
      } catch (e) {
        return dateStr;
      }
    };

    // Safely handle type selection when branch changes
    watch(selectedBranch, (newBranch) => {
      if (!newBranch) {
        selectedType.value = null;
        selectedVersionId.value = null;
        return;
      }

      if (availableTypes.value.length > 0) {
        // Try to maintain current build type if available
        const currentType = props.currentInfo.build_type;
        if (availableTypes.value.some((t) => t.value === currentType)) {
          selectedType.value = currentType;
        } else {
          // Default to first type (usually 'release')
          selectedType.value = availableTypes.value[0].value;
        }
      } else {
        selectedType.value = null;
      }

      // Reset version when branch changes
      selectedVersionId.value = null;
    });

    // Safely handle version selection when type changes
    watch(selectedType, (newType) => {
      if (!newType) {
        selectedVersionId.value = null;
        return;
      }

      if (availableVersions.value.length > 0) {
        // Always select the newest version (first in the sorted list)
        selectedVersionId.value = availableVersions.value[0].id;
      } else {
        selectedVersionId.value = null;
      }
    });

    // Start the update process
    const startUpdate = () => {
      if (!selectedFirmware.value) {
        return;
      }

      // Process the firmware URLs
      let baseUrl;
      let fullUrl;
      const relativeUrl = selectedFirmware.value.files.rom.url;

      if (relativeUrl.substring(0, 4) !== "http") {
        // relative URL is server relative (has no scheme)
        baseUrl = props.otaUrl.substring(0, props.otaUrl.lastIndexOf("/") + 1);
        fullUrl = baseUrl + relativeUrl;
      } else {
        // relative URL is not really relative, thus has the host portion
        fullUrl = relativeUrl;
      }

      // Create a deep copy to avoid mutating props
      const preparedFirmware = JSON.parse(
        JSON.stringify(selectedFirmware.value),
      );
      preparedFirmware.files.rom.url = fullUrl;

      // Send the selected firmware back to the parent
      onDialogOK(preparedFirmware);
    };
    const compareVersions = (version1, version2) => {
      // Extract version components (only consider major.minor-build)
      const extractComponents = (ver) => {
        // Match patterns like "1.2-3" or "1.2.3-4"
        const match = /^(\d+)\.(\d+)(?:\.\d+)?-(\d+)/.exec(ver);
        if (match) {
          return {
            major: parseInt(match[1], 10),
            minor: parseInt(match[2], 10),
            build: parseInt(match[3], 10),
          };
        }
        return { major: 0, minor: 0, build: 0 }; // Default if pattern doesn't match
      };

      const v1 = extractComponents(version1);
      const v2 = extractComponents(version2);

      // Compare major version
      if (v1.major !== v2.major) {
        return v1.major - v2.major;
      }

      // If major is the same, compare minor version
      if (v1.minor !== v2.minor) {
        return v1.minor - v2.minor;
      }

      // If major and minor are the same, compare build
      return v1.build - v2.build;
    };

    // Determine the button label based on version comparison
    const updateButtonLabel = computed(() => {
      if (!selectedFirmware.value) return "Update";

      const currentVersion = props.currentInfo.git_version;
      const selectedVersion = selectedFirmware.value.fw_version;
      const currentBranch = props.currentInfo.branch || "stable";
      const selectedBranch = selectedFirmware.value.branch || "stable";
      const currentType = props.currentInfo.build_type;
      const selectedType = selectedFirmware.value.type;

      // Check if branch or build type is changing
      if (currentBranch !== selectedBranch || currentType !== selectedType) {
        return "Switch";
      }

      // Check if downgrading version
      const versionComparison = compareVersions(
        selectedVersion,
        currentVersion,
      );
      if (versionComparison < 0) {
        return "Downgrade";
      }

      // Default case - upgrading
      return "Update";
    });
    // Initialize on mount
    onMounted(() => {
      console.log(
        "FirmwareSelectDialog mounted with options:",
        props.firmwareOptions ? props.firmwareOptions.length : 0,
      );

      // Wait for the next tick to ensure computed properties are ready
      setTimeout(() => {
        // Update version selector based on initial branch and type
        if (availableVersions.value.length > 0) {
          selectedVersionId.value = availableVersions.value[0].id;
        }
      }, 0);
    });

    return {
      dialogRef,
      onDialogHide,
      onDialogCancel,
      selectedBranch,
      selectedType,
      selectedVersionId,
      availableBranches,
      availableTypes,
      availableVersions,
      selectedFirmware,
      formatDate,
      getBranchColor,
      startUpdate,
      updateButtonLabel,
    };
  },
};
</script>

<style scoped>
.styled-table {
  border-collapse: separate;
  border-spacing: 10px;
}

.styled-table th {
  font-weight: bold;
  text-align: center;
}

.styled-table td {
  text-align: left;
}

.styled-table .label {
  text-align: right;
}

.centered-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
}

.selection-container {
  width: 100%;
  max-width: 450px;
  margin: 0 auto;
}

/* Fixed color styling for branches */
.branch-select .q-field__native {
  color: var(--primary);
}

.selected-firmware {
  text-align: left;
  color: var(--field-value-color, var(--field-value-color-light));
  background-color: var(--table-item-bg, var(--table-item-bg-light)) !important;
}

/* Dark mode specific styles */
.body--dark .selected-firmware {
  color: var(--field-value-color-dark);
  background-color: var(--table-item-bg-dark) !important;
}
</style>
