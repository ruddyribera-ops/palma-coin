const API_URL = '/api';

async function request(endpoint, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };

  const res = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
    credentials: 'include'
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || 'Request failed');
  }

  return res.json();
}

export const api = {
  // Students
  getStudents: () => request('/students'),
  addStudent: (data) => request('/students', { method: 'POST', body: JSON.stringify(data) }),
  updateStudent: (id, data) => request(`/students/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteStudent: (id) => request(`/students/${id}`, { method: 'DELETE' }),

  // Subjects
  getSubjects: () => request('/subjects'),
  addSubject: (data) => request('/subjects', { method: 'POST', body: JSON.stringify(data) }),
  deleteSubject: (id) => request(`/subjects/${id}`, { method: 'DELETE' }),

  // Transactions
  getTransactions: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/transactions${query ? `?${query}` : ''}`);
  },
  addTransaction: (data) => request('/transactions', { method: 'POST', body: JSON.stringify(data) }),
  bulkTransactions: (data) => request('/transactions/bulk', { method: 'POST', body: JSON.stringify(data) }),

  // Rewards
  getRewards: () => request('/rewards'),
  addReward: (data) => request('/rewards', { method: 'POST', body: JSON.stringify(data) }),
  updateReward: (id, data) => request(`/rewards/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  makePurchase: (data) => request('/purchases', { method: 'POST', body: JSON.stringify(data) }),
  getPurchases: () => request('/purchases'),

  // Assemblies
  getAssemblies: () => request('/assemblies'),
  addAssembly: (data) => request('/assemblies', { method: 'POST', body: JSON.stringify(data) }),
  closeAssembly: (id) => request(`/assemblies/${id}`, { method: 'PUT', body: JSON.stringify({ status: 'closed' }) }),
  voteAssembly: (id, data) => request(`/assemblies/${id}/vote`, { method: 'POST', body: JSON.stringify(data) }),
  getAssemblyVotes: (id) => request(`/assemblies/${id}/votes`),

  // Stats
  getStats: () => request('/stats'),

  // Autonomy metrics
  getAutonomyMetrics: () => request('/autonomy-metrics'),
  recordMetric: (data) => request('/autonomy-metrics', { method: 'POST', body: JSON.stringify(data) })
};