import ColorPage from "pages/ColorPage.vue";
import ColorSettings from "pages/ColorSettings.vue";
import NetworkSettings from "pages/NetworkSettings.vue";
import SystemSettings from "pages/SystemSettings.vue";
import NetworkInit from "pages/NetworkInit.vue";
import GroupsAndScenes from "pages/GroupsAndScenes.vue";

// Helper function to retry module downloads when ESP8266 returns 429
function loadAsyncComponent(importFn) {
  return () =>
    new Promise((resolve, reject) => {
      const attempt = (retriesLeft, delay) => {
        importFn()
          .then(resolve)
          .catch((error) => {
            if (retriesLeft <= 0) {
              reject(error);
              return;
            }
            setTimeout(() => {
              attempt(retriesLeft - 1, delay * 2);
            }, delay);
          });
      };
      attempt(3, 1000);
    });
}

const routes = [
  {
    path: "/",
    component: () => import("layouts/RgbwwLayout.vue"),
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
