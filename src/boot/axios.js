import axios from 'axios';

const axiosInstance = axios.create({
  baseURL: 'http://192.168.29.38',
});

export default ({ app }) => {
  app.config.globalProperties.$axios = axiosInstance;
};

export { axiosInstance };
