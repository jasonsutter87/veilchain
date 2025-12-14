/**
 * VeilChain Dashboard JavaScript
 * Handles authentication, data fetching, and UI interactions
 */

(function() {
  'use strict';

  // API Configuration
  const API_BASE = '/api/v1';

  // Auth helpers
  const Auth = {
    getToken() {
      return localStorage.getItem('veilchain_token');
    },

    getUser() {
      try {
        return JSON.parse(localStorage.getItem('veilchain_user') || '{}');
      } catch {
        return {};
      }
    },

    setAuth(token, user) {
      localStorage.setItem('veilchain_token', token);
      localStorage.setItem('veilchain_user', JSON.stringify(user));
    },

    clearAuth() {
      localStorage.removeItem('veilchain_token');
      localStorage.removeItem('veilchain_user');
    },

    isAuthenticated() {
      return !!this.getToken();
    },

    requireAuth() {
      if (!this.isAuthenticated()) {
        window.location.href = '/dashboard/login/';
        return false;
      }
      return true;
    }
  };

  // API helpers
  const API = {
    async fetch(endpoint, options = {}) {
      const token = Auth.getToken();
      const headers = {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),
        ...options.headers
      };

      const response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers
      });

      if (response.status === 401) {
        Auth.clearAuth();
        window.location.href = '/dashboard/login/';
        throw new Error('Unauthorized');
      }

      return response;
    },

    async get(endpoint) {
      const res = await this.fetch(endpoint);
      return res.json();
    },

    async post(endpoint, data) {
      const res = await this.fetch(endpoint, {
        method: 'POST',
        body: JSON.stringify(data)
      });
      return res.json();
    },

    async delete(endpoint) {
      const res = await this.fetch(endpoint, { method: 'DELETE' });
      return res.json();
    }
  };

  // Utility helpers
  const Utils = {
    formatNumber(num) {
      if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
      if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
      return num.toString();
    },

    truncateHash(hash, start = 8, end = 6) {
      if (!hash) return '-';
      return hash.substring(0, start) + '...' + hash.substring(hash.length - end);
    },

    timeAgo(date) {
      const seconds = Math.floor((new Date() - new Date(date)) / 1000);
      if (seconds < 60) return 'just now';
      if (seconds < 3600) return Math.floor(seconds / 60) + 'm ago';
      if (seconds < 86400) return Math.floor(seconds / 3600) + 'h ago';
      return Math.floor(seconds / 86400) + 'd ago';
    },

    formatDate(date) {
      return new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    },

    copyToClipboard(text) {
      navigator.clipboard.writeText(text).then(() => {
        this.showToast('Copied to clipboard');
      });
    },

    showToast(message, type = 'success') {
      const toast = document.createElement('div');
      toast.className = `toast toast--${type}`;
      toast.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i>
        <span>${message}</span>
      `;
      document.body.appendChild(toast);

      setTimeout(() => toast.classList.add('show'), 10);
      setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
      }, 3000);
    }
  };

  // Dashboard initialization
  async function initDashboard() {
    if (!Auth.requireAuth()) return;

    // Display user info
    const user = Auth.getUser();
    const userName = document.querySelector('.dashboard__user-name');
    if (userName) {
      userName.textContent = user.email || 'User';
    }

    // Logout handler
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        Auth.clearAuth();
        window.location.href = '/dashboard/login/';
      });
    }

    // Mobile sidebar toggle
    const mobileToggle = document.getElementById('mobile-toggle');
    const sidebar = document.querySelector('.dashboard__sidebar');
    if (mobileToggle && sidebar) {
      mobileToggle.addEventListener('click', () => {
        sidebar.classList.toggle('open');
      });
    }

    // Load dashboard data
    await loadDashboardData();
  }

  async function loadDashboardData() {
    try {
      // Load stats
      const stats = await API.get('/stats').catch(() => ({}));
      updateStats(stats);

      // Load recent ledgers
      const ledgersData = await API.get('/ledgers?limit=5').catch(() => ({ ledgers: [] }));
      renderLedgers(ledgersData.ledgers || []);

      // Load activity
      const activityData = await API.get('/activity?limit=10').catch(() => ({ activities: [] }));
      renderActivity(activityData.activities || []);

    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    }
  }

  function updateStats(stats) {
    const elements = {
      'stat-ledgers': stats.ledgers || 0,
      'stat-entries': Utils.formatNumber(stats.entries || 0),
      'stat-proofs': Utils.formatNumber(stats.proofs || 0),
      'stat-anchors': stats.anchors || 0
    };

    Object.entries(elements).forEach(([id, value]) => {
      const el = document.getElementById(id);
      if (el) el.textContent = value;
    });
  }

  function renderLedgers(ledgers) {
    const tbody = document.getElementById('ledgers-table');
    if (!tbody) return;

    if (!ledgers || ledgers.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" class="empty-row">
            <p>No ledgers yet. <a href="/dashboard/ledgers/new/">Create your first ledger</a></p>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = ledgers.map(ledger => `
      <tr>
        <td>
          <strong>${escapeHtml(ledger.name)}</strong>
          ${ledger.description ? `<br><small>${escapeHtml(ledger.description)}</small>` : ''}
        </td>
        <td>${Utils.formatNumber(ledger.size)}</td>
        <td>
          <code class="hash-display" title="${ledger.root}" onclick="Utils.copyToClipboard('${ledger.root}')">
            ${Utils.truncateHash(ledger.root)}
          </code>
        </td>
        <td>${Utils.timeAgo(ledger.updatedAt)}</td>
        <td class="actions-cell">
          <a href="/dashboard/ledgers/${ledger.id}/" class="btn-icon" title="View">
            <i class="fas fa-eye"></i>
          </a>
          <a href="/dashboard/ledgers/${ledger.id}/export/" class="btn-icon" title="Export">
            <i class="fas fa-download"></i>
          </a>
        </td>
      </tr>
    `).join('');
  }

  function renderActivity(activities) {
    const feed = document.getElementById('activity-feed');
    if (!feed) return;

    if (!activities || activities.length === 0) {
      return; // Keep the empty state
    }

    const iconMap = {
      'entry_added': 'plus',
      'proof_generated': 'certificate',
      'ledger_created': 'database',
      'anchor_published': 'link',
      'export_completed': 'download',
      'api_key_created': 'key'
    };

    feed.innerHTML = activities.map(activity => `
      <div class="activity-item">
        <div class="activity-item__icon activity-item__icon--${activity.type}">
          <i class="fas fa-${iconMap[activity.type] || 'circle'}"></i>
        </div>
        <div class="activity-item__content">
          <p>${escapeHtml(activity.message)}</p>
          <span>${Utils.timeAgo(activity.createdAt)}</span>
        </div>
      </div>
    `).join('');
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Login form handling
  function initLoginForm() {
    const form = document.getElementById('login-form');
    if (!form) return;

    const errorDiv = document.getElementById('login-error');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const email = document.getElementById('email').value;
      const password = document.getElementById('password').value;
      const remember = form.querySelector('input[name="remember"]').checked;

      try {
        const response = await fetch(`${API_BASE}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, remember })
        });

        const data = await response.json();

        if (response.ok) {
          Auth.setAuth(data.token, data.user);
          window.location.href = '/dashboard/';
        } else {
          showError(errorDiv, data.error?.message || 'Invalid credentials');
        }
      } catch (err) {
        showError(errorDiv, 'Network error. Please try again.');
      }
    });

    // OAuth handlers
    const githubBtn = document.getElementById('github-login');
    if (githubBtn) {
      githubBtn.addEventListener('click', () => {
        window.location.href = `${API_BASE}/auth/github`;
      });
    }

    const googleBtn = document.getElementById('google-login');
    if (googleBtn) {
      googleBtn.addEventListener('click', () => {
        window.location.href = `${API_BASE}/auth/google`;
      });
    }
  }

  function showError(errorDiv, message) {
    if (errorDiv) {
      errorDiv.querySelector('span').textContent = message;
      errorDiv.style.display = 'flex';
    }
  }

  // Export functionality
  async function exportLedger(ledgerId, format = 'json') {
    try {
      const response = await API.fetch(`/ledgers/${ledgerId}/export?format=${format}`);
      const blob = await response.blob();

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ledger-${ledgerId}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      Utils.showToast('Export completed');
    } catch (err) {
      Utils.showToast('Export failed', 'error');
    }
  }

  // Expose to global scope
  window.VeilChain = {
    Auth,
    API,
    Utils,
    exportLedger,
    initDashboard,
    initLoginForm
  };

  // Auto-init on DOM ready
  document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('dashboard-app')) {
      initDashboard();
    }
    if (document.getElementById('login-form')) {
      initLoginForm();
    }
  });

})();
