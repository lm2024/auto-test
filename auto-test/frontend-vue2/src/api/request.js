import axios from 'axios';
import { MessagePlugin } from 'tdesign-vue';
import router from '@/router';
import { getToken, removeToken } from '@/utils/auth';

const service = axios.create({
  baseURL: process.env.VUE_APP_BASE_API || '/api',
  timeout: 30000
});

service.interceptors.request.use(
  config => {
    const token = getToken();
    if (token) {
      config.headers['Authorization'] = 'Bearer ' + token;
    }
    return config;
  },
  error => {
    return Promise.reject(error);
  }
);

service.interceptors.response.use(
  response => {
    const res = response.data;
    if (res.code && res.code !== 200) {
      MessagePlugin.error(res.msg || 'Error');
      if (res.code === 401) {
        removeToken();
        router.push('/login');
      }
      return Promise.reject(new Error(res.msg || 'Error'));
    }
    return res;
  },
  error => {
    MessagePlugin.error(error.message);
    return Promise.reject(error);
  }
);

export function post(url, data = {}, config = {}) {
  return service.post(url, data, config);
}

export function get(url, config = {}) {
  return service.get(url, config);
}

export function del(url, config = {}) {
  return service.delete(url, config);
}

export function put(url, data = {}, config = {}) {
  return service.put(url, data, config);
}

export default service;
