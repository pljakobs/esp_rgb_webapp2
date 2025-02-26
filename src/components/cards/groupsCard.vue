<template>
  <MyCard icon="linked_services" title="Groups">
    <q-card-section class="justify-center no-padding">
      <q-list separator style="overflow-y: auto; height: 100%; width: 200px">
        <div v-if="groups && groups.length > 0">
          <q-item v-for="group in groups" :key="group.name" class="q-my-sm">
            <q-item-section avatar @click="toggleGroup(group.name)">
              <svg-icon name="arrow_drop_down" />
            </q-item-section>
            <q-item-section>{{ group.name }}</q-item-section>
            <q-item-section v-if="expandedGroup === group.name">
              controllers:
              <q-list>
                <q-item
                  v-for="controller in getControllers(group.IDs)"
                  :key="controller.id"
                >
                  <q-item-section>{{ controller.name }}</q-item-section>
                </q-item>
              </q-list>
            </q-item-section>
          </q-item>
        </div>
        <div v-else>
          <div class="no-groups-container">
            <div class="no-groups-message">No groups available</div>
          </div>
        </div>
      </q-list>
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
import addGroupDialog from "src/components/Dialogs/addGroupDialog.vue";

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

    const groups = computed(() => {
      return appData.data.groups;
    });

    const controllers = computed(() => {
      return controllersStore.data.controllers;
    });

    const toggleGroup = (groupName) => {
      expandedGroup.value =
        expandedGroup.value === groupName ? null : groupName;
    };

    const getControllers = (ids) => {
      return controllers.value.filter((controller) =>
        ids.includes(controller.id),
      );
    };

    const openDialog = () => {
      Dialog.create({
        component: addGroupDialog,
      })
        .onOk((group) => {
          console.log("Dialog OK");
          console.log("Group:", group);
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
      console.log("Saving group", group);
      appData.addGroup(group);
    };

    return {
      groups,
      controllers,
      expandedGroup,
      toggleGroup,
      getControllers,
      openDialog,
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
}
.no-groups-message {
  background-color: #f0f0f0;
  padding: 20px;
  border-radius: 10px;
  text-align: center;
  color: #333;
}
</style>
