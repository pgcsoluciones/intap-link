const API_BASE = '/api/v1'

function authHeaders(): HeadersInit {
  const token = localStorage.getItem('intap_token')
  return token
    ? { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
    : { 'Content-Type': 'application/json' }
}

export async function apiGet<T = any>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { headers: authHeaders() })
  return res.json()
}

export async function apiPost<T = any>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(body),
  })
  return res.json()
}

export async function apiPut<T = any>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(body),
  })
  return res.json()
}

export async function apiDelete<T = any>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'DELETE',
    headers: authHeaders(),
  })
  return res.json()
}
