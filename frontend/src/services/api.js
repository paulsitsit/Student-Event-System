const BASE =
  import.meta.env.VITE_API_URL || "http://localhost:5000/api";

let token = localStorage.getItem("pcc_token") || "";

export function setToken(value) {
  token = value || "";
  if (token) localStorage.setItem("pcc_token", token);
  else localStorage.removeItem("pcc_token");
}

export function getToken() {
  return token;
}

export async function api(path, options = {}) {
  const headers = {
    ...(options.body ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };
  const response = await fetch(`${BASE}${path}`, { ...options, headers });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || `Request failed (${response.status})`);
  }
  if (options.raw) return response;
  return response.json();
}

export async function downloadCsv(filters = {}) {
  // Backward compatibility: older callers may still pass an event ID string.
  const params = new URLSearchParams();
  if (typeof filters === 'string') {
    if (filters) params.set('eventId', filters);
  } else {
    Object.entries(filters || {}).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
  }
  const query = params.toString();
  const response = await api(`/reports/attendance.csv${query ? `?${query}` : ''}`, { raw: true });
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  const disposition = response.headers.get('Content-Disposition') || '';
  const match = disposition.match(/filename="([^"]+)"/i);
  anchor.download = match?.[1] || 'attendance-report.csv';
  anchor.click();
  URL.revokeObjectURL(url);
}
