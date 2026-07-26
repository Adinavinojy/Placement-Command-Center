// Strip any trailing slash to avoid double-slash URLs (e.g. if env var is set with a trailing /)
export const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '');

export async function fetchAuth(url, options = {}) {
  const token = localStorage.getItem('mentor_token');
  const headers = {
    ...options.headers,
    'Authorization': `Bearer ${token}`
  };
  
  const response = await fetch(url, { ...options, headers });
  
  if (response.status === 401) {
    // Token expired or invalid
    localStorage.removeItem('mentor_token');
    localStorage.removeItem('mentor_user');
    window.location.reload();
  }
  
  return response;
}
