import ColorPage from "pages/ColorPage.vue";
import ColorSettings from "pages/ColorSettings.vue";
import NetworkSettings from "pages/NetworkSettings.vue";
import SystemSettings from "pages/SystemSettings.vue";
import testPage from "src/pages/testPage.vue";

const routes = [
  {
    path: "/",
    component: () => import("layouts/RgbwwLayout.vue"),
    children: [
      { path: "", component: ColorPage },
      {
        path: "/ColorPage",
        component: ColorPage,
      },
      {
        path: "/ColorSettings",
        component: ColorSettings,
      },
      {
        path: "/NetworkSettings",
        component: NetworkSettings,
      },
      {
        path: "/SystemSettings",
        component: SystemSettings,
      },
      { path: "/test", component: testPage },
    ],
  },
  // Always leave this as last one,
  // but you can also remove it
  // {
  // path: "/:catchAll(.*)*",
  //component: () => import("pages/ErrorNotFound.vue"),
  // },
];

export default routes;
