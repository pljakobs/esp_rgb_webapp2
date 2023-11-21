// store/modules/config.js
import axios from 'axios';

const API_BASE_URL = 'http://192.168.29.38';

const state = {
  configData: null,
};

const mutations = {
  setConfigData(state, data) {
    state.configData = data;
  },
};

const actions = {
  async fetchConfigData({ commit }) {
    try {
      const response = await axios.get(`${API_BASE_URL}/config`);
      commit('setConfigData', response.data);
    } catch (error) {
      console.error('Error fetching config data:', error);
    }
  },

  async updateConfigData({ commit }, partialData) {
    try {
      await axios.put(`${API_BASE_URL}/config`, partialData);
      await this.dispatch('fetchConfigData');
    } catch (error) {
      console.error('Error updating config data:', error);
    }
  },
};

export default {
  namespaced: true,
  state,
  mutations,
  actions,
};
