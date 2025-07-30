
import axios from 'axios';

const api = axios.create({
  baseURL: 'https://chemas-sport-er-backend.onrender.com/api',
});

export default api;
