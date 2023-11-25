// store/modules/config.js
import axios from "axios";

const API_BASE_URL = "http://192.168.29.38";

function generatePartialData(currentState, path) {
  const keys = path.split(".");
  let result = {};
  let temp = currentState;

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    temp = temp[key];
  }
  for (let i = keys.length - 1; i >= 0; i--) {
    const key = keys[i];
    result = {};
    result[key] = temp;
    temp = result;
  }
  return result;
}

function generateFieldMappings(state, path = "") {
  const mappings = {};
  for (const key in state) {
    const fullPath = path ? `${path}.${key}` : key;
    mappings[key] = fullPath;
    if (typeof state[key] === "object") {
      Object.assign(mappings, generateFieldMappings(state[key], fullPath));
    }
  }
  return mappings;
}

const state = {
  configData: null,
  mappedFields: null,
};

const mutations = {
  setConfigData(state, data) {
    state.configData = data;
    state.mappedFields = generateFieldMappings(data);
  },
  updateMappedFields(state, { field, value }) {
    // Update the mappedFields when a field is updated
    state.mappedFields[field] = value;
  },
};

const actions = {
  async fetchConfigData({ commit }) {
    try {
      const response = await axios.get(`${API_BASE_URL}/config`);
      commit("setConfigData", response.data);
    } catch (error) {
      console.error("Error fetching config data:", error);
      throw error;
    }
  },

  async updateConfigData({ commit, state }, { field, value }) {
    try {
      const partialData = generatePartialData(state.configData, field);
      partialData[field] = value;

      await axios.post(`${API_BASE_URL}/config`, JSON.stringify(partialData), {
        headers: {
          "content-type": "text/json",
        },
      });

      // Update the mapped fields in the store
      commit("updateMappedFields", { field, value });
    } catch (error) {
      console.error("Error updating config data:", error);
      throw error;
    }
  },
};

const getters = {
  configData: (state) => state.configData,
  mappedFields: (state) => state.mappedFields,
};

export default {
  namespaced: true,
  state,
  mutations,
  actions,
  getters,
};
