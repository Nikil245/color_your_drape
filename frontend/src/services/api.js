import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  withCredentials: true, // required to send/receive httpOnly cookies
  headers: {
    'Content-Type': 'application/json',
  },
});

// ─── Auth ───
export const authAPI = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  register: (name, email, password) => api.post('/auth/register', { name, email, password }),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
};

// ─── Orders ───
export const ordersAPI = {
  create: (data) => api.post('/orders', data),
  list: (params) => api.get('/orders', { params }),
  update: (id, data) => api.put(`/orders/${id}`, data),
  delete: (id) => api.delete(`/orders/${id}`),
};

// ─── Customers ───
export const customersAPI = {
  list: (params) => api.get('/customers', { params }),
};

// ─── Dashboard ───
export const dashboardAPI = {
  summary: () => api.get('/dashboard/summary'),
};

// ─── Inventory ───
export const inventoryAPI = {
  create: (data) => api.post('/inventory', data),
  list: (params) => api.get('/inventory', { params }),
  brands: () => api.get('/inventory/brands'),
  update: (id, data) => api.put(`/inventory/${id}`, data),
  delete: (id) => api.delete(`/inventory/${id}`),
};

export default api;
