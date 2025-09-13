<template>
  <MyCard icon="light_group" title="Groups">
    <q-card-section class="flex justify-center">
      <q-scroll-area class="inset-scroll-area">
        <q-list separator style="overflow-y: auto; height: 100%" dense>
          <div v-if="isLoading" class="text-center q-pa-md">
            <q-spinner color="primary" size="lg" />
            <div class="q-mt-sm">Processing...</div>
          </div>
          <div v-else-if="groups && groups.length > 0">
            <div v-for="group in groups" :key="group.name">
              <q-item
                class="q-my-sm"
                style="padding-bottom: 0px; margin-bottom: 0px"
                clickable
                :aria-expanded="expandedGroup === group.id"
                role="button"
                :aria-label="`Group ${group.name}, click to ${expandedGroup === group.id ? 'collapse' : 'expand'}`"
              >
                <q-item-section
                  avatar
                  @click="toggleGroup(group.id)"
                  top
                  class="group"
                >
                  <q-tooltip
                    >{{
                      expandedGroup === group.id ? "Collapse" : "Expand"
                    }}
                    group</q-tooltip
                  >
                  <svgIcon
                    name="arrow_drop_down"
                    :class="{
                      'rotated-arrow': expandedGroup !== group.id,
                    }"
                  />
                </q-item-section>
                <q-item-section @click="toggleGroup(group.id)">
                  <q-item-label>{{ group.name }}</q-item-label>
                </q-item-section>
                <q-item-section side>
                  <q-tooltip>Edit group</q-tooltip>
                  <div
                    class="icon-wraper"
                    @click.stop="editGroup(group)"
                    role="button"
                    tabindex="0"
                    :aria-label="`Edit group ${group.name}`"
                    @keydown.enter="editGroup(group)"
                    @keydown.space="editGroup(group)"
                  >
                    <svgIcon name="edit" />
                  </div>
                </q-item-section>
                <q-item-section side>
                  <q-tooltip>Delete group</q-tooltip>
                  <div
                    class="icon-wraper"
                    @click.stop="deleteGroup(group)"
                    role="button"
                    tabindex="0"
                    :aria-label="`Delete group ${group.name}`"
                    @keydown.enter="deleteGroup(group)"
                    @keydown.space="deleteGroup(group)"
                  >
                    <svgIcon name="delete" />
                  </div>
                </q-item-section>
              </q-item>
              <div
                v-if="expandedGroup === group.id"
                class="indented-list"
                role="list"
              >
                <q-list dense>
                  <q-item
                    v-for="controller in getControllers(group.controller_ids)"
                    :key="controller.id"
                    class="controller-item"
                    role="listitem"
                    :class="{
                      'controller-invisible': controller.visible === false,
                    }"
                  >
                    <q-item-section>{{ controller.hostname }}</q-item-section>
                  </q-item>
                </q-list>
              </div>
            </div>
          </div>
          <div v-else>
            <div class="no-groups-container">
              <div class="no-groups-message">No groups available</div>
            </div>
          </div>
        </q-list>
      </q-scroll-area>
    </q-card-section>
    <q-card-section class="flex justify-center">
      <q-btn
        flat
        color="primary"
        @click="openDialog"
        :disable="isLoading"
        :aria-label="'Add new group'"
      >
        <template v-slot:default>
          <svgIcon name="light_group" />
          <span>Add Group</span>
        </template>
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
    const expandedGroup = ref(null);
    const $q = useQuasar();
    const isLoading = ref(false);

    const groups = computed(() => {
      return appData.data.groups;
    });

    const controllers = computed(() => {
      return controllersStore.data;
    });

    const showNotification = (type, message, timeout = 3000) => {
      $q.notify({
        type,
        message,
        timeout,
        position: "top",
      });
    };
    const toggleGroup = (groupId) => {
      expandedGroup.value = expandedGroup.value === groupId ? null : groupId;
    };

    const getControllers = (controller_ids) => {
      const controllers_in_group = controllers.value.filter((controller) =>
        controller_ids.map(Number).includes(controller.id),
      );
      return controllers_in_group;
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

          // Close expanded group if it was the one being deleted
          if (expandedGroup.value === group.id) {
            expandedGroup.value = null;
          }
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
      getControllers,
      openDialog: addGroup,
      editGroup,
      deleteGroup,
      expandedGroup,
      toggleGroup,
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
  height: 100%;
  width: 100%;
  vertical-align: middle;
}
.no-groups-message {
  background-color: #f0f0f0;
  padding: 20px;
  border-radius: 10px;
  text-align: center;
  vertical-align: middle;
  color: #333;
}
.indented-list {
  padding-left: 55px;
  padding-top: 0px;
  margin-top: 0; /* Remove extra spacing */
}
.controller-item {
  font-size: 0.875em; /* Smaller font size */
}
.rotated-arrow {
  transform: rotate(-90deg);
  transition: transform 0.3s;
}
.rotated-arrow.expanded {
  transform: rotate(0deg);
}
.inset-scroll-area {
  height: 300px;
  width: 100%;
  max-width: 400px;
  box-shadow: inset 0 0 10px rgba(255, 255, 255, 0.1);
  margin: 10px;
}
.group {
  cursor: pointer;
  margin-top: 0px;
  margin-bottom: 0px;
  padding-top: 0px; /* Adjust as needed */
  padding-bottom: 5px; /* Adjust as needed */
}

.icon-wraper {
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  transition: background-color 0.2s;
}

.icon-wraper:hover {
  background-color: rgba(0, 0, 0, 0.1);
}

.icon-wraper:focus {
  outline: 2px solid var(--q-primary);
  outline-offset: 2px;
}

.icon-wraper:active {
  transform: scale(0.95);
}

.controller-invisible {
  color: #bbb !important;
  opacity: 0.6;
}
</style>

