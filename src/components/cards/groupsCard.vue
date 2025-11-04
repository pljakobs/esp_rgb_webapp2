<template>
  <MyCard icon="light_group" title="Groups">
    <q-card-section class="flex justify-center">
      <q-scroll-area class="inset-scroll-area">
        <div v-if="isLoading" class="text-center q-pa-md">
          <q-spinner color="primary" size="lg" />
          <div class="q-mt-sm">Processing...</div>
        </div>
        <div v-else-if="treeNodes && treeNodes.length > 0">
          <q-tree
            :nodes="treeNodes"
            node-key="id"
            :expanded="expandedNodes"
            @update:expanded="onExpandedChange"
            :accordion="true"
            no-icons
          >
            <template v-slot:default-header="prop">
              <div class="row items-center full-width q-py-xs">
                <!-- Custom expand/collapse toggle -->
                <div
                  v-if="prop.node.children && prop.node.children.length > 0"
                  class="q-mr-xs cursor-pointer"
                  @click.stop="toggleNode(prop.node)"
                >
                  <svgIcon
                    name="arrow_drop_down"
                    size="20px"
                    :class="{ 'rotate-right': !isExpanded(prop.node.id) }"
                  />
                </div>
                <div
                  v-else
                  class="q-mr-xs"
                  style="width: 24px; height: 24px"
                ></div>

                <!-- Node icon and label -->
                <div class="col row items-center no-wrap">
                  <div class="q-mr-sm">
                    <svgIcon
                      v-if="prop.node.nodeType === 'group'"
                      name="light_group"
                      size="20px"
                      class="text-primary"
                    />
                    <svgIcon
                      v-else-if="prop.node.nodeType === 'controller'"
                      :name="
                        prop.node.data.visible === false
                          ? 'visibility_off_outlined'
                          : 'hub_outlined'
                      "
                      size="18px"
                      :class="
                        prop.node.data.visible === false
                          ? 'text-grey-6'
                          : 'text-primary'
                      "
                    />
                  </div>
                  <div class="text-weight-medium">
                    <div>{{ prop.node.label }}</div>
                    <div
                      v-if="prop.node.nodeType === 'group'"
                      class="text-caption text-grey-6"
                    >
                      {{ prop.node.controllerCount }} controllers
                    </div>
                    <div
                      v-else-if="prop.node.nodeType === 'controller'"
                      class="text-caption text-grey-6"
                    >
                      {{ prop.node.data.ip_address }}
                    </div>
                  </div>
                </div>

                <!-- Status badge for controllers -->
                <div
                  class="col-auto"
                  v-if="prop.node.nodeType === 'controller'"
                >
                  <q-badge
                    :color="
                      prop.node.data.visible === false ? 'grey' : 'positive'
                    "
                    :label="
                      prop.node.data.visible === false ? 'Hidden' : 'Active'
                    "
                  />
                </div>

                <!-- Action buttons for groups -->
                <div class="col-auto" v-if="prop.node.nodeType === 'group'">
                  <div class="row q-gutter-xs">
                    <q-btn
                      flat
                      round
                      dense
                      size="sm"
                      color="primary"
                      @click.stop="editGroup(prop.node.data)"
                      :disable="isLoading"
                    >
                      <svgIcon name="edit" size="16px" />
                      <q-tooltip>Edit group</q-tooltip>
                    </q-btn>
                    <q-btn
                      flat
                      round
                      dense
                      size="sm"
                      color="negative"
                      @click.stop="deleteGroup(prop.node.data)"
                      :disable="isLoading"
                    >
                      <svgIcon name="delete" size="16px" />
                      <q-tooltip>Delete group</q-tooltip>
                    </q-btn>
                  </div>
                </div>
              </div>
            </template>
          </q-tree>
        </div>
        <div v-else>
          <div class="no-groups-container">
            <q-card flat class="text-center q-pa-lg">
              <q-card-section>
                <svgIcon name="light_group" size="3rem" class="text-grey-5" />
                <div class="text-h6 q-mt-md text-grey-6">
                  No groups available
                </div>
                <div class="text-body2 text-grey-5 q-mt-sm">
                  Create your first group to organize controllers
                </div>
              </q-card-section>
            </q-card>
          </div>
        </div>
      </q-scroll-area>
    </q-card-section>
    <q-card-section class="flex justify-center">
      <q-btn
        color="primary"
        @click="openDialog"
        :disable="isLoading"
        :loading="isLoading"
        no-caps
      >
        <div class="row items-center no-wrap q-gutter-sm">
          <svgIcon name="add" size="20px" />
          <span>Add Group</span>
        </div>
      </q-btn>
    </q-card-section>
  </MyCard>
</template>

<script>
import { ref, computed } from "vue";
import { Dialog, useQuasar } from "quasar";
import { useAppDataStore } from "src/stores/appDataStore";
import { useControllersStore } from "src/stores/controllersStore";
import MyCard from "src/components/myCard.vue";
import groupDialog from "src/components/Dialogs/groupDialog.vue";

export default {
  name: "groupsCard",
  components: {
    MyCard,
  },
  setup() {
    const appData = useAppDataStore();
    const controllersStore = useControllersStore();
    const $q = useQuasar();
    const isLoading = ref(false);
    const expandedNodes = ref([]);

    const groups = computed(() => {
      return appData.data.groups;
    });

    const controllers = computed(() => {
      return controllersStore.data;
    });

    // Build tree structure for q-tree
    const treeNodes = computed(() => {
      if (!groups.value || groups.value.length === 0) {
        return [];
      }

      return groups.value.map((group) => {
        const groupControllers = getControllers(group.controller_ids);

        return {
          id: `group-${group.id}`,
          label: group.name,
          nodeType: "group",
          data: group,
          controllerCount: groupControllers.length,
          children: groupControllers.map((controller) => ({
            id: `controller-${group.id}-${controller.id}`,
            label: controller.hostname,
            nodeType: "controller",
            data: controller,
          })),
        };
      });
    });

    const showNotification = (type, message, timeout = 3000) => {
      $q.notify({
        type,
        message,
        timeout,
        position: "top",
      });
    };

    const getControllers = (controller_ids) => {
      const controllers_in_group = controllers.value.filter((controller) =>
        controller_ids.map(Number).includes(controller.id),
      );
      return controllers_in_group;
    };

    // Tree interaction methods
    const isExpanded = (nodeId) => {
      return expandedNodes.value.includes(nodeId);
    };

    const toggleNode = (node) => {
      const nodeId = node.id;
      const currentIndex = expandedNodes.value.indexOf(nodeId);

      if (currentIndex >= 0) {
        // Node is expanded, collapse it
        expandedNodes.value = expandedNodes.value.filter((id) => id !== nodeId);
      } else {
        // Node is collapsed, expand it
        expandedNodes.value = [...expandedNodes.value, nodeId];
      }
    };

    const onExpandedChange = (expanded) => {
      expandedNodes.value = expanded;
    };

    const addGroup = () => {
      Dialog.create({
        component: groupDialog,
      })
        .onOk((group) => {
          handleSave(group);
        })
        .onCancel(() => {
          // Dialog canceled - no action needed
        })
        .onDismiss(() => {
          // Dialog dismissed - no action needed
        });
    };

    const editGroup = (group) => {
      Dialog.create({
        component: groupDialog,
        componentProps: {
          group,
        },
      })
        .onOk((group) => {
          handleSave(group);
        })
        .onCancel(() => {
          // Dialog canceled - no action needed
        })
        .onDismiss(() => {
          // Dialog dismissed - no action needed
        });
    };

    const handleSave = async (group) => {
      if (isLoading.value) return;

      isLoading.value = true;
      try {
        await appData.saveGroup(group, (completed, total) => {
          // Optional: Show progress if needed
          // console.log(`Save progress: ${completed}/${total}`);
        });
        showNotification(
          "positive",
          `Group "${group.name}" saved successfully`,
        );
      } catch (error) {
        console.error("Error saving group:", error);
        showNotification("negative", `Failed to save group: ${error.message}`);
      } finally {
        isLoading.value = false;
      }
    };

    const deleteGroup = async (group) => {
      // Confirm deletion
      Dialog.create({
        title: "Confirm Deletion",
        message: `Are you sure you want to delete the group "${group.name}"? This action cannot be undone.`,
        cancel: true,
        persistent: true,
        color: "negative",
      }).onOk(async () => {
        if (isLoading.value) return;

        isLoading.value = true;
        try {
          await appData.deleteGroup(group, (completed, total) => {
            // Optional: Show progress if needed
            // console.log(`Delete progress: ${completed}/${total}`);
          });
          showNotification(
            "positive",
            `Group "${group.name}" deleted successfully`,
          );
        } catch (error) {
          console.error("Error deleting group:", error);
          showNotification(
            "negative",
            `Failed to delete group: ${error.message}`,
          );
        } finally {
          isLoading.value = false;
        }
      });
    };

    return {
      groups,
      treeNodes,
      expandedNodes,
      getControllers,
      isExpanded,
      toggleNode,
      onExpandedChange,
      openDialog: addGroup,
      editGroup,
      deleteGroup,
      isLoading,
    };
  },
};
</script>

<style scoped>
.no-groups-container {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 200px;
  width: 100%;
}

.inset-scroll-area {
  height: 300px;
  width: 100%;
  max-width: 400px;
  box-shadow: inset 0 0 10px rgba(255, 255, 255, 0.1);
  margin: 10px;
}

.controller-item {
  font-size: 0.875em;
}

.controller-invisible {
  opacity: 0.6;
}

.controller-invisible .q-item-label {
  color: #bbb !important;
}

.controller-invisible .q-icon {
  color: #bbb !important;
}

.rotate-right {
  transform: rotate(-90deg);
  transition: transform 0.3s;
}

/* Hide default q-tree arrows since we're using custom ones */
:deep(.q-tree__arrow) {
  display: none !important;
}
</style>
