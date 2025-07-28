
import axios from 'axios';

const api = axios.create({
  baseURL: 'https://chemas-backend.onrender/api',
});

export default api;
