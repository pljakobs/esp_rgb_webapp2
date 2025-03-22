<template>
  <MyCard title="Firmware update" icon="systemsecurityupdate_outlined">
    <q-card-section>
      <q-input
        v-model="otaUrl"
        label="OTA URL"
        hint="URL to the firmware update server"
      />
    </q-card-section>

    <q-card-actions align="between">
      <q-btn
        label="Check firmware"
        color="primary"
        class="q-mt-md"
        @click="fetchFirmware"
      />
      <q-btn
        label="Update All"
        color="secondary"
        class="q-mt-md"
        @click="updateAllControllers"
        :disable="updating"
      />
    </q-card-actions>

    <q-card-section v-if="firmware">
      Current: firmware: {{ infoData.data.git_version }} webapp:
      {{ infoData.data.webapp_version }}
    </q-card-section>
  </MyCard>
</template>

<script>
import { ref, nextTick } from "vue";
import { Dialog, Notify } from "quasar";
import { configDataStore } from "src/stores/configDataStore";
import { infoDataStore } from "src/stores/infoDataStore";
import { useControllersStore } from "src/stores/controllersStore";
import MyCard from "src/components/myCard.vue";
import FirmwareSelectDialog from "src/components/Dialogs/firmwareSelectDialog.vue";
import FirmwareUpdateProgressDialog from "src/components/Dialogs/firmwareUpdateProgressDialog.vue";

export default {
  components: {
    MyCard,
  },
  setup() {
    const configData = configDataStore();
    const infoData = infoDataStore();
    const controllersStore = useControllersStore();

    const otaUrl = ref(configData.data.ota.url);
    const firmware = ref();
    const availableFirmware = ref([]);
    const updating = ref(false);

    const fetchFirmware = async () => {
      console.log("Fetching firmware from:", otaUrl.value);
      try {
        const response = await fetch(otaUrl.value, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) {
          Dialog.create({
            title: "HTTP error",
            message: `HTTP error! status: ${response.status}`,
            color: "negative",
            icon: "report_problem",
            persistent: true,
          });
          return;
        }

        const data = await response.json();
        firmware.value = data;

        // Filter available firmware based on current SoC
        availableFirmware.value = data.firmware.filter(
          (fw) => fw.soc === infoData.data.soc,
        );
        console.log("Available firmware:", availableFirmware.value);

        // Open the firmware selection dialog
        showFirmwareDialog();
      } catch (error) {
        console.error("Error fetching firmware:", error);
        Dialog.create({
          title: "Error",
          message: `Error fetching firmware: ${error.message}`,
          color: "negative",
          icon: "report_problem",
          persistent: true,
        });
      }
    };

    const showFirmwareDialog = () => {
      Dialog.create({
        component: FirmwareSelectDialog,
        componentProps: {
          firmwareOptions: availableFirmware.value,
          currentInfo: infoData.data,
          otaUrl: otaUrl.value,
        },
        persistent: true,
      }).onOk(async (selectedFirmware) => {
        await updateController(
          selectedFirmware,
          controllersStore.currentController,
        );
      });
    };

    // Helper function to fetch with a 500ms timeout
    const fetchWithTimeout = async (url, options = {}, timeout = 500) => {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), timeout);

      try {
        const response = await fetch(url, {
          ...options,
          signal: controller.signal,
        });
        clearTimeout(id);
        return response;
      } catch (error) {
        clearTimeout(id);
        throw error;
      }
    };

    const updateController = async (
      selectedFirmware,
      controller,
      initialUptime = null,
    ) => {
      try {
        console.log(
          "Updating controller:",
          controller.hostname,
          "with firmware:",
          selectedFirmware,
        );

        const postResponse = await fetch(
          `http://${controller.ip_address}/update`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(selectedFirmware.files),
          },
        );

        if (!postResponse.ok) {
          Dialog.create({
            title: "Update failed",
            message: `Update failed for ${controller.hostname}! status: ${postResponse.status}`,
            color: "negative",
            icon: "report_problem",
            persistent: true,
          });
          return { success: false };
        }

        // Show the countdown dialog for current controller only
        if (controller.id === controllersStore.currentController.id) {
          Dialog.create({
            component: FirmwareUpdateProgressDialog,
            persistent: true,
          });
        }

        // For batch updates, verify reboot by checking uptime
        if (initialUptime !== null) {
          // Wait 5 seconds before starting to poll (give the controller time to begin rebooting)
          await new Promise((resolve) => setTimeout(resolve, 5000));

          // Start polling for reboot completion
          const verifyReboot = async () => {
            const maxRetries = 60; // Try for 5 minutes max (60 * 5s = 300s = 5 min)
            let attempts = 0;
            let rebootVerified = false;
            let newUptime = null;

            while (!rebootVerified && attempts < maxRetries) {
              attempts++;
              try {
                // Use fetchWithTimeout with a 500ms timeout
                const response = await fetchWithTimeout(
                  `http://${controller.ip_address}/info`,
                  {},
                  500, // 500ms timeout
                );

                // If we get a response, check the uptime
                if (response.ok) {
                  const infoData = await response.json();
                  newUptime = infoData.uptime;

                  // If uptime is less than before, controller has successfully rebooted
                  if (newUptime < initialUptime) {
                    console.log(
                      `Reboot verified for ${controller.hostname} after ${attempts} attempts. Uptime: ${initialUptime} → ${newUptime}`,
                    );
                    rebootVerified = true;
                    return {
                      success: true,
                      rebootVerified: true,
                      newUptime,
                      attempts,
                    };
                  } else {
                    console.log(
                      `Controller ${controller.hostname} responded but with unexpected uptime: ${initialUptime} → ${newUptime}`,
                    );
                    // Wait 5 seconds before next attempt
                    await new Promise((resolve) => setTimeout(resolve, 5000));
                  }
                } else {
                  // No valid response yet, likely still rebooting
                  console.log(
                    `Controller ${controller.hostname} not ready yet, attempt ${attempts}`,
                  );
                  // Wait 5 seconds before next attempt
                  await new Promise((resolve) => setTimeout(resolve, 5000));
                }
              } catch (error) {
                // Error connecting, likely still rebooting or timeout
                const errorMessage =
                  error.name === "AbortError"
                    ? "Connection timed out (500ms)"
                    : error.message;

                console.log(
                  `Connection to ${controller.hostname} failed, attempt ${attempts}: ${errorMessage}`,
                );
                // Wait 5 seconds before next attempt
                await new Promise((resolve) => setTimeout(resolve, 5000));
              }
            }

            // If we get here, reboot couldn't be verified
            return {
              success: true,
              rebootVerified: false,
              message:
                newUptime !== null
                  ? `Update sent but reboot not verified (old uptime: ${initialUptime}, new: ${newUptime})`
                  : `Update sent but couldn't reconnect to controller after ${attempts} attempts`,
              attempts,
            };
          };

          return await verifyReboot();
        }

        return { success: true };
      } catch (error) {
        console.error(
          `Error updating firmware for ${controller.hostname}:`,
          error,
        );
        Dialog.create({
          title: "Error",
          message: `Error updating ${controller.hostname}: ${error.message}`,
          color: "negative",
          icon: "report_problem",
          persistent: true,
        });
        return { success: false, error: error.message };
      }
    };

    const updateAllControllers = async () => {
      // Prevent multiple simultaneous update operations
      if (updating.value) return;
      updating.value = true;

      // Add confirmation dialog
      Dialog.create({
        title: "Update All Controllers",
        message:
          "This will update all controllers in your network. Are you sure you want to continue?",
        cancel: true,
        persistent: true,
      })
        .onOk(async () => {
          try {
            // Show initial loading dialog while fetching firmware info
            const initialLoadingDialog = Dialog.create({
              title: "Preparing Update",
              message: "Fetching firmware information...",
              progress: {
                indeterminate: true,
              },
              persistent: true,
            });

            // Use the already fetched firmware if available
            const firmwareData =
              firmware.value ||
              (await (async () => {
                const response = await fetch(otaUrl.value, {
                  method: "GET",
                  headers: {
                    "Content-Type": "application/json",
                  },
                });

                if (!response.ok) {
                  throw new Error(`HTTP error! status: ${response.status}`);
                }

                return await response.json();
              })());

            console.log("Firmware data:", firmwareData);

            // Get all controllers except the current one
            const allControllers = controllersStore.data.filter(
              (controller) =>
                controller.id !== controllersStore.currentController.id,
            );

            if (allControllers.length === 0) {
              initialLoadingDialog.hide();
              Dialog.create({
                title: "No Controllers",
                message: "No additional controllers found to update.",
                persistent: true,
              });
              updating.value = false;
              return;
            }

            // Results tracking
            const results = {
              success: 0,
              failed: 0,
              skipped: 0,
              details: [],
            };

            // Hide the loading dialog
            initialLoadingDialog.hide();

            // Create monitor dialog with a component-based approach
            const monitorDialog = Dialog.create({
              title: "Firmware Update Monitor",
              message: `<div id="monitor-content">
                  <div class="text-weight-medium q-mb-md">Updating ${
                    allControllers.length
                  } controllers</div>
                  <div id="summary-stats" class="q-mb-md">
                    <div class="row q-col-gutter-md">
                      <div class="col-3 text-center">
                        <div class="text-subtitle2 text-positive">Success</div>
                        <div id="success-count" class="text-h6">0</div>
                      </div>
                      <div class="col-3 text-center">
                        <div class="text-subtitle2 text-negative">Failed</div>
                        <div id="failed-count" class="text-h6">0</div>
                      </div>
                      <div class="col-3 text-center">
                        <div class="text-subtitle2 text-amber">Skipped</div>
                        <div id="skipped-count" class="text-h6">0</div>
                      </div>
                      <div class="col-3 text-center">
                        <div class="text-subtitle2">Progress</div>
                        <div id="progress-percent" class="text-h6">0%</div>
                      </div>
                    </div>
                  </div>
                  <div class="q-mb-md text-subtitle1">Controller Status</div>
                  <div id="scrollable-area" style="max-height: 300px; overflow-y: auto; border: 1px solid #ddd; border-radius: 4px; padding: 10px;">
                    ${allControllers
                      .map(
                        (controller) =>
                          `<div id="status-${controller.id}" class="controller-status q-mb-md">
                        <div class="row items-center">
                          <div class="col-8">
                            <div class="text-weight-medium">${controller.hostname}</div>
                            <div class="text-caption">${controller.ip_address}</div>
                          </div>
                          <div class="col-4 text-right">
                            <div class="q-mr-xs status-indicator waiting">
                              <span class="q-spinner-container">
                                <svg class="q-spinner" width="1em" height="1em" viewBox="25 25 50 50">
                                  <circle class="path" cx="50" cy="50" r="20" fill="none" stroke="currentColor" stroke-width="3" stroke-miterlimit="10"/>
                                </svg>
                              </span>
                              <span>Waiting</span>
                            </div>
                          </div>
                        </div>
                        <div id="details-${controller.id}" class="details q-mt-sm q-pa-xs rounded-borders" style="display:none;"></div>
                      </div>`,
                      )
                      .join("")}
                    <!-- Add local controller to the list -->
                    <div id="status-local" class="controller-status q-mb-md" style="display:none;">
                      <div class="row items-center">
                        <div class="col-8">
                          <div class="text-weight-medium">${controllersStore.currentController.hostname} (Current)</div>
                          <div class="text-caption">${controllersStore.currentController.ip_address}</div>
                        </div>
                        <div class="col-4 text-right">
                          <div class="q-mr-xs status-indicator waiting">
                            <span class="q-spinner-container">
                              <svg class="q-spinner" width="1em" height="1em" viewBox="25 25 50 50">
                                <circle class="path" cx="50" cy="50" r="20" fill="none" stroke="currentColor" stroke-width="3" stroke-miterlimit="10"/>
                              </svg>
                            </span>
                            <span>Waiting</span>
                          </div>
                        </div>
                      </div>
                      <div id="details-local" class="details q-mt-sm q-pa-xs rounded-borders" style="display:none;"></div>
                    </div>
                  </div>
                  <div id="local-controller-update" class="q-mt-md q-pa-md text-center bg-grey-2 rounded-borders" style="display: none;">
                    <div class="text-subtitle2">Update Local Controller?</div>
                    <div class="q-mt-sm">
                      <button id="update-local-btn" class="q-btn q-btn-item non-selectable no-outline q-btn--standard q-btn--rectangle bg-primary text-white q-btn--actionable q-focusable q-hoverable q-btn--no-uppercase q-pa-sm">
                        <span class="q-btn__content text-center">Update Local Controller</span>
                      </button>
                    </div>
                  </div>
                  <div id="completion-message" class="q-mt-md text-center" style="display: none;">
                    <div class="text-h6 text-positive">Update process complete!</div>
                  </div>
                </div>`,
              html: true,
              style: {
                width: "600px",
                maxWidth: "90vw",
              },
              persistent: true,
              buttons: [
                {
                  label: "Close",
                  color: "primary",
                  id: "close-btn",
                  disable: true,
                  flat: false,
                  onClick: () => {
                    monitorDialog.hide();
                  },
                },
              ],
            });

            // Helper function to update UI
            const updateUI = () => {
              try {
                if (document.getElementById("success-count")) {
                  document.getElementById("success-count").textContent =
                    results.success;
                  document.getElementById("failed-count").textContent =
                    results.failed;
                  document.getElementById("skipped-count").textContent =
                    results.skipped;

                  const total = allControllers.length;
                  const completed =
                    results.success + results.failed + results.skipped;
                  const percentComplete = Math.round((completed / total) * 100);

                  document.getElementById("progress-percent").textContent =
                    `${percentComplete}%`;

                  // Enable the close button when all controllers are processed
                  if (completed === total) {
                    if (document.getElementById("completion-message")) {
                      document.getElementById(
                        "completion-message",
                      ).style.display = "block";
                    }

                    // Enable the local controller update option
                    const localControllerUpdateDiv = document.getElementById(
                      "local-controller-update",
                    );
                    if (localControllerUpdateDiv) {
                      localControllerUpdateDiv.style.display = "block";
                    }

                    // Enable the close button
                    monitorDialog.update({
                      buttons: [
                        {
                          label: "Close",
                          color: "primary",
                          flat: false,
                          disable: false,
                          onClick: () => {
                            monitorDialog.hide();
                          },
                        },
                      ],
                    });
                  }
                }
              } catch (error) {
                console.error("Error updating UI:", error);
              }
            };

            // Helper function to update controller status in the UI
            const updateStatus = (
              controller,
              status,
              details = null,
              fromVersion = null,
              toVersion = null,
            ) => {
              try {
                const statusId =
                  controller.id === controllersStore.currentController.id
                    ? "status-local"
                    : `status-${controller.id}`;
                const detailsId =
                  controller.id === controllersStore.currentController.id
                    ? "details-local"
                    : `details-${controller.id}`;

                const statusEl = document.getElementById(statusId);
                if (!statusEl) return;

                // Update status indicator
                const indicator = statusEl.querySelector(".status-indicator");
                if (indicator) {
                  indicator.className = `q-mr-xs status-indicator ${status}`;

                  // Update indicator content based on status
                  let iconHtml = "";
                  switch (status) {
                    case "checking":
                      iconHtml = `<span class="q-spinner-container">
                        <svg class="q-spinner text-primary" width="1em" height="1em" viewBox="25 25 50 50">
                          <circle class="path" cx="50" cy="50" r="20" fill="none" stroke="currentColor" stroke-width="3" stroke-miterlimit="10"/>
                        </svg>
                      </span> <span>Checking</span>`;
                      break;
                    case "updating":
                      iconHtml = `<span class="q-spinner-container">
                        <svg class="q-spinner text-orange" width="1em" height="1em" viewBox="25 25 50 50">
                          <circle class="path" cx="50" cy="50" r="20" fill="none" stroke="currentColor" stroke-width="3" stroke-miterlimit="10"/>
                        </svg>
                      </span> <span>Updating</span>`;
                      break;
                    case "success":
                      iconHtml =
                        '<i class="material-icons text-positive" style="font-size: 1em;">check_circle</i> <span>Success</span>';
                      break;
                    case "failed":
                      iconHtml =
                        '<i class="material-icons text-negative" style="font-size: 1em;">error</i> <span>Failed</span>';
                      break;
                    case "skipped":
                      iconHtml =
                        '<i class="material-icons text-amber" style="font-size: 1em;">info</i> <span>Skipped</span>';
                      break;
                    default:
                      iconHtml = `<span class="q-spinner-container">
                        <svg class="q-spinner text-grey" width="1em" height="1em" viewBox="25 25 50 50">
                          <circle class="path" cx="50" cy="50" r="20" fill="none" stroke="currentColor" stroke-width="3" stroke-miterlimit="10"/>
                        </svg>
                      </span> <span>Waiting</span>`;
                  }
                  indicator.innerHTML = iconHtml;
                }

                // Update details section if provided
                if (details) {
                  const detailsEl = document.getElementById(detailsId);
                  if (detailsEl) {
                    let detailsContent = details;

                    // Add version information if provided
                    if (fromVersion && toVersion) {
                      detailsContent += `<div class="text-caption q-mt-xs">Version: ${fromVersion} → ${toVersion}</div>`;
                    }

                    detailsEl.innerHTML = detailsContent;
                    detailsEl.style.display = "block";

                    // Add appropriate background color based on status
                    if (status === "success") {
                      detailsEl.className =
                        "details q-mt-sm q-pa-xs rounded-borders bg-positive-1";
                    } else if (status === "failed") {
                      detailsEl.className =
                        "details q-mt-sm q-pa-xs rounded-borders bg-negative-1";
                    } else if (status === "skipped") {
                      detailsEl.className =
                        "details q-mt-sm q-pa-xs rounded-borders bg-amber-1";
                    } else {
                      detailsEl.className =
                        "details q-mt-sm q-pa-xs rounded-borders bg-grey-2";
                    }
                  }
                }
              } catch (error) {
                console.error("Error updating status UI:", error);
              }
            };

            // Function to update the local controller
            const updateLocalController = async (firmwareData) => {
              const localController = controllersStore.currentController;

              try {
                // Update status to checking
                updateStatus(
                  localController,
                  "checking",
                  "Fetching controller information...",
                );

                // Get current uptime for reboot verification
                const uptime = infoData.data.uptime;
                const soc = infoData.data.soc;
                const build_type = infoData.data.build_type;
                const git_version = infoData.data.git_version;

                // Show controller info
                updateStatus(
                  localController,
                  "checking",
                  `Controller information: SOC=${soc}, type=${build_type}, version=${git_version}, uptime=${uptime}`,
                );

                // Find matching firmware
                const matchingFirmware = firmwareData.firmware.find(
                  (fw) => fw.soc === soc && fw.type === build_type,
                );

                if (!matchingFirmware) {
                  // Look for fallback firmware
                  const fallbackFirmware = firmwareData.firmware.find(
                    (fw) => fw.soc === soc,
                  );

                  if (fallbackFirmware) {
                    updateStatus(
                      localController,
                      "updating",
                      `No exact firmware match found. Using fallback: ${fallbackFirmware.soc}/${fallbackFirmware.type} v${fallbackFirmware.version}`,
                    );

                    // Update with fallback firmware
                    const updateResult = await updateController(
                      fallbackFirmware,
                      localController,
                      uptime,
                    );

                    if (updateResult.success) {
                      let statusMessage = "Updated with fallback firmware";

                      // Add reboot verification details if available
                      if (updateResult.rebootVerified) {
                        statusMessage += ` and reboot verified (new uptime: ${updateResult.newUptime})`;
                      } else if (updateResult.message) {
                        statusMessage += `. ${updateResult.message}`;
                      }

                      updateStatus(
                        localController,
                        "success",
                        statusMessage,
                        git_version,
                        fallbackFirmware.version,
                      );
                    } else {
                      updateStatus(
                        localController,
                        "failed",
                        "Update failed with fallback firmware",
                      );
                    }
                  } else {
                    updateStatus(
                      localController,
                      "skipped",
                      `No matching firmware found for SOC: ${soc}, type: ${build_type}`,
                    );
                  }
                  return;
                }

                // Skip if already on latest version
                if (git_version === matchingFirmware.version) {
                  updateStatus(
                    localController,
                    "skipped",
                    `Already on latest version (${matchingFirmware.version})`,
                  );
                  return;
                }

                // Update with matching firmware
                updateStatus(
                  localController,
                  "updating",
                  `Updating to version ${matchingFirmware.version}`,
                );

                const updateResult = await updateController(
                  matchingFirmware,
                  localController,
                  uptime,
                );

                if (updateResult.success) {
                  let statusMessage = "Update completed successfully";

                  // Add reboot verification details if available
                  if (updateResult.rebootVerified) {
                    statusMessage += ` and reboot verified (new uptime: ${updateResult.newUptime})`;
                  } else if (updateResult.message) {
                    statusMessage += `. ${updateResult.message}`;
                  }

                  updateStatus(
                    localController,
                    "success",
                    statusMessage,
                    git_version,
                    matchingFirmware.version,
                  );
                } else {
                  updateStatus(
                    localController,
                    "failed",
                    "Update process failed",
                  );
                }
              } catch (error) {
                console.error(`Error processing local controller:`, error);

                updateStatus(
                  localController,
                  "failed",
                  `Error: ${error.message}`,
                );
              }
            };

            // Process all controllers in parallel
            const updatePromises = allControllers.map(async (controller) => {
              try {
                // Update status to checking
                updateStatus(
                  controller,
                  "checking",
                  "Fetching controller information...",
                );

                // Fetch controller info with retries
                let controllerInfo = null;
                let retryCount = 0;
                const maxRetries = 3;

                while (!controllerInfo && retryCount < maxRetries) {
                  try {
                    // Use fetchWithTimeout with a 500ms timeout
                    const infoResponse = await fetchWithTimeout(
                      `http://${controller.ip_address}/info`,
                      {},
                      500, // 500ms timeout
                    );

                    if (infoResponse.ok) {
                      controllerInfo = await infoResponse.json();
                    } else {
                      retryCount++;
                      updateStatus(
                        controller,
                        "checking",
                        `Connection attempt ${retryCount}/${maxRetries} failed, retrying...`,
                      );
                      await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait 1 second between retries
                    }
                  } catch (error) {
                    retryCount++;
                    const errorMessage =
                      error.name === "AbortError"
                        ? "Connection timed out (500ms)"
                        : error.message;

                    updateStatus(
                      controller,
                      "checking",
                      `Attempt ${retryCount}/${maxRetries} failed: ${errorMessage}`,
                    );

                    if (retryCount >= maxRetries) {
                      break;
                    }

                    await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait 1 second between retries
                  }
                }

                // If controller info couldn't be fetched after retries
                if (!controllerInfo) {
                  updateStatus(
                    controller,
                    "failed",
                    "Could not connect to controller after multiple attempts",
                  );
                  results.failed++;
                  results.details.push({
                    controller: controller.hostname,
                    status: "failed",
                    reason: "Connection failed after multiple attempts",
                  });
                  updateUI();
                  return;
                }

                // Successfully got controller info, now process it
                const { soc, build_type, git_version, uptime } = controllerInfo;
                updateStatus(
                  controller,
                  "checking",
                  `Controller information: SOC=${soc}, type=${build_type}, version=${git_version}, uptime=${uptime}`,
                );

                // Find matching firmware - note that firmware uses 'type' instead of 'build_type'
                const matchingFirmware = firmwareData.firmware.find(
                  (fw) => fw.soc === soc && fw.type === build_type,
                );

                if (!matchingFirmware) {
                  // Look for fallback firmware with matching SOC
                  const fallbackFirmware = firmwareData.firmware.find(
                    (fw) => fw.soc === soc,
                  );

                  if (fallbackFirmware) {
                    updateStatus(
                      controller,
                      "updating",
                      `No exact firmware match found. Using fallback: ${fallbackFirmware.soc}/${fallbackFirmware.type} v${fallbackFirmware.version}`,
                    );

                    // Update with fallback firmware and pass uptime for reboot verification
                    const updateResult = await updateController(
                      fallbackFirmware,
                      controller,
                      uptime,
                    );

                    if (updateResult.success) {
                      let statusMessage = "Updated with fallback firmware";

                      // Add reboot verification details if available
                      if (updateResult.rebootVerified) {
                        statusMessage += ` and reboot verified (new uptime: ${updateResult.newUptime})`;
                      } else if (updateResult.message) {
                        statusMessage += `. ${updateResult.message}`;
                      }

                      updateStatus(
                        controller,
                        "success",
                        statusMessage,
                        git_version,
                        fallbackFirmware.version,
                      );

                      results.success++;
                      results.details.push({
                        controller: controller.hostname,
                        status: "success",
                        from: git_version,
                        to: fallbackFirmware.version,
                        note: "Used fallback firmware",
                        rebootVerified: updateResult.rebootVerified,
                        message: updateResult.message,
                      });
                    } else {
                      updateStatus(
                        controller,
                        "failed",
                        "Update failed with fallback firmware",
                      );

                      results.failed++;
                      results.details.push({
                        controller: controller.hostname,
                        status: "failed",
                        reason: "Update process failed with fallback firmware",
                      });
                    }
                  } else {
                    // No fallback available
                    updateStatus(
                      controller,
                      "skipped",
                      `No matching firmware found for SOC: ${soc}, type: ${build_type}`,
                    );

                    results.skipped++;
                    results.details.push({
                      controller: controller.hostname,
                      status: "skipped",
                      reason: `No matching firmware found for SOC: ${soc}, type: ${build_type}`,
                    });
                  }

                  updateUI();
                  return;
                }

                // Skip if already on latest version
                if (git_version === matchingFirmware.version) {
                  updateStatus(
                    controller,
                    "skipped",
                    `Already on latest version (${matchingFirmware.version})`,
                  );

                  results.skipped++;
                  results.details.push({
                    controller: controller.hostname,
                    status: "skipped",
                    reason: `Already on latest version (${matchingFirmware.version})`,
                  });

                  updateUI();
                  return;
                }

                // Update the controller with matching firmware
                updateStatus(
                  controller,
                  "updating",
                  `Updating to version ${matchingFirmware.version}`,
                );

                const updateResult = await updateController(
                  matchingFirmware,
                  controller,
                  uptime,
                );

                if (updateResult.success) {
                  let statusMessage = "Update completed successfully";

                  // Add reboot verification details if available
                  if (updateResult.rebootVerified) {
                    statusMessage += ` and reboot verified (new uptime: ${updateResult.newUptime})`;
                  } else if (updateResult.message) {
                    statusMessage += `. ${updateResult.message}`;
                  }

                  updateStatus(
                    controller,
                    "success",
                    statusMessage,
                    git_version,
                    matchingFirmware.version,
                  );

                  results.success++;
                  results.details.push({
                    controller: controller.hostname,
                    status: "success",
                    from: git_version,
                    to: matchingFirmware.version,
                    rebootVerified: updateResult.rebootVerified,
                    message: updateResult.message,
                  });
                } else {
                  updateStatus(controller, "failed", "Update process failed");

                  results.failed++;
                  results.details.push({
                    controller: controller.hostname,
                    status: "failed",
                    reason: "Update process failed",
                  });
                }

                updateUI();
              } catch (error) {
                console.error(
                  `Error processing ${controller.hostname}:`,
                  error,
                );

                updateStatus(controller, "failed", `Error: ${error.message}`);

                results.failed++;
                results.details.push({
                  controller: controller.hostname,
                  status: "failed",
                  reason: error.message,
                });

                updateUI();
              }
            });

            // Wait for all controllers to be processed in parallel
            await Promise.all(updatePromises);

            // Final UI update after all controllers are done
            updateUI();

            // Set up the update local button
            const updateLocalBtn = document.getElementById("update-local-btn");
            if (updateLocalBtn) {
              updateLocalBtn.onclick = async () => {
                // Hide the button to prevent multiple clicks
                const localControllerUpdateDiv = document.getElementById(
                  "local-controller-update",
                );
                if (localControllerUpdateDiv) {
                  localControllerUpdateDiv.style.display = "none";
                }

                // Show the local controller in the list
                const localControllerEl =
                  document.getElementById("status-local");
                if (localControllerEl) {
                  localControllerEl.style.display = "block";
                }

                await updateLocalController(firmwareData);
              };
            }

            updating.value = false;
          } catch (error) {
            updating.value = false;
            console.error("Error in update all process:", error);
            Dialog.create({
              title: "Error",
              message: `Error updating all controllers: ${error.message}`,
              color: "negative",
              icon: "report_problem",
              persistent: true,
            });
          }
        })
        .onCancel(() => {
          updating.value = false;
        });
    };

    return {
      otaUrl,
      firmware,
      fetchFirmware,
      infoData,
      updateAllControllers,
      updating,
    };
  },
};
</script>

<style>
.controller-status {
  border-bottom: 1px solid #eee;
  padding-bottom: 8px;
}

.controller-status:last-child {
  border-bottom: none;
}

.status-indicator {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 6px;
  border-radius: 12px;
  font-size: 0.8em;
}

.status-indicator.waiting {
  color: #666;
}

.status-indicator.checking {
  color: #1976d2;
}

.status-indicator.updating {
  color: #ff9800;
}

.status-indicator.success {
  color: #4caf50;
}

.status-indicator.failed {
  color: #f44336;
}

.status-indicator.skipped {
  color: #ff9800;
}

.details {
  font-size: 0.85em;
  line-height: 1.4;
}
</style>
