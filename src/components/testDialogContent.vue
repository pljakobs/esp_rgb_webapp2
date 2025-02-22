<template>
  <q-dialog ref="dialog" @hide="onDialogHide">
    <q-card class="q-dialog-plugin">
      <q-card-section
        ><q-list>
          <q-item
            v-for="controller in controllersList"
            :key="controller.id"
            clickable
            v-ripple
          >
            <q-item-section avatar>
              <q-checkbox
                :model-value="selectedControllers.includes(controller.id)"
                @update:model-value="
                  updateSelectedControllers(controller.id, $event)
                "
              />
            </q-item-section>
            <q-item-section>
              {{ controller.name }}
            </q-item-section>
          </q-item>
        </q-list></q-card-section
      >>
      <q-card-actions align="right">
        <q-btn color="primary" label="OK" @click="onOKClick" />
        <q-btn color="primary" label="Cancel" @click="onCancelClick" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script>
export default {
  props: {
    controllersList: {
      type: Array,
      required: true,
    },
    selectedControllers: {
      type: Array,
      required: true,
    },
  },

  emits: [
    // REQUIRED
    "ok",
    "hide",
  ],

  methods: {
    // following method is REQUIRED
    // (don't change its name --> "show")
    show() {
      this.$refs.dialog.show();
    },

    // following method is REQUIRED
    // (don't change its name --> "hide")
    hide() {
      this.$refs.dialog.hide();
    },

    onDialogHide() {
      // required to be emitted
      // when QDialog emits "hide" event
      this.$emit("hide");
    },

    onOKClick() {
      // on OK, it is REQUIRED to
      // emit "ok" event (with optional payload)
      // before hiding the QDialog
      this.$emit("ok");
      // or with payload: this.$emit('ok', { ... })

      // then hiding dialog
      this.hide();
    },

    onCancelClick() {
      // we just need to hide the dialog
      this.hide();
    },
  },
};
</script>
