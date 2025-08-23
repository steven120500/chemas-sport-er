// src/api.js
import axios from 'axios';

const api = axios.create({
  baseURL: `${import.meta.env.VITE_API_URL}/api`, // ← toma del .env
  withCredentials: false,
});

export default api;