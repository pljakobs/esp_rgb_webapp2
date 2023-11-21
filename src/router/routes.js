import Color from "pages/Color.vue";
import ColorSettings from "pages/ColorSettings.vue";
import NetworkSettings from "pages/NetworkSettings.vue";
import SystemSettings from "pages/SystemSettings.vue";

const routes = [
  {
    path: "/",
    component: () => import("layouts/RgbwwLayout.vue"),
    children: [
      { path: "", component: Color },
      { path: "/Color", component: Color },
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
