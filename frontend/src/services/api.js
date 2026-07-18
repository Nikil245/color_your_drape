import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  withCredentials: true, // required to send/receive httpOnly cookies
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ─── Auth ───
export const authAPI = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  register: (name, email, password) => api.post('/auth/register', { name, email, password }),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
  updateProfile: (name) => api.put('/auth/profile', { name }),
  changePassword: (currentPassword, newPassword) =>
    api.post('/auth/change-password', { currentPassword, newPassword }),
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

// ─── Settings ───
export const settingsAPI = {
  getBusiness: () => api.get('/settings/business'),
  updateBusiness: (data) => api.put('/settings/business', data),
};

export default api;
