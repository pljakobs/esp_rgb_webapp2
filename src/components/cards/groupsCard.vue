<template>
  <MyCard icon="linked_services" title="Groups">
    <q-card-section class="row justify-center no-padding">
      <q-scroll-area style="height: 100%; width: 100%">
        <q-list separator style="overflow-y: auto; height: 100%">
          <template v-if="groups.length != 0">
            <q-item v-for="group in groups" :key="group.name" class="q-my-sm">
              {{ group.name }}
            </q-item>
          </template>
          <template v-else>
            <div class="-groups-container">
              <div class="no-groups-message">No groups available</div>
            </div>
          </template>
        </q-list>
      </q-scroll-area>
    </q-card-section>
    <q-card-section class="flex justify-center">
      <q-btn @click="openDialog">
        <template v-slot:default>
          <svgIcon name="linked_services" />
          <span>Add Group</span>
        </template>
      </q-btn>
    </q-card-section>
    <addGroupDialog
      :presetType="'hsv'"
      :presetData="colorData.data.hsv"
      :isOpen="isDialogOpen"
      @close="handleClose"
      @save="handleSave"
    />
  </MyCard>
</template>

<script>
import { computed } from "vue";
import { useAppDataStore } from "src/stores/appDataStore";
import { useControllersStore } from "src/stores/controllersStore";
import MyCard from "src/components/myCard.vue";
export default {
  name: "groupsCard",
  components: {
    MyCard,
  },
  setup() {
    const appData = useAppDataStore();
    const controllersStore = useControllersStore();

    console.log("groups data:", appData.data.groups);

    const groups = computed(() => {
      return appData.data.groups;
    });

    const controllers = computed(() => {
      return controllersStore.data.controllers;
    });

    const openDialog = () => {
      console.log("groupsCard openDialog");
      isDialogOpen.value = true;
    };

    const handleClose = () => {
      isDialogOpen.value = false;
    };

    return {
      groups,
      controllers,
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
