// Authentication utilities

const API_URL = window.location.origin + '/api';

// Get token from localStorage
const getToken = () => {
  return localStorage.getItem('token');
};

// Set token in localStorage
const setToken = (token) => {
  localStorage.setItem('token', token);
};

// Remove token from localStorage
const removeToken = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
};

// Get user from localStorage
const getUser = () => {
  const userStr = localStorage.getItem('user');
  return userStr ? JSON.parse(userStr) : null;
};

// Set user in localStorage
const setUser = (user) => {
  localStorage.setItem('user', JSON.stringify(user));
};

// Check if user is authenticated
const isAuthenticated = () => {
  return !!getToken();
};

// Make authenticated API request
const authFetch = async (url, options = {}) => {
  const token = getToken();
  
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers
  });

  // Handle unauthorized
  if (response.status === 401) {
    removeToken();
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }

  return response;
};

// Register user
const register = async (email, password, confirmPassword) => {
  const response = await fetch(`${API_URL}/auth/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ email, password, confirmPassword })
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Registration failed');
  }

  setToken(data.token);
  setUser(data.user);

  return data;
};

// Login user
const login = async (email, password) => {
  const response = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ email, password })
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Login failed');
  }

  setToken(data.token);
  setUser(data.user);

  return data;
};

// Logout user
const logout = () => {
  removeToken();
  window.location.href = '/login';
};

// Get user profile
const getProfile = async () => {
  const response = await authFetch(`${API_URL}/auth/profile`);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Failed to fetch profile');
  }

  setUser(data.user);
  return data.user;
};

// Request password reset
const requestPasswordReset = async (email) => {
  const response = await fetch(`${API_URL}/auth/password-reset/request`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ email })
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Failed to request password reset');
  }

  return data;
};

// Reset password
const resetPassword = async (token, password, confirmPassword) => {
  const response = await fetch(`${API_URL}/auth/password-reset/confirm`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ token, password, confirmPassword })
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Failed to reset password');
  }

  return data;
};

// Protect page (redirect to login if not authenticated)
const protectPage = () => {
  if (!isAuthenticated()) {
    window.location.href = '/login';
  }
};

// Redirect if authenticated (for login/register pages)
const redirectIfAuthenticated = () => {
  if (isAuthenticated()) {
    window.location.href = '/dashboard';
  }
};
