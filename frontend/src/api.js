
import axios from 'axios';

const api = axios.create({
  baseURL: 'https://chemas-backend.onrender.com/api',
});

export default api;
