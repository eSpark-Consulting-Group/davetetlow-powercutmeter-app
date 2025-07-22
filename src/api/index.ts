import { create } from 'apisauce';

const api = create({
  baseURL: 'https://davetetlowbe.esparkconsultants.com/',
  headers: {
    Accept: 'application/json',
  },
  timeout: 10000,
});

export default api;