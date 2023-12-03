// src/boot/pinia.js
import { createPinia } from "pinia";

export default ({ app }) => {
  app.use(createPinia());
};
