import { createStore } from 'vuex';
import configModule from './modules/config';

export default createStore({
  modules: {
    config: configModule,
    // other modules if needed
  },
});
