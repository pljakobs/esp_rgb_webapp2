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
      Current: firmware: {{ infoData.data.app?.git_version }} webapp:
      {{ infoData.data.app?.webapp_version }}
    </q-card-section>
  </MyCard>
</template>

<script>
import { ref, nextTick, createApp, h, onUnmounted, watch } from "vue";
import { Dialog, Notify } from "quasar";
import { configDataStore } from "src/stores/configDataStore";
import { infoDataStore, normalizeInfoData } from "src/stores/infoDataStore";
import { useControllersStore } from "src/stores/controllersStore";
import useWebSocket, { wsStatus } from "src/services/websocket.js";
import MyCard from "src/components/myCard.vue";
import FirmwareSelectDialog from "src/components/Dialogs/firmwareSelectDialog.vue";
import FirmwareUpdateProgressDialog from "src/components/Dialogs/firmwareUpdateProgressDialog.vue";
import ControllerSelectionDialog from "src/components/Dialogs/ControllerSelectionDialog.vue";
import svgIcon from "src/components/svgIcon.vue";

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

    // OTA progress state driven by WebSocket
    const otaProgress = ref({
      step: 0,
      message: "",
      active: false,
      reloadCountdown: 4,
      fallbackMode: false, // true when firmware doesn't send ota_status messages
      timeFraction: 0, // 0→1 over 20s in fallback mode
      statusHistory: [], // ordered list of status messages received
      willReboot: false, // step 0 but device is rebooting (watchdog)
    });
    let reloadTimer = null;
    let countdownTimer = null;
    let fallbackProgressInterval = null;
    let fallbackReloadTimer = null;
    let otaProgressDialog = null;

    const ws = useWebSocket();

    // If the socket drops while a WS-driven OTA is active (step >= 1),
    // the firmware sent step 4 and rebooted before the message was delivered.
    // Treat it as an implicit step 4 so the UI transitions and reloads.
    watch(
      () => ws.status.value,
      (newStatus) => {
        if (
          newStatus === wsStatus.FAILED &&
          otaProgress.value.active &&
          !otaProgress.value.fallbackMode &&
          otaProgress.value.step >= 1
        ) {
          otaProgress.value.step = 4;
          otaProgress.value.message = "Device rebooting...";
          otaProgress.value.reloadCountdown = 4;
          clearTimeout(reloadTimer);
          clearInterval(countdownTimer);
          countdownTimer = setInterval(() => {
            otaProgress.value.reloadCountdown -= 1;
            if (otaProgress.value.reloadCountdown <= 0) {
              clearInterval(countdownTimer);
            }
          }, 1000);
          reloadTimer = setTimeout(() => {
            clearInterval(countdownTimer);
            const url = new URL(window.location.href);
            url.searchParams.set("_t", Date.now());
            window.location.replace(url.toString());
          }, 4000);
        }
      },
    );
    ws.onJson("ota_status", (params) => {
      // Switch from time-based to WS-driven mode on first message
      clearInterval(fallbackProgressInterval);
      fallbackProgressInterval = null;
      clearTimeout(fallbackReloadTimer);
      fallbackReloadTimer = null;

      const step = params?.status ?? 0;
      const message = params?.message ?? "";
      otaProgress.value.active = true;
      otaProgress.value.fallbackMode = false;
      otaProgress.value.step = step;
      otaProgress.value.message = message;

      // Append non-empty messages to the history log
      if (message) {
        otaProgress.value.statusHistory.push(message);
      }

      if (step === 4) {
        // Step 4: OTA successful, device is rebooting — reload after countdown
        otaProgress.value.reloadCountdown = 4;
        countdownTimer = setInterval(() => {
          otaProgress.value.reloadCountdown -= 1;
          if (otaProgress.value.reloadCountdown <= 0) {
            clearInterval(countdownTimer);
          }
        }, 1000);
        reloadTimer = setTimeout(() => {
          clearInterval(countdownTimer);
          // Cache-busting reload: append timestamp query param
          const url = new URL(window.location.href);
          url.searchParams.set("_t", Date.now());
          window.location.replace(url.toString());
        }, 4000);
      } else if (step === 0) {
        clearTimeout(reloadTimer);
        clearInterval(countdownTimer);
        // If the firmware is rebooting after the failure (watchdog timeout),
        // start an auto-reload so the UI recovers after the device comes back up
        if (message.toLowerCase().includes("rebooting")) {
          otaProgress.value.willReboot = true;
          otaProgress.value.reloadCountdown = 12;
          countdownTimer = setInterval(() => {
            otaProgress.value.reloadCountdown -= 1;
            if (otaProgress.value.reloadCountdown <= 0) {
              clearInterval(countdownTimer);
            }
          }, 1000);
          reloadTimer = setTimeout(() => {
            clearInterval(countdownTimer);
            const url = new URL(window.location.href);
            url.searchParams.set("_t", Date.now());
            window.location.replace(url.toString());
          }, 12000);
        }
      }
    });

    onUnmounted(() => {
      clearTimeout(reloadTimer);
      clearInterval(countdownTimer);
      clearInterval(fallbackProgressInterval);
      clearTimeout(fallbackReloadTimer);
      if (otaProgressDialog) {
        otaProgressDialog.hide();
        otaProgressDialog = null;
      }
    });

    const cleanupMountedIcons = () => {
      document.querySelectorAll(".status-icon").forEach((container) => {
        if (container.__iconApp) {
          container.__iconApp.unmount();
          delete container.__iconApp;
        }
      });
    };

    const mountIndicatorIcon = (indicatorEl, iconName, classes = []) => {
      if (!indicatorEl) {
        return;
      }

      const iconContainer = indicatorEl.querySelector(".status-icon");
      if (!iconContainer) {
        return;
      }

      if (iconContainer.__iconApp) {
        iconContainer.__iconApp.unmount();
        delete iconContainer.__iconApp;
      }

      iconContainer.innerHTML = "";

      if (!iconName) {
        return;
      }

      const app = createApp({
        render() {
          return h(svgIcon, {
            name: iconName,
            size: "1.2em",
            class: classes,
          });
        },
      });

      app.mount(iconContainer);
      iconContainer.__iconApp = app;
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

    const fetchControllerInfo = async (controller, timeout = 500) => {
      const baseUrl = `http://${controller.ip_address}`;
      const endpoints = ["info?v=2", "info"];

      let lastError = null;
      for (const endpoint of endpoints) {
        try {
          const response = await fetchWithTimeout(
            `${baseUrl}/${endpoint}`,
            {},
            timeout,
          );
          if (response.ok) {
            return normalizeInfoData(await response.json());
          }
          if (response.status === 404) {
            continue;
          }
          lastError = new Error(`HTTP ${response.status} on ${endpoint}`);
        } catch (error) {
          lastError = error;
        }
      }

      throw lastError || new Error("Unable to fetch controller info");
    };

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

        // Extract branch from git_version (e.g., "V5.0-331-develop" → "develop")
        const getBranchFromVersion = (versionString) => {
          if (!versionString) return "stable";
          const parts = versionString.split("-");
          return parts.length > 2 ? parts[parts.length - 1] : "stable";
        };

        // Create a combined array of firmware options from both firmware and history arrays
        const allFirmwareOptions = [];

        // First, process the main firmware array
        if (data.firmware && Array.isArray(data.firmware)) {
          data.firmware.forEach((fw) => {
            // Only include firmware for the current SOC
            if (
              fw.soc?.toLowerCase() === infoData.data.device?.soc?.toLowerCase()
            ) {
              // Ensure all required properties exist
              const firmwareOption = {
                ...fw,
                // Make sure fw_version exists (prioritize fw_version if both exist)
                fw_version: fw.fw_version || fw.version,
              };
              allFirmwareOptions.push(firmwareOption);
            }
          });
        }

        // Then, process the history array
        if (data.history && Array.isArray(data.history)) {
          data.history.forEach((histItem) => {
            // Only include firmware for the current SOC
            if (
              histItem.soc?.toLowerCase() ===
              infoData.data.device?.soc?.toLowerCase()
            ) {
              // Skip if this exact version is already in the options
              const isDuplicate = allFirmwareOptions.some(
                (fw) =>
                  fw.branch === histItem.branch &&
                  fw.type === histItem.type &&
                  fw.fw_version === histItem.fw_version,
              );

              if (!isDuplicate) {
                // Ensure all required properties exist
                const historyOption = {
                  ...histItem,
                  // Make sure fw_version exists (prioritize fw_version if both exist)
                  fw_version: histItem.fw_version || histItem.version,
                };
                allFirmwareOptions.push(historyOption);
              }
            }
          });
        }

        // Set available firmware to our combined and filtered list
        availableFirmware.value = allFirmwareOptions;

        // Sort by version and put current build type first for better UX
        availableFirmware.value.sort((a, b) => {
          // Put current build type first
          if (
            a.type?.toLowerCase() ===
              infoData.data.app?.build_type?.toLowerCase() &&
            b.type?.toLowerCase() !==
              infoData.data.app?.build_type?.toLowerCase()
          )
            return -1;
          if (
            a.type?.toLowerCase() !==
              infoData.data.app?.build_type?.toLowerCase() &&
            b.type?.toLowerCase() ===
              infoData.data.app?.build_type?.toLowerCase()
          )
            return 1;

          // Then sort by version (assuming semantic versioning)
          return b.fw_version.localeCompare(a.fw_version, undefined, {
            numeric: true,
          });
        });

        console.log("Available firmware:", availableFirmware.value);
        console.log("About to show firmware selection dialog...");

        // Show the firmware selection dialog
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
      try {
        console.log(
          "Creating firmware selection dialog with options:",
          availableFirmware.value,
        );

        // First check if there are any options
        if (availableFirmware.value.length === 0) {
          console.log("No firmware options available, showing simple dialog");
          Dialog.create({
            title: "No Firmware Available",
            message: "No compatible firmware was found for your device.",
            persistent: true,
          });
          return;
        }

        // Add the current branch to the current info
        const getBranchFromVersion = (versionString) => {
          if (!versionString) return "develop";
          const parts = versionString.split("-");
          return parts.length > 2 ? parts[parts.length - 1] : "develop";
        };

        // Create a copy of infoData.data and add branch property
        const currentInfoWithBranch = {
          ...infoData.data,
          branch: getBranchFromVersion(infoData.data.app?.git_version),
        };

        // Use the component-based dialog
        Dialog.create({
          component: FirmwareSelectDialog,
          componentProps: {
            firmwareOptions: availableFirmware.value,
            currentInfo: currentInfoWithBranch,
            otaUrl: otaUrl.value,
          },
          persistent: true,
        })
          .onOk(async (selectedFirmware) => {
            console.log("Dialog OK with firmware:", selectedFirmware);
            if (selectedFirmware) {
              await updateController(
                selectedFirmware,
                controllersStore.currentController,
              );
            } else {
              console.error("No firmware selected");
            }
          })
          .onCancel(() => {
            console.log("Firmware selection cancelled");
          });
      } catch (error) {
        console.error("Error creating firmware dialog:", error);
        // Fallback to a basic dialog
        Dialog.create({
          title: "Error",
          message: `Could not create firmware selection dialog: ${error.message}`,
          color: "negative",
          icon: "report_problem",
          persistent: true,
        });
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

        // For the current controller: reset state and start the fallback timer
        // BEFORE sending the POST. The firmware can send ota_status WS messages
        // before the HTTP response arrives, so we must not reset state after fetch().
        if (controller.id === controllersStore.currentController.id) {
          clearInterval(fallbackProgressInterval);
          clearTimeout(fallbackReloadTimer);

          const totalDuration = 20000;
          const tickInterval = 100;
          let elapsed = 0;

          otaProgress.value = {
            step: 0,
            message: "Updating firmware...",
            active: true,
            reloadCountdown: 4,
            fallbackMode: true,
            timeFraction: 0,
            statusHistory: [],
            willReboot: false,
          };

          fallbackProgressInterval = setInterval(() => {
            elapsed += tickInterval;
            otaProgress.value.timeFraction = Math.min(
              elapsed / totalDuration,
              1,
            );
            if (elapsed >= totalDuration) {
              clearInterval(fallbackProgressInterval);
            }
          }, tickInterval);

          fallbackReloadTimer = setTimeout(() => {
            clearInterval(fallbackProgressInterval);
            const url = new URL(window.location.href);
            url.searchParams.set("_t", Date.now());
            window.location.replace(url.toString());
          }, totalDuration);

          // Open progress dialog immediately so users get instant feedback
          // even if HTTP/WS startup takes a while.
          if (otaProgressDialog) {
            otaProgressDialog.hide();
          }
          otaProgressDialog = Dialog.create({
            component: FirmwareUpdateProgressDialog,
            componentProps: { otaProgress },
            persistent: true,
          });
        }

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
          // Cancel fallback timers — update never started
          if (controller.id === controllersStore.currentController.id) {
            clearInterval(fallbackProgressInterval);
            clearTimeout(fallbackReloadTimer);
            otaProgress.value = {
              ...otaProgress.value,
              active: true,
              fallbackMode: false,
              step: 0,
              message: `Update request failed (HTTP ${postResponse.status})`,
              willReboot: false,
            };
            otaProgress.value.statusHistory.push(
              `Update request failed (HTTP ${postResponse.status})`,
            );
          } else {
            Dialog.create({
              title: "Update failed",
              message: `Update failed for ${controller.hostname}! status: ${postResponse.status}`,
              color: "negative",
              icon: "report_problem",
              persistent: true,
            });
          }
          return { success: false };
        }

        // For batch updates, verify reboot by checking uptime
        if (initialUptime !== null) {
          // Wait 30 seconds before polling — ESP8266 OTA download + flash takes ~30-60s,
          // and polling during active flash writes burns TCP slots to no effect.
          await new Promise((resolve) => setTimeout(resolve, 30000));

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
                const infoData = await fetchControllerInfo(controller, 500);

                // If we get a response, check the uptime
                if (infoData) {
                  newUptime = infoData.runtime?.uptime;

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

      // Ping all controllers to determine reachability
      const pingController = async (controller) => {
        try {
          const response = await fetch(`http://${controller.ip_address}/ping`, {
            method: "GET",
            timeout: 1000,
          });
          if (response.ok) {
            const data = await response.json();
            return data.ping === "pong";
          }
        } catch (e) {}
        return false;
      };

      const pingResults = await Promise.all(
        controllersStore.data.map(async (controller) => {
          const reachable = await pingController(controller);
          return { ...controller, reachable };
        }),
      );

      // Controllers to include: all reachable
      const availableControllers = pingResults.filter((c) => c.reachable);
      // Unreachable but flagged visible
      const unreachableVisible = pingResults.filter(
        (c) => c.visible && !c.reachable,
      );
      // Reachable but not flagged visible
      const reachableNotVisible = pingResults.filter(
        (c) => !c.visible && c.reachable,
      );
      // Excluded: unreachable
      const excludedControllers = pingResults.filter((c) => !c.reachable);

      if (availableControllers.length === 0) {
        Dialog.create({
          title: "No Controllers Reachable",
          message: `No controllers are reachable for update.<br><br>
            Total controllers: ${controllersStore.data.length}<br>
            Visible (online): ${controllersStore.data.filter((c) => c.visible === true).length}<br>
            Current controller: ${controllersStore.currentController.hostname}`,
          html: true,
          persistent: true,
        });
        updating.value = false;
        return;
      }

      // Compose summary note
      const summaryNote = `
        <div class="q-mb-md">
          <b>Controller reachability summary:</b><br>
          <ul>
            <li><b>${unreachableVisible.length}</b> controller(s) flagged visible but unreachable.</li>
            <li><b>${reachableNotVisible.length}</b> controller(s) not flagged visible but reachable.</li>
            <li><b>${excludedControllers.length}</b> controller(s) excluded (unreachable):<br>
              <ul>
                ${excludedControllers.map((c) => `<li>${c.hostname} (${c.ip_address})${c.visible ? " [visible]" : ""}</li>`).join("")}
              </ul>
            </li>
          </ul>
        </div>
      `;

      // Add the summary as a collapsible div at the top of the selection dialog
      const summaryDropdown = `
        <details style="margin-bottom: 1em;">
          <summary style="cursor:pointer;font-weight:bold;">Controller reachability summary</summary>
          ${summaryNote}
        </details>
      `;

      Dialog.create({
        component: ControllerSelectionDialog,
        componentProps: {
          controllers: availableControllers,
        },
        message: summaryDropdown,
        html: true,
      })
        .onOk(async (selectedControllers) => {
          // selectedControllers contains the array of selected controller objects
          if (!selectedControllers || selectedControllers.length === 0) {
            updating.value = false;
            return;
          }

          console.log("Updating selected controllers:", selectedControllers);

          let firmwareData;
          let initialLoadingDialog = null;
          try {
            if (!firmware.value) {
              // Show initial loading dialog while fetching firmware info
              initialLoadingDialog = Dialog.create({
                title: "Preparing Update",
                message: "Fetching firmware information...",
                progress: {
                  indeterminate: true,
                },
                persistent: true,
              });
              // Fetch firmware data
              const response = await fetch(otaUrl.value, {
                method: "GET",
                headers: {
                  "Content-Type": "application/json",
                },
              });
              if (!response.ok) {
                if (initialLoadingDialog) initialLoadingDialog.hide();
                throw new Error(`HTTP error! status: ${response.status}`);
              }
              firmwareData = await response.json();
            } else {
              firmwareData = firmware.value;
            }

            if (initialLoadingDialog) initialLoadingDialog.hide();

            console.log("Firmware data:", firmwareData);

            // Use the selected controllers
            const allControllers = selectedControllers;

            console.log("Starting update for controllers:", allControllers);

            // Results tracking
            const results = {
              success: 0,
              failed: 0,
              skipped: 0,
              details: [],
            };

            // Create monitor dialog with a component-based approach
            const monitorDialog = Dialog.create({
              title: "Firmware Update Monitor",
              html: true,
              style: {
                width: "80vw",
                maxWidth: "100vw",
              },
              message: `<div id="monitor-content">
                  <div class="text-weight-medium q-mb-md">Updating ${allControllers.length} controllers</div>
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
                              <div class="status-icon"></div>
                              <span class="status-label">Waiting</span>
                            </div>
                          </div>
                        </div>
                        <div id="details-${controller.id}" class="details q-mt-sm q-pa-xs rounded-borders" style="display:none;"></div>
                      </div>`,
                      )
                      .join("")}
                  </div>
                  <div id="completion-message" class="q-mt-md text-center" style="display: none;">
                    <div class="text-h6 text-positive">Update process complete!</div>
                  </div>
                </div>`,
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

            monitorDialog.onDismiss(() => {
              cleanupMountedIcons();
            });

            nextTick(() => {
              document
                .querySelectorAll(".status-indicator")
                .forEach((indicator) => {
                  mountIndicatorIcon(indicator, "timer", ["text-grey-6"]);
                });
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
                const statusId = `status-${controller.id}`;
                const detailsId = `details-${controller.id}`;

                const statusEl = document.getElementById(statusId);
                if (!statusEl) return;

                // Update status indicator
                const indicator = statusEl.querySelector(".status-indicator");
                if (indicator) {
                  indicator.className = `q-mr-xs status-indicator ${status}`;

                  const statusConfigMap = {
                    checking: {
                      icon: "refresh",
                      label: "Checking",
                      classes: ["text-primary", "spin"],
                    },
                    updating: {
                      icon: "refresh",
                      label: "Updating",
                      classes: ["text-orange", "spin"],
                    },
                    success: {
                      icon: "check_circle",
                      label: "Success",
                      classes: ["text-positive"],
                    },
                    failed: {
                      icon: "error",
                      label: "Failed",
                      classes: ["text-negative"],
                    },
                    skipped: {
                      icon: "info",
                      label: "Skipped",
                      classes: ["text-amber"],
                    },
                  };

                  const defaultConfig = {
                    icon: "timer",
                    label: "Waiting",
                    classes: ["text-grey-6"],
                  };

                  const { icon, label, classes } =
                    statusConfigMap[status] || defaultConfig;

                  let labelEl = indicator.querySelector(".status-label");
                  if (!labelEl) {
                    indicator.innerHTML =
                      '<div class="status-icon"></div><span class="status-label"></span>';
                    labelEl = indicator.querySelector(".status-label");
                  }

                  if (labelEl) {
                    labelEl.textContent = label;
                  }

                  mountIndicatorIcon(indicator, icon, classes);
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

            const getBranchFromVersion = (versionString) => {
              if (!versionString) return "stable";
              const parts = versionString.split("-");
              return parts.length > 2 ? parts[parts.length - 1] : "stable";
            };

            // Fix the updateLocalController function
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
                const uptime = infoData.data.runtime?.uptime;
                const soc = infoData.data.device?.soc?.toLowerCase();
                const build_type = infoData.data.app?.build_type?.toLowerCase();
                const git_version = infoData.data.app?.git_version;

                // Extract branch from version and show controller info
                const controllerBranch = getBranchFromVersion(git_version);
                updateStatus(
                  localController, // Fixed: should reference localController, not controller
                  "checking",
                  `Controller information: SOC=${soc}, type=${build_type}, branch=${controllerBranch}, version=${git_version}, uptime=${uptime}`,
                );

                // Find matching firmware with branch consideration
                const matchingFirmware = firmwareData.firmware.find(
                  (fw) =>
                    fw.soc?.toLowerCase() === soc &&
                    fw.type?.toLowerCase() === build_type &&
                    (fw.branch || "stable").toLowerCase() === controllerBranch,
                );

                if (matchingFirmware) {
                  // We found an exact match
                  updateStatus(
                    localController,
                    "updating",
                    `Updating to version ${
                      matchingFirmware.fw_version || matchingFirmware.version
                    }`,
                  );

                  const updateResult = await updateController(
                    matchingFirmware,
                    localController,
                    uptime,
                  );

                  if (updateResult.success) {
                    let statusMessage = "Update completed successfully";
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
                      matchingFirmware.fw_version || matchingFirmware.version,
                    );
                  } else {
                    updateStatus(
                      localController,
                      "failed",
                      "Update process failed",
                    );
                  }
                  return;
                }

                // No exact match found, try fallbacks
                // 1. Same SOC and branch, any build type
                let fallbackFirmware = firmwareData.firmware.find(
                  (fw) =>
                    fw.soc?.toLowerCase() === soc &&
                    (fw.branch || "stable").toLowerCase() === controllerBranch,
                );

                // 2. Same SOC and build type, any branch
                if (!fallbackFirmware) {
                  fallbackFirmware = firmwareData.firmware.find(
                    (fw) =>
                      fw.soc?.toLowerCase() === soc &&
                      fw.type?.toLowerCase() === build_type,
                  );
                }

                // 3. Same SOC, any branch, any build type (most generic fallback)
                if (!fallbackFirmware) {
                  fallbackFirmware = firmwareData.firmware.find(
                    (fw) => fw.soc?.toLowerCase() === soc,
                  );
                }

                if (fallbackFirmware) {
                  const fallbackBranch = fallbackFirmware.branch || "stable";
                  const fallbackDescription = `${fallbackFirmware.soc}/${fallbackFirmware.type}/${fallbackBranch}`;
                  const fallbackVersion =
                    fallbackFirmware.fw_version || fallbackFirmware.version;

                  updateStatus(
                    localController,
                    "updating",
                    `No exact firmware match found. Using fallback: ${fallbackDescription} v${fallbackVersion}`,
                  );

                  // Update with fallback firmware
                  const updateResult = await updateController(
                    fallbackFirmware,
                    localController,
                    uptime,
                  );

                  if (updateResult.success) {
                    let statusMessage =
                      "Update completed successfully with fallback firmware";
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
                      fallbackVersion,
                    );
                  } else {
                    updateStatus(
                      localController,
                      "failed",
                      "Update process failed",
                    );
                  }
                } else {
                  // No fallback found
                  updateStatus(
                    localController,
                    "skipped",
                    `No matching firmware found for SOC: ${soc}, type: ${build_type}, branch: ${controllerBranch}`,
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
                    controllerInfo = await fetchControllerInfo(controller, 500);
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
                const soc = controllerInfo.device?.soc?.toLowerCase();
                const build_type =
                  controllerInfo.app?.build_type?.toLowerCase();
                const git_version = controllerInfo.app?.git_version;
                const uptime = controllerInfo.runtime?.uptime;

                // Extract branch from version and show controller info
                const controllerBranch = getBranchFromVersion(git_version);
                updateStatus(
                  controller,
                  "checking",
                  `Controller information: SOC=${soc}, type=${build_type}, branch=${controllerBranch}, version=${git_version}, uptime=${uptime}`,
                );

                // Find matching firmware with branch consideration
                const matchingFirmware = firmwareData.firmware.find(
                  (fw) =>
                    fw.soc?.toLowerCase() === soc &&
                    fw.type?.toLowerCase() === build_type &&
                    (fw.branch || "stable").toLowerCase() === controllerBranch,
                );

                if (!matchingFirmware) {
                  // Try different fallback options with decreasing specificity
                  // 1. Same SOC and branch, any build type
                  let fallbackFirmware = firmwareData.firmware.find(
                    (fw) =>
                      fw.soc?.toLowerCase() === soc &&
                      (fw.branch || "stable").toLowerCase() ===
                        controllerBranch,
                  );

                  // 2. Same SOC and build type, any branch
                  if (!fallbackFirmware) {
                    fallbackFirmware = firmwareData.firmware.find(
                      (fw) =>
                        fw.soc?.toLowerCase() === soc &&
                        fw.type?.toLowerCase() === build_type,
                    );
                  }

                  // 3. Same SOC, any branch, any build type (most generic fallback)
                  if (!fallbackFirmware) {
                    fallbackFirmware = firmwareData.firmware.find(
                      (fw) => fw.soc?.toLowerCase() === soc,
                    );
                  }

                  if (fallbackFirmware) {
                    const fallbackBranch = fallbackFirmware.branch || "stable";
                    const fallbackDescription = `${fallbackFirmware.soc}/${fallbackFirmware.type}/${fallbackBranch}`;
                    const fallbackVersion =
                      fallbackFirmware.fw_version || fallbackFirmware.version;

                    updateStatus(
                      controller,
                      "updating",
                      `No exact firmware match found. Using fallback: ${fallbackDescription} v${fallbackVersion}`,
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
                        fallbackVersion,
                      );

                      results.success++;
                      results.details.push({
                        controller: controller.hostname,
                        status: "success",
                        from: git_version,
                        to: fallbackVersion,
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
                      `No matching firmware found for SOC: ${soc}, type: ${build_type}, branch: ${controllerBranch}`,
                    );

                    results.skipped++;
                    results.details.push({
                      controller: controller.hostname,
                      status: "skipped",
                      reason: `No matching firmware found for SOC: ${soc}, type: ${build_type}, branch: ${controllerBranch}`,
                    });
                  }

                  updateUI();
                  return;
                }

                // Skip if already on latest version
                if (
                  git_version ===
                  (matchingFirmware.fw_version || matchingFirmware.version)
                ) {
                  updateStatus(
                    controller,
                    "skipped",
                    `Already on latest version (${
                      matchingFirmware.fw_version || matchingFirmware.version
                    })`,
                  );

                  results.skipped++;
                  results.details.push({
                    controller: controller.hostname,
                    status: "skipped",
                    reason: `Already on latest version (${
                      matchingFirmware.fw_version || matchingFirmware.version
                    })`,
                  });

                  updateUI();
                  return;
                }

                // Update the controller with matching firmware
                updateStatus(
                  controller,
                  "updating",
                  `Updating to version ${
                    matchingFirmware.fw_version || matchingFirmware.version
                  }`,
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
                    matchingFirmware.fw_version || matchingFirmware.version,
                  );

                  results.success++;
                  results.details.push({
                    controller: controller.hostname,
                    status: "success",
                    from: git_version,
                    to: matchingFirmware.fw_version || matchingFirmware.version,
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

  .status-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .status-label {
    display: inline-flex;
    align-items: center;
  }

  .spin svg {
    animation: icon-spin 1s linear infinite;
  }

  @keyframes icon-spin {
    100% {
      transform: rotate(360deg);
    }
  }
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

.inline-icon {
  display: inline-flex;
  align-items: center;
  vertical-align: middle;
  margin-right: 4px;
}

.inline-icon img {
  display: block;
  width: 1em;
  height: 1em;
}

.text-positive img {
  filter: invert(48%) sepia(79%) saturate(2476%) hue-rotate(86deg)
    brightness(90%) contrast(85%);
}

.text-negative img {
  filter: invert(27%) sepia(51%) saturate(7497%) hue-rotate(346deg)
    brightness(97%) contrast(105%);
}

.text-amber img {
  filter: invert(63%) sepia(57%) saturate(4548%) hue-rotate(2deg)
    brightness(109%) contrast(102%);
}
</style>
