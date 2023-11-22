// store/modules/config.js
import axios from 'axios';

const API_BASE_URL = 'http://192.168.29.38';

function generatePartialData(currentState, path) {
    const keys = path.split('.');
    let result = {};
    let temp = currentState;

    for (let i = 0; i < keys.length ; i++) {
      const key = keys[i];
      temp = temp[key];
    }
    for (let i=keys.length -1 ;i>=0; i--) {
        const key = keys[i];
        result={};
        result[key]=temp;
        temp=result;
    }
    return result;
  }

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

  async updateConfigData({ commit, state }, path) {

    try {
      const partialData = generatePartialData(state.configData, path);
      console.log(`trying to update the API with partial data`,JSON.stringify(partialData));
      await axios.put(`${API_BASE_URL}/config`, JSON.stringify(partialData));
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
