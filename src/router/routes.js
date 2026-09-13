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
