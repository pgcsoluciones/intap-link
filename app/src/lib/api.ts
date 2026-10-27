import { delegatedFreeDemoHeaders } from './freeDemoDelegation'
const envOrigin = import.meta.env.VITE_API_URL ?? import.meta.env.VITE_API_BASE_URL ?? ''
const API_ORIGIN = (envOrigin || (typeof window !== 'undefined' ? window.location.origin : '')).replace(/\/$/, '')
const API_BASE = `${API_ORIGIN}/api/v1`

export const INTAP_ACTIVE_TAB_STORAGE='kawvo_intap_active_tab_v1'
export function activeIntapTabHeaders():Record<string,string>{
  try{
    const token=window.sessionStorage.getItem(INTAP_ACTIVE_TAB_STORAGE)||''
    return /^[a-f0-9]{32}$/.test(token)?{'X-Intap-Account-Tab':token}:{}
  }catch{return{}}
}

export function kawmedGuestHeaders(path:string):Record<string,string>{
  if(typeof window==='undefined'||!path.startsWith('/me/medical-profile'))return {}
  const match=window.location.pathname.match(/^\/admin\/medical\/demo\/([^/]+)(?:\/agenda)?$/)
  const token=String(match?.[1]||'')
  return token.length===64||token.startsWith('i-')?{'X-KawMed-Delegate':token}:{}
}

function buildApiUrl(path: string): string {
  const withLeadingSlash = path.startsWith('/') ? path : `/${path}`
  const normalizedPath = withLeadingSlash.length > 1 && withLeadingSlash.endsWith('/')
    ? withLeadingSlash.slice(0, -1)
    : withLeadingSlash
  return `${API_BASE}${normalizedPath}`
}

export async function apiGet<T = any>(path: string): Promise<T> {
  const res = await fetch(buildApiUrl(path), {
    headers: { 'Content-Type': 'application/json', ...delegatedFreeDemoHeaders(path), ...activeIntapTabHeaders(), ...kawmedGuestHeaders(path) },
    credentials: 'include',
  })
  return res.json()
}

export async function apiPost<T = any>(path: string, body: unknown): Promise<T> {
  const res = await fetch(buildApiUrl(path), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...delegatedFreeDemoHeaders(path), ...activeIntapTabHeaders(), ...kawmedGuestHeaders(path) },
    credentials: 'include',
    body: JSON.stringify(body),
  })
  return res.json()
}

export async function apiPut<T = any>(path: string, body: unknown): Promise<T> {
  const res = await fetch(buildApiUrl(path), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...delegatedFreeDemoHeaders(path), ...activeIntapTabHeaders(), ...kawmedGuestHeaders(path) },
    credentials: 'include',
    body: JSON.stringify(body),
  })
  return res.json()
}

export async function apiPatch<T = any>(path: string, body: unknown): Promise<T> {
  const res = await fetch(buildApiUrl(path), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...delegatedFreeDemoHeaders(path), ...activeIntapTabHeaders(), ...kawmedGuestHeaders(path) },
    credentials: 'include',
    body: JSON.stringify(body),
  })
  return res.json()
}

export async function apiDelete<T = any>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(buildApiUrl(path), {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json', ...delegatedFreeDemoHeaders(path), ...activeIntapTabHeaders(), ...kawmedGuestHeaders(path) },
    credentials: 'include',
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
  return res.json()
}

// For multipart/form-data uploads (no Content-Type header — browser sets boundary)
export async function apiUpload<T = any>(path: string, formData: FormData): Promise<T> {
  const res = await fetch(buildApiUrl(path), {
    method: 'POST',
    headers: { ...delegatedFreeDemoHeaders(path), ...activeIntapTabHeaders(), ...kawmedGuestHeaders(path) },
    credentials: 'include',
    body: formData,
  })
  return res.json()
}

export { API_BASE }
