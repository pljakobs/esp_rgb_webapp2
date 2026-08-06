import { route } from 'quasar/wrappers'
import { createRouter, createMemoryHistory, createWebHistory, createWebHashHistory } from 'vue-router'
import routes from './routes'
import { isChunkLoadError } from 'src/routes/loadAsyncComponent'

const CHUNK_RELOAD_FLAG_KEY = 'rgbww:reloaded-after-chunk-load-error'

/*
 * If not building with SSR mode, you can
 * directly export the Router instantiation;
 *
 * The function below can be async too; either use
 * async/await or return a Promise which resolves
 * with the Router instance.
 */

export default route(function (/* { store, ssrContext } */) {
  const createHistory = process.env.SERVER
    ? createMemoryHistory
    : (process.env.VUE_ROUTER_MODE === 'history' ? createWebHistory : createWebHashHistory)

  const Router = createRouter({
    scrollBehavior: () => ({ left: 0, top: 0 }),
    routes,

    // Leave this as is and make changes in quasar.conf.js instead!
    // quasar.conf.js -> build -> vueRouterMode
    // quasar.conf.js -> build -> publicPath
    history: createHistory(process.env.VUE_ROUTER_BASE)
  })

  Router.onError((error) => {
    if (process.env.SERVER || !isChunkLoadError(error)) {
      console.error(error)
      return
    }

    if (window.sessionStorage.getItem(CHUNK_RELOAD_FLAG_KEY) === '1') {
      console.error(error)
      return
    }

    window.sessionStorage.setItem(CHUNK_RELOAD_FLAG_KEY, '1')
    window.location.reload()
  })

  return Router
})
