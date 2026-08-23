// ==========================================================================
// Centralized API Service
// ==========================================================================
const API_BASE = '/api';

function getAuthHeader() {
  const token = localStorage.getItem('inventory_token');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}

async function request(endpoint, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...getAuthHeader(),
    ...(options.headers || {})
  };

  const config = {
    ...options,
    headers
  };

  try {
    const response = await fetch(`${API_BASE}${endpoint}`, config);
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const errorMsg = data.error || data.message || `Request failed with status ${response.status}`;
      throw new Error(errorMsg);
    }
    return data;
  } catch (err) {
    console.error(`API Error [${endpoint}]:`, err);
    throw err;
  }
}

const api = {
  // Auth
  login: (username, password) => request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password })
  }),

  adminLogin: (username, password) => request('/auth/admin-login', {
    method: 'POST',
    body: JSON.stringify({ username, password })
  }),

  loginEntraSSO: (payload) => request('/auth/entra-sso', {
    method: 'POST',
    body: JSON.stringify(payload)
  }),

  getProfile: () => request('/auth/me'),

  // Inventory
  getInventory: (params = {}) => {
    const query = new URLSearchParams();
    if (params.search) query.append('search', params.search);
    if (params.category) query.append('category', params.category);
    if (params.lowStock) query.append('lowStock', params.lowStock);
    const qs = query.toString() ? `?${query.toString()}` : '';
    return request(`/inventory${qs}`);
  },

  getStats: () => request('/inventory/stats'),

  createItem: (itemData) => request('/inventory', {
    method: 'POST',
    body: JSON.stringify(itemData)
  }),

  updateItem: (id, itemData) => request(`/inventory/${id}`, {
    method: 'PUT',
    body: JSON.stringify(itemData)
  }),

  updateStock: (id, { action, amount, reason }) => request(`/inventory/${id}/stock`, {
    method: 'POST',
    body: JSON.stringify({ action, amount, reason })
  }),

  deleteItem: (id) => request(`/inventory/${id}`, {
    method: 'DELETE'
  }),

  // Tickets & IT Support Requisitions
  getTickets: (params = {}) => {
    const query = new URLSearchParams();
    if (params.status) query.append('status', params.status);
    if (params.type) query.append('type', params.type);
    const qs = query.toString() ? `?${query.toString()}` : '';
    return request(`/tickets${qs}`);
  },

  getTicketStats: () => request('/tickets/stats'),

  createTicket: (ticketData) => request('/tickets', {
    method: 'POST',
    body: JSON.stringify(ticketData)
  }),

  updateTicketStatus: (id, { status, admin_notes, deduct_stock }) => request(`/tickets/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status, admin_notes, deduct_stock })
  }),

  // Users (Admin Only)
  getUsers: () => request('/users'),

  createUser: (userData) => request('/users', {
    method: 'POST',
    body: JSON.stringify(userData)
  }),

  toggleUserStatus: (id, status) => request(`/users/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status })
  }),

  // Activities
  getTodayActivity: () => request('/activity/today'),

  getAllActivity: (limit = 50, offset = 0) => request(`/activity/all?limit=${limit}&offset=${offset}`)
};

window.api = api;
