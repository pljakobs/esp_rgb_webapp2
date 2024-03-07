// src/boot/toast.js

import Toast from "vue-toastification";
import "vue-toastification/dist/index.css";

export default ({ app }) => {
  app.use(Toast);
};
