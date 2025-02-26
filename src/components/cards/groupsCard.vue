<template>
  <MyCard icon="linked_services" title="Groups">
    <q-card-section class="flex justify-center">
      <q-scroll-area class="inset-scroll-area">
        <q-list
          separator
          style="overflow-y: auto; height: 100%; width: 200px"
          dense
        >
          <div v-if="groups && groups.length > 0">
            <q-item v-for="group in groups" :key="group.name" class="q-my-sm">
              <q-item-section avatar @click="toggleGroup(group.name)" top>
                <svg-icon
                  name="arrow_drop_down"
                  :class="{ 'rotated-arrow': expandedGroup != group.name }"
                />
              </q-item-section>
              <q-item-section @click="toggleGroup(group.name)">
                <q-item-label>{{ group.name }}</q-item-label>
                <q-item-label caption>
                  <div
                    v-if="expandedGroup === group.name"
                    class="indented-list"
                  >
                    <q-list dense>
                      <q-item
                        v-for="controller in getControllers(group.IDs)"
                        :key="controller.id"
                      >
                        <q-item-section>{{
                          controller.hostname
                        }}</q-item-section>
                      </q-item>
                    </q-list>
                  </div>
                </q-item-label>
              </q-item-section>
            </q-item>
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
    console.log("controllers data:", controllersStore.data);
    const groups = computed(() => {
      return appData.data.groups;
    });

    const controllers = computed(() => {
      return controllersStore.data;
    });
    const toggleGroup = (groupName) => {
      expandedGroup.value =
        expandedGroup.value === groupName ? null : groupName;
    };

    const getControllers = (ids) => {
      console.log("getControllers. controllers:", controllers.value);
      return controllers.value.filter((controller) =>
        ids.includes(controller.id),
      );
    };

    const openDialog = () => {
      Dialog.create({
        component: addGroupDialog,
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
.indented-list {
  padding-left: 10px;
}
.rotated-arrow {
  transform: rotate(-90deg);
}
.inset-scroll-area {
  height: 300px;
  width: 100%;
  max-width: 400px;
  box-shadow: inset 0 0 10px rgba(255, 255, 255, 0.1);
  margin: 10px;
}
</style>
