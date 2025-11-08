// Utility functions

// Show toast notification
const showToast = (message, type = 'info') => {
  const container = document.getElementById('toast-container') || createToastContainer();
  
  const toast = document.createElement('div');
  toast.className = `toast alert alert-${type}`;
  toast.textContent = message;
  
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.style.animation = 'slideOut 0.3s ease-out';
    setTimeout(() => {
      container.removeChild(toast);
    }, 300);
  }, 3000);
};

const createToastContainer = () => {
  const container = document.createElement('div');
  container.id = 'toast-container';
  container.className = 'toast-container';
  document.body.appendChild(container);
  return container;
};

// Format file size
const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
};

// Format date
const formatDate = (dateString) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('pt-BR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

// Format time remaining
const formatTimeRemaining = (milliseconds) => {
  const hours = Math.floor(milliseconds / (1000 * 60 * 60));
  const minutes = Math.floor((milliseconds % (1000 * 60 * 60)) / (1000 * 60));
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
};

// Show loading spinner
const showLoading = (elementId) => {
  const element = document.getElementById(elementId);
  if (element) {
    element.innerHTML = '<div class="spinner"></div>';
  }
};

// Hide loading spinner
const hideLoading = (elementId) => {
  const element = document.getElementById(elementId);
  if (element) {
    element.innerHTML = '';
  }
};

// Validate email format
const isValidEmail = (email) => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
};

// Validate password strength
const validatePassword = (password) => {
  const errors = [];
  
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }
  
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
};

// Debounce function
const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

// Get plan badge color
const getPlanBadgeClass = (plan) => {
  const classes = {
    'free': 'badge-primary',
    'intermediate': 'badge-warning',
    'premium': 'badge-success'
  };
  return classes[plan] || 'badge-primary';
};

// Get status badge color
const getStatusBadgeClass = (status) => {
  const classes = {
    'pending': 'badge-warning',
    'processing': 'badge-primary',
    'completed': 'badge-success',
    'failed': 'badge-danger',
    'cancelled': 'badge-secondary'
  };
  return classes[status] || 'badge-primary';
};

// Copy to clipboard
const copyToClipboard = (text) => {
  navigator.clipboard.writeText(text).then(() => {
    showToast('Copied to clipboard!', 'success');
  }).catch(() => {
    showToast('Failed to copy', 'error');
  });
};

// Confirm dialog
const confirm = (message) => {
  return window.confirm(message);
};

// Handle API errors
const handleApiError = (error) => {
  console.error('API Error:', error);
  showToast(error.message || 'An error occurred', 'error');
};

// Update progress bar
const updateProgressBar = (elementId, progress) => {
  const progressBar = document.getElementById(elementId);
  if (progressBar) {
    progressBar.style.width = `${progress}%`;
    progressBar.textContent = `${progress}%`;
  }
};

// Create modal
const createModal = (title, content, buttons = []) => {
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h3>${title}</h3>
        <button class="modal-close">&times;</button>
      </div>
      <div class="modal-body">
        ${content}
      </div>
      <div class="modal-footer">
        ${buttons.map(btn => `
          <button class="btn ${btn.class}" data-action="${btn.action}">
            ${btn.text}
          </button>
        `).join('')}
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Close modal on X click
  modal.querySelector('.modal-close').addEventListener('click', () => {
    document.body.removeChild(modal);
  });
  
  // Close modal on outside click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      document.body.removeChild(modal);
    }
  });
  
  return modal;
};
