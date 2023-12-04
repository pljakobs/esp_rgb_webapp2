// main.js
import { createApp } from "vue";
import App from "./App.vue";
import { createPinia } from "pinia";

const app = createApp(App);

// Install Pinia
app.use(createPinia());

app.mount("#app");
