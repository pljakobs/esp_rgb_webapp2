import Color from "pages/Color.vue";
import ColorSettings from "pages/ColorSettings.vue";
import gridTest from "pages/gridtest.vue";

console.log("Color component:", Color);
console.log("ColorSettings component:", ColorSettings);
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
      { path: "/gridtest", component: gridTest },
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
