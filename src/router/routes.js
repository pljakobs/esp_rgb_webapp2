const routes = [
  {
    path: "/",
    component: () => import("layouts/RgbwwLayout.vue"),
    children: [{ path: "", component: () => import("pages/Color.vue") }],
  },
  // Always leave this as last one,
  // but you can also remove it
  {
    path: "/:catchAll(.*)*",
    component: () => import("pages/ErrorNotFound.vue"),
  },
];

export default routes;
