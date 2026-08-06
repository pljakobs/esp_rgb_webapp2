import ColorPage from "pages/ColorPage.vue";
import ColorSettings from "pages/ColorSettings.vue";
import NetworkSettings from "pages/NetworkSettings.vue";
import SystemSettings from "pages/SystemSettings.vue";
import NetworkInit from "pages/NetworkInit.vue";
import GroupsAndScenes from "pages/GroupsAndScenes.vue";
import { loadAsyncComponent } from "src/routes/loadAsyncComponent";

const routes = [
  {
    path: "/",
    component: loadAsyncComponent(() => import("layouts/RgbwwLayout.vue")),
    children: [
      {
        path: "",
        component: loadAsyncComponent(() => import("pages/ColorPage.vue")),
      },
      {
        path: "/ColorPage",
        component: loadAsyncComponent(() => import("pages/ColorPage.vue")),
      },
      {
        path: "/ColorSettings",
        component: loadAsyncComponent(() => import("pages/ColorSettings.vue")),
      },
      {
        path: "/NetworkSettings",
        component: loadAsyncComponent(
          () => import("pages/NetworkSettings.vue"),
        ),
      },
      {
        path: "/SystemSettings",
        component: loadAsyncComponent(() => import("pages/SystemSettings.vue")),
      },
      {
        path: "/test",
        component: loadAsyncComponent(() => import("pages/testPage.vue")),
      },
      {
        path: "/networkinit",
        component: loadAsyncComponent(() => import("pages/NetworkInit.vue")),
      },
      {
        path: "/GroupsAndScenes",
        component: loadAsyncComponent(
          () => import("pages/GroupsAndScenes.vue"),
        ),
      },
    ],
  },
  // Always leave this as last one
  {
    path: "/:catchAll(.*)*",
    component: () => import("pages/ErrorNotFound.vue"),
  },
];

export default routes;
