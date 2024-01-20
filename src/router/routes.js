import ColorPage from "pages/ColorPage.vue";
import ColorSettings from "pages/ColorSettings.vue";
import NetworkSettings from "pages/NetworkSettings.vue";
import SystemSettings from "pages/SystemSettings.vue";
import NetworkInit from "pages/NetworkInit.vue";
import testPage from "pages/testPage.vue";

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
      { path: "/test", component: NetworkInit },
      { path: "/networkinit", component: NetworkInit },
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
