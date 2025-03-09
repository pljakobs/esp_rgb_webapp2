<template>
  <MyCard icon="linked_services" title="Groups">
    <q-card-section class="flex justify-center">
      <q-scroll-area class="inset-scroll-area">
        <q-list separator style="overflow-y: auto; height: 100%" dense>
          <div v-if="groups && groups.length > 0">
            <div v-for="group in groups" :key="group.name">
              <q-item
                class="q-my-sm"
                style="padding-bottom: 0px; margin-bottom: 0px"
              >
                <q-item-section
                  avatar
                  @click="toggleGroup(group.id)"
                  top
                  class="group"
                >
                  <q-tooltip>expand group</q-tooltip>
                  <svg-icon
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
                  <q-tooltip>edit group</q-tooltip>
                  <div class="icon-wraper" @click.stop="editGroup(group)">
                    <svgIcon name="edit" />
                  </div>
                </q-item-section>
                <q-item-section side>
                  <q-tooltip>delete group</q-tooltip>
                  <div class="icon-wraper" @click.stop="deleteGroup(group)">
                    <svgIcon name="delete" />
                  </div>
                </q-item-section>
              </q-item>
              <div v-if="expandedGroup === group.id" class="indented-list">
                <q-list dense>
                  <q-item
                    v-for="controller in getControllers(group.controller_ids)"
                    :key="controller.id"
                    class="controller-item"
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
      <q-btn flat color="primary" @click="openDialog">
        <template v-slot:default>
          <svgIcon name="linked_services" />
          <span>Add Group</span>
        </template>
      </q-btn>
    </q-card-section>
  </MyCard>
</template>

<script>
import { ref, computed } from "vue";
import { Dialog } from "quasar";
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

    console.log("groups data:", appData.data.groups);
    console.log("controllers data:", controllersStore.data);
    const groups = computed(() => {
      return appData.data.groups;
    });

    const controllers = computed(() => {
      return controllersStore.data;
    });
    const toggleGroup = (groupId) => {
      expandedGroup.value = expandedGroup.value === groupId ? null : groupId;
    };

    const getControllers = (controller_ids) => {
      console.log(
        "getControllers. controllers:",
        JSON.stringify(controller_ids),
        "\n",
        JSON.stringify(controllers.value),
      );
      const controllers_in_group = controllers.value.filter((controller) =>
        controller_ids.map(Number).includes(controller.id),
      );
      console.log("controllers_in_group:", controllers_in_group);
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
          console.log("Dialog canceled");
        })
        .onDismiss(() => {
          console.log("Dialog dismissed");
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
          console.log("Dialog canceled");
        })
        .onDismiss(() => {
          console.log("Dialog dismissed");
        });
    };

    const handleSave = (group) => {
      //console.log("Saving group", group);
      //appData.saveGroup(group);
    };

    const deleteGroup = (group) => {
      console.log("Deleting group", group);
      appData.deleteGroup(group);
    };

    return {
      groups,
      getControllers,
      openDialog: addGroup,
      editGroup,
      deleteGroup,
      expandedGroup,
      toggleGroup,
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
</style>
>
