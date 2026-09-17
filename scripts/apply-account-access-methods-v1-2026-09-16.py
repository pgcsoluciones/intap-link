#!/usr/bin/env python3
from pathlib import Path


def write(path: str, content: str):
    p = Path(path)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(content, encoding='utf-8')
    print(f'✓ escrito {path}')


def replace_once(path: str, old: str, new: str, label: str):
    p = Path(path)
    text = p.read_text(encoding='utf-8')
    if old not in text:
        raise SystemExit(f'ERROR: no encontré patrón para {label} en {path}')
    p.write_text(text.replace(old, new, 1), encoding='utf-8')
    print(f'✓ {label}')

migration = """-- KAWVO LINK · Account access methods v1
CREATE TABLE IF NOT EXISTS user_auth_identities (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  provider_subject TEXT NOT NULL,
  provider_email TEXT,
  linked_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_used_at TEXT,
  UNIQUE(provider, provider_subject)
);
CREATE INDEX IF NOT EXISTS idx_user_auth_identities_user ON user_auth_identities(user_id, provider);

CREATE TABLE IF NOT EXISTS user_password_credentials (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  password_salt TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS account_verification_challenges (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  purpose TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_account_verification_active ON account_verification_challenges(user_id, purpose, created_at);

CREATE TABLE IF NOT EXISTS account_verified_actions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  target_email TEXT,
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_account_verified_actions_user ON account_verified_actions(user_id, purpose, expires_at);
"""
write('api/migrations/0060_account_access_methods.sql', migration)
write('api/migrations-preview/0060_account_access_methods.sql', migration)

api_module = r'''import app from './preview-entry'
import { Resend } from 'resend'
import { buildScopedCookie, cookieNames, isPreviewEnvironment } from './lib/cookies'

const KDF_ITERATIONS = 210000
const MAX_PASSWORD_ATTEMPTS = 5

async function sha256Hex(input: string): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('')
}
function hex(bytes: Uint8Array) { return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('') }
function parseCookie(header: string, name: string): string | null {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = header.match(new RegExp(`(?:^|;\\s*)${escaped}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : null
}
function token(bytes = 32) { const out = crypto.getRandomValues(new Uint8Array(bytes)); return hex(out) }
function code6() { const n = crypto.getRandomValues(new Uint32Array(1))[0] % 1000000; return String(n).padStart(6, '0') }
function appUrl(c: any) {
  const fallback = isPreviewEnvironment(c.env) ? 'https://app.preview.intaprd.com' : 'https://app.intaprd.com'
  return String(c.env.APP_URL || fallback).replace(/\/$/, '')
}
function sessionCookie(c: any, value: string) {
  return buildScopedCookie(c.env, appUrl(c), cookieNames(c.env).session, value, 30 * 24 * 60 * 60)
}
async function passwordHash(password: string, saltHex: string) {
  const salt = new Uint8Array((saltHex.match(/.{1,2}/g) || []).map((part) => parseInt(part, 16)))
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: KDF_ITERATIONS, hash: 'SHA-256' }, key, 256)
  return hex(new Uint8Array(bits))
}
async function newPasswordRecord(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16)); const saltHex = hex(salt)
  return { salt: saltHex, hash: await passwordHash(password, saltHex) }
}
function constantTimeEqual(a: string, b: string) {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}
async function currentUser(c: any) {
  const raw = parseCookie(c.req.header('Cookie') || '', cookieNames(c.env).session)
  if (!raw) return null
  const row = await c.env.DB.prepare(`SELECT s.id session_id,s.user_id,u.email FROM auth_sessions s JOIN users u ON u.id=s.user_id WHERE s.session_hash=? AND s.expires_at>datetime('now') AND s.revoked_at IS NULL LIMIT 1`).bind(await sha256Hex(raw)).first()
  return row || null
}
async function requireAccount(c: any, next: any) {
  const row = await currentUser(c)
  if (!row) return c.json({ ok: false, error: 'Unauthorized' }, 401)
  c.set('accountUserId', String((row as any).user_id || ''))
  c.set('accountEmail', String((row as any).email || ''))
  await next()
}
async function sendVerificationCode(c: any, to: string, code: string, purpose: string) {
  if (!c.env.RESEND_API_KEY) throw new Error('El envío de correo no está configurado.')
  const resend = new Resend(c.env.RESEND_API_KEY)
  const from = c.env.RESEND_FROM || 'onboarding@resend.dev'
  const label = purpose === 'email_new' ? 'confirmar tu nuevo correo' : purpose === 'email_change' ? 'autorizar el cambio de correo' : 'autorizar el cambio de contraseña'
  const result: any = await resend.emails.send({
    from, to,
    subject: `Código de verificación Kawvo: ${code}`,
    html: `<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;color:#0f172a"><p style="font-size:12px;font-weight:800;color:#0891b2;letter-spacing:.12em">KAWVO LINK</p><h2>Código de verificación</h2><p>Usa este código para ${label}:</p><div style="font-size:32px;font-weight:900;letter-spacing:.18em;padding:18px 0">${code}</div><p style="color:#64748b">Expira en 10 minutos. Si no solicitaste este cambio, ignora este mensaje.</p></div>`,
  })
  if (result?.error) throw new Error(result.error?.message || 'No pudimos enviar el código.')
}
async function createChallenge(c: any, userId: string, email: string, purpose: string) {
  const recent = await c.env.DB.prepare(`SELECT COUNT(*) n FROM account_verification_challenges WHERE user_id=? AND purpose=? AND created_at>datetime('now','-10 minutes')`).bind(userId, purpose).first()
  if (Number((recent as any)?.n || 0) >= 5) return { ok: false, error: 'Demasiados intentos. Espera unos minutos.' }
  const id = crypto.randomUUID(), code = code6(), codeHash = await sha256Hex(`${id}:${code}`)
  await c.env.DB.prepare(`INSERT INTO account_verification_challenges(id,user_id,email,purpose,code_hash,expires_at,created_at) VALUES(?,?,?,?,?,datetime('now','+10 minutes'),datetime('now'))`).bind(id,userId,email,purpose,codeHash).run()
  await sendVerificationCode(c,email,code,purpose)
  return { ok: true }
}
async function verifyChallenge(c: any, userId: string, email: string, purpose: string, code: string) {
  const row = await c.env.DB.prepare(`SELECT id,code_hash,attempts FROM account_verification_challenges WHERE user_id=? AND email=? AND purpose=? AND consumed_at IS NULL AND expires_at>datetime('now') ORDER BY created_at DESC LIMIT 1`).bind(userId,email,purpose).first()
  if (!row) return false
  const id = String((row as any).id || '')
  if (Number((row as any).attempts || 0) >= 5) return false
  const valid = constantTimeEqual(String((row as any).code_hash || ''), await sha256Hex(`${id}:${code}`))
  if (!valid) {
    await c.env.DB.prepare(`UPDATE account_verification_challenges SET attempts=attempts+1 WHERE id=?`).bind(id).run()
    return false
  }
  await c.env.DB.prepare(`UPDATE account_verification_challenges SET consumed_at=datetime('now') WHERE id=?`).bind(id).run()
  return true
}
async function consumeAction(c: any, userId: string, purpose: string, raw: string) {
  if (!raw) return null
  const row = await c.env.DB.prepare(`SELECT id,target_email FROM account_verified_actions WHERE user_id=? AND purpose=? AND token_hash=? AND consumed_at IS NULL AND expires_at>datetime('now') LIMIT 1`).bind(userId,purpose,await sha256Hex(raw)).first()
  if (!row) return null
  await c.env.DB.prepare(`UPDATE account_verified_actions SET consumed_at=datetime('now') WHERE id=?`).bind(String((row as any).id)).run()
  return row
}

app.get('/api/v1/me/account/credentials', requireAccount, async (c: any) => {
  const userId = c.get('accountUserId') as string
  const email = c.get('accountEmail') as string
  const [password, google] = await Promise.all([
    c.env.DB.prepare(`SELECT user_id FROM user_password_credentials WHERE user_id=? LIMIT 1`).bind(userId).first(),
    c.env.DB.prepare(`SELECT provider_email,last_used_at FROM user_auth_identities WHERE user_id=? AND provider='google' ORDER BY linked_at DESC LIMIT 1`).bind(userId).first(),
  ])
  return c.json({ ok: true, data: { email, password_enabled: !!password, google_linked: !!google, google_email: (google as any)?.provider_email || null, secure_email_access: true } })
})

app.post('/api/v1/me/account/credentials/verify/start', requireAccount, async (c: any) => {
  let body:any={}; try{body=await c.req.json()}catch{return c.json({ok:false,error:'Solicitud inválida.'},400)}
  const purpose = String(body?.purpose || '')
  if (!['password','email_change'].includes(purpose)) return c.json({ok:false,error:'Acción no válida.'},400)
  const result = await createChallenge(c,c.get('accountUserId'),c.get('accountEmail'),purpose)
  return result.ok ? c.json({ok:true}) : c.json(result,429)
})

app.post('/api/v1/me/account/credentials/verify/confirm', requireAccount, async (c:any) => {
  let body:any={}; try{body=await c.req.json()}catch{return c.json({ok:false,error:'Solicitud inválida.'},400)}
  const purpose=String(body?.purpose||''), code=String(body?.code||'').trim()
  if (!['password','email_change'].includes(purpose) || !/^\d{6}$/.test(code)) return c.json({ok:false,error:'Código inválido.'},400)
  const userId=c.get('accountUserId') as string, email=c.get('accountEmail') as string
  if (!(await verifyChallenge(c,userId,email,purpose,code))) return c.json({ok:false,error:'Código incorrecto o expirado.'},400)
  const raw=token(32), id=crypto.randomUUID()
  await c.env.DB.prepare(`INSERT INTO account_verified_actions(id,user_id,purpose,token_hash,expires_at,created_at) VALUES(?,?,?,?,datetime('now','+10 minutes'),datetime('now'))`).bind(id,userId,purpose,await sha256Hex(raw)).run()
  return c.json({ok:true,data:{verification_token:raw}})
})

app.post('/api/v1/me/account/password', requireAccount, async (c:any) => {
  let body:any={}; try{body=await c.req.json()}catch{return c.json({ok:false,error:'Solicitud inválida.'},400)}
  const userId=c.get('accountUserId') as string, password=String(body?.password||''), verification=String(body?.verification_token||'')
  if (password.length < 8 || password.length > 128) return c.json({ok:false,error:'La contraseña debe tener entre 8 y 128 caracteres.'},400)
  if (!(await consumeAction(c,userId,'password',verification))) return c.json({ok:false,error:'La verificación expiró. Solicita un nuevo código.'},403)
  const cred=await newPasswordRecord(password)
  await c.env.DB.prepare(`INSERT INTO user_password_credentials(user_id,password_salt,password_hash,failed_attempts,locked_until,created_at,updated_at) VALUES(?,?,?,0,NULL,datetime('now'),datetime('now')) ON CONFLICT(user_id) DO UPDATE SET password_salt=excluded.password_salt,password_hash=excluded.password_hash,failed_attempts=0,locked_until=NULL,updated_at=datetime('now')`).bind(userId,cred.salt,cred.hash).run()
  return c.json({ok:true})
})

app.post('/api/v1/me/account/email/change/start', requireAccount, async (c:any) => {
  let body:any={}; try{body=await c.req.json()}catch{return c.json({ok:false,error:'Solicitud inválida.'},400)}
  const userId=c.get('accountUserId') as string, newEmail=String(body?.new_email||'').trim().toLowerCase(), verification=String(body?.verification_token||'')
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) return c.json({ok:false,error:'Correo inválido.'},400)
  if (newEmail === String(c.get('accountEmail')).toLowerCase()) return c.json({ok:false,error:'Ese correo ya está vinculado a tu cuenta.'},400)
  if (!(await consumeAction(c,userId,'email_change',verification))) return c.json({ok:false,error:'La autorización expiró. Vuelve a validar tu correo actual.'},403)
  const exists=await c.env.DB.prepare(`SELECT id FROM users WHERE lower(email)=? AND id<>? LIMIT 1`).bind(newEmail,userId).first()
  if (exists) return c.json({ok:false,error:'Ese correo ya está vinculado a otra cuenta.'},409)
  const result=await createChallenge(c,userId,newEmail,'email_new')
  return result.ok ? c.json({ok:true}) : c.json(result,429)
})

app.post('/api/v1/me/account/email/change/confirm', requireAccount, async (c:any) => {
  let body:any={}; try{body=await c.req.json()}catch{return c.json({ok:false,error:'Solicitud inválida.'},400)}
  const userId=c.get('accountUserId') as string, newEmail=String(body?.new_email||'').trim().toLowerCase(), code=String(body?.code||'').trim()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail) || !/^\d{6}$/.test(code)) return c.json({ok:false,error:'Datos inválidos.'},400)
  if (!(await verifyChallenge(c,userId,newEmail,'email_new',code))) return c.json({ok:false,error:'Código incorrecto o expirado.'},400)
  const exists=await c.env.DB.prepare(`SELECT id FROM users WHERE lower(email)=? AND id<>? LIMIT 1`).bind(newEmail,userId).first()
  if (exists) return c.json({ok:false,error:'Ese correo ya está vinculado a otra cuenta.'},409)
  await c.env.DB.prepare(`UPDATE users SET email=? WHERE id=?`).bind(newEmail,userId).run()
  return c.json({ok:true,data:{email:newEmail}})
})

app.post('/api/v1/auth/password/login', async (c:any) => {
  let body:any={}; try{body=await c.req.json()}catch{return c.json({ok:false,error:'Solicitud inválida.'},400)}
  const email=String(body?.email||'').trim().toLowerCase(), password=String(body?.password||'')
  if (!email || !password) return c.json({ok:false,error:'Completa correo y contraseña.'},400)
  const row=await c.env.DB.prepare(`SELECT u.id user_id,pc.password_salt,pc.password_hash,pc.failed_attempts,pc.locked_until FROM users u JOIN user_password_credentials pc ON pc.user_id=u.id WHERE lower(u.email)=? LIMIT 1`).bind(email).first()
  if (!row) return c.json({ok:false,error:'Correo o contraseña incorrectos.'},401)
  if ((row as any).locked_until && new Date(String((row as any).locked_until)+'Z').getTime() > Date.now()) return c.json({ok:false,error:'Acceso temporalmente bloqueado. Intenta más tarde.'},423)
  const valid=constantTimeEqual(String((row as any).password_hash||''),await passwordHash(password,String((row as any).password_salt||'')))
  if (!valid) {
    const attempts=Number((row as any).failed_attempts||0)+1
    await c.env.DB.prepare(`UPDATE user_password_credentials SET failed_attempts=?,locked_until=CASE WHEN ?>=? THEN datetime('now','+15 minutes') ELSE locked_until END,updated_at=datetime('now') WHERE user_id=?`).bind(attempts,attempts,MAX_PASSWORD_ATTEMPTS,String((row as any).user_id)).run()
    return c.json({ok:false,error:'Correo o contraseña incorrectos.'},401)
  }
  const userId=String((row as any).user_id), raw=token(32), hash=await sha256Hex(raw), ip=c.req.header('CF-Connecting-IP')||c.req.header('X-Forwarded-For')||'', ua=c.req.header('User-Agent')||''
  await c.env.DB.batch([
    c.env.DB.prepare(`UPDATE user_password_credentials SET failed_attempts=0,locked_until=NULL,updated_at=datetime('now') WHERE user_id=?`).bind(userId),
    c.env.DB.prepare(`INSERT INTO auth_sessions(id,user_id,session_hash,expires_at,ip,user_agent,created_at) VALUES(?,?,?,datetime('now','+30 days'),?,?,datetime('now'))`).bind(crypto.randomUUID(),userId,hash,ip,ua),
  ])
  return c.json({ok:true},200,{'Set-Cookie':sessionCookie(c,raw)})
})

export default app
'''
write('api/src/account-access-methods.ts', api_module)

credentials_ui = r'''import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiGet, apiPost } from '../../../lib/api'

type CredentialsStatus = {
  email: string
  password_enabled: boolean
  google_linked: boolean
  google_email?: string | null
  secure_email_access: boolean
}

type Flow = 'idle' | 'password-code' | 'password-new' | 'email-current-code' | 'email-new' | 'email-new-code'

export default function FreeCredentials() {
  const navigate = useNavigate()
  const [status,setStatus]=useState<CredentialsStatus|null>(null)
  const [flow,setFlow]=useState<Flow>('idle')
  const [busy,setBusy]=useState(false)
  const [message,setMessage]=useState('')
  const [code,setCode]=useState('')
  const [verification,setVerification]=useState('')
  const [password,setPassword]=useState('')
  const [password2,setPassword2]=useState('')
  const [newEmail,setNewEmail]=useState('')
  const publicUrl=useMemo(()=>'',[])

  const load=async()=>{const j:any=await apiGet('/me/account/credentials').catch(()=>({ok:false}));if(j?.ok)setStatus(j.data)}
  useEffect(()=>{void load()},[])

  const startVerify=async(purpose:'password'|'email_change')=>{
    setBusy(true);setMessage('');setCode('')
    const j:any=await apiPost('/me/account/credentials/verify/start',{purpose}).catch(()=>({ok:false,error:'No pudimos enviar el código.'}))
    setBusy(false);if(!j?.ok)return setMessage(j.error||'No pudimos enviar el código.')
    setFlow(purpose==='password'?'password-code':'email-current-code');setMessage('Te enviamos un código de 6 dígitos a tu correo actual.')
  }
  const confirmVerify=async(purpose:'password'|'email_change')=>{
    setBusy(true);setMessage('')
    const j:any=await apiPost('/me/account/credentials/verify/confirm',{purpose,code}).catch(()=>({ok:false,error:'No pudimos validar el código.'}))
    setBusy(false);if(!j?.ok)return setMessage(j.error||'Código inválido.')
    setVerification(String(j.data?.verification_token||''));setCode('');setFlow(purpose==='password'?'password-new':'email-new')
  }
  const savePassword=async()=>{
    if(password.length<8)return setMessage('La contraseña debe tener al menos 8 caracteres.')
    if(password!==password2)return setMessage('Las contraseñas no coinciden.')
    setBusy(true);setMessage('')
    const j:any=await apiPost('/me/account/password',{verification_token:verification,password}).catch(()=>({ok:false,error:'No pudimos guardar la contraseña.'}))
    setBusy(false);if(!j?.ok)return setMessage(j.error||'No pudimos guardar la contraseña.')
    setFlow('idle');setVerification('');setPassword('');setPassword2('');setMessage('Contraseña Kawvo actualizada.');await load()
  }
  const startEmailNew=async()=>{
    setBusy(true);setMessage('')
    const j:any=await apiPost('/me/account/email/change/start',{verification_token:verification,new_email:newEmail}).catch(()=>({ok:false,error:'No pudimos validar el nuevo correo.'}))
    setBusy(false);if(!j?.ok)return setMessage(j.error||'No pudimos continuar.')
    setCode('');setFlow('email-new-code');setMessage(`Enviamos un código a ${newEmail}.`)
  }
  const confirmEmailNew=async()=>{
    setBusy(true);setMessage('')
    const j:any=await apiPost('/me/account/email/change/confirm',{new_email:newEmail,code}).catch(()=>({ok:false,error:'No pudimos cambiar el correo.'}))
    setBusy(false);if(!j?.ok)return setMessage(j.error||'No pudimos cambiar el correo.')
    setFlow('idle');setVerification('');setCode('');setNewEmail('');setMessage('Correo principal actualizado.');await load()
  }

  return <main className="min-h-screen bg-white pb-24 font-['Inter'] text-slate-900"><section className="mx-auto w-full max-w-[430px] px-5 pt-6">
    <div className="flex items-center gap-3 pb-5"><button type="button" onClick={()=>navigate('/admin/free/account')} className="text-[34px] font-light text-slate-500">←</button><div><h1 className="text-[30px] font-black tracking-[-.04em]">Credenciales</h1><p className="text-sm text-slate-500">Elige cómo acceder a tu cuenta Kawvo.</p></div></div>

    <div className="rounded-[24px] bg-[#f5f5f5] p-5">
      <p className="text-xs font-black uppercase tracking-[.12em] text-slate-400">Correo principal</p><p className="mt-2 break-all text-lg font-black">{status?.email||'Cargando…'}</p><p className="mt-1 text-sm leading-6 text-slate-500">Se usa para acceso seguro, verificaciones y recuperación de tu cuenta.</p>
      <button onClick={()=>void startVerify('email_change')} disabled={busy||!status} className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-cyan-700 disabled:opacity-40">Cambiar correo</button>
    </div>

    <div className="mt-4 rounded-[24px] bg-[#f5f5f5] p-5">
      <p className="text-xs font-black uppercase tracking-[.12em] text-slate-400">Métodos de acceso</p>
      <div className="mt-4 space-y-3 text-sm">
        <div className="flex items-center justify-between rounded-2xl bg-white p-4"><div><p className="font-black">Google</p><p className="mt-1 text-xs text-slate-500">{status?.google_linked?`Conectado${status.google_email?` · ${status.google_email}`:''}`:'Disponible desde el inicio de sesión'}</p></div><span className="text-emerald-600 font-black">{status?.google_linked?'✓':'○'}</span></div>
        <div className="flex items-center justify-between rounded-2xl bg-white p-4"><div><p className="font-black">Correo seguro</p><p className="mt-1 text-xs text-slate-500">Código/enlace enviado a tu correo principal</p></div><span className="text-emerald-600 font-black">✓</span></div>
        <div className="rounded-2xl bg-white p-4"><div className="flex items-center justify-between"><div><p className="font-black">Contraseña Kawvo</p><p className="mt-1 text-xs text-slate-500">Independiente de la contraseña de tu correo</p></div><span className={`font-black ${status?.password_enabled?'text-emerald-600':'text-slate-400'}`}>{status?.password_enabled?'✓':'○'}</span></div><button onClick={()=>void startVerify('password')} disabled={busy||!status} className="mt-3 rounded-xl bg-slate-950 px-4 py-3 text-xs font-black text-white disabled:opacity-40">{status?.password_enabled?'Cambiar contraseña':'Crear contraseña'}</button></div>
      </div>
    </div>

    {flow==='password-code'||flow==='email-current-code'?<div className="mt-4 rounded-[24px] border border-cyan-100 bg-cyan-50 p-5"><h2 className="text-lg font-black">Confirma que eres tú</h2><p className="mt-1 text-sm text-slate-600">Ingresa el código enviado a {status?.email}.</p><input value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,'').slice(0,6))} inputMode="numeric" placeholder="000000" className="mt-4 w-full rounded-2xl border border-cyan-200 bg-white px-4 py-4 text-center text-2xl font-black tracking-[.2em]"/><button onClick={()=>void confirmVerify(flow==='password-code'?'password':'email_change')} disabled={busy||code.length!==6} className="mt-3 w-full rounded-2xl bg-slate-950 px-4 py-4 text-sm font-black text-white disabled:opacity-40">Validar código</button></div>:null}

    {flow==='password-new'?<div className="mt-4 rounded-[24px] border border-slate-200 p-5"><h2 className="text-lg font-black">Nueva contraseña Kawvo</h2><p className="mt-1 text-sm text-slate-500">No tiene relación con la contraseña de tu correo.</p><input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Mínimo 8 caracteres" className="mt-4 w-full rounded-2xl border border-slate-200 px-4 py-4 text-sm"/><input type="password" value={password2} onChange={e=>setPassword2(e.target.value)} placeholder="Repetir contraseña" className="mt-3 w-full rounded-2xl border border-slate-200 px-4 py-4 text-sm"/><button onClick={()=>void savePassword()} disabled={busy} className="mt-3 w-full rounded-2xl bg-slate-950 px-4 py-4 text-sm font-black text-white disabled:opacity-40">Guardar contraseña</button></div>:null}

    {flow==='email-new'?<div className="mt-4 rounded-[24px] border border-slate-200 p-5"><h2 className="text-lg font-black">Nuevo correo</h2><p className="mt-1 text-sm text-slate-500">Primero verificaremos que el nuevo correo también te pertenece.</p><input type="email" value={newEmail} onChange={e=>setNewEmail(e.target.value)} placeholder="nuevo@email.com" className="mt-4 w-full rounded-2xl border border-slate-200 px-4 py-4 text-sm"/><button onClick={()=>void startEmailNew()} disabled={busy||!newEmail} className="mt-3 w-full rounded-2xl bg-slate-950 px-4 py-4 text-sm font-black text-white disabled:opacity-40">Enviar código al nuevo correo</button></div>:null}

    {flow==='email-new-code'?<div className="mt-4 rounded-[24px] border border-cyan-100 bg-cyan-50 p-5"><h2 className="text-lg font-black">Confirma el nuevo correo</h2><p className="mt-1 text-sm text-slate-600">Código enviado a {newEmail}.</p><input value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,'').slice(0,6))} inputMode="numeric" placeholder="000000" className="mt-4 w-full rounded-2xl border border-cyan-200 bg-white px-4 py-4 text-center text-2xl font-black tracking-[.2em]"/><button onClick={()=>void confirmEmailNew()} disabled={busy||code.length!==6} className="mt-3 w-full rounded-2xl bg-slate-950 px-4 py-4 text-sm font-black text-white disabled:opacity-40">Confirmar nuevo correo</button></div>:null}

    {message&&<p className="mt-4 rounded-2xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600">{message}</p>}
    <p className="mt-6 text-xs leading-5 text-slate-400">Los cambios sensibles requieren verificación por correo. Google y el acceso seguro por correo continúan disponibles aunque configures una contraseña Kawvo.</p>
  </section></main>
}
'''
write('app/src/components/admin/free/FreeCredentials.tsx', credentials_ui)

replace_once('api/src/preview-free-entry.ts', "import './account-center'\n", "import './account-center'\nimport './account-access-methods'\n", 'ensamblar API de credenciales')

old_google = """  // Upsert usuario
  await c.env.DB.prepare(
    `INSERT INTO users (id, email) VALUES (?, ?) ON CONFLICT(email) DO NOTHING`
  ).bind(crypto.randomUUID(), email).run()

  const user = await c.env.DB.prepare(
    `SELECT id FROM users WHERE email = ? LIMIT 1`
  ).bind(email).first()
  if (!user) return c.redirect(`${appUrl}/admin/login?error=user_error`)

  const userId = (user as any).id
"""
new_google = """  // Resolver identidad Google estable. El correo principal puede cambiar sin romper Google.
  const googleSubject = String(googleUser.id || '').trim()
  let user: any = null
  if (googleSubject) {
    const identity = await c.env.DB.prepare(
      `SELECT user_id FROM user_auth_identities WHERE provider='google' AND provider_subject=? LIMIT 1`
    ).bind(googleSubject).first().catch(() => null)
    if (identity) user = await c.env.DB.prepare(`SELECT id FROM users WHERE id=? LIMIT 1`).bind((identity as any).user_id).first()
  }

  if (!user) {
    await c.env.DB.prepare(
      `INSERT INTO users (id, email) VALUES (?, ?) ON CONFLICT(email) DO NOTHING`
    ).bind(crypto.randomUUID(), email).run()
    user = await c.env.DB.prepare(`SELECT id FROM users WHERE email = ? LIMIT 1`).bind(email).first()
  }
  if (!user) return c.redirect(`${appUrl}/admin/login?error=user_error`)

  const userId = (user as any).id
  if (googleSubject) {
    await c.env.DB.prepare(
      `INSERT INTO user_auth_identities(id,user_id,provider,provider_subject,provider_email,linked_at,last_used_at)
       VALUES(?,?,'google',?,?,datetime('now'),datetime('now'))
       ON CONFLICT(provider,provider_subject) DO UPDATE SET user_id=excluded.user_id,provider_email=excluded.provider_email,last_used_at=datetime('now')`
    ).bind(crypto.randomUUID(),userId,googleSubject,email).run().catch(() => undefined)
  }
"""
replace_once('api/src/index.ts', old_google, new_google, 'Google queda vinculado por identidad, no solo por correo')

replace_once('app/src/App.tsx', "import FreeAccount from './components/admin/free/FreeAccount'\n", "import FreeAccount from './components/admin/free/FreeAccount'\nimport FreeCredentials from './components/admin/free/FreeCredentials'\n", 'importar Credenciales')
replace_once('app/src/App.tsx', '<Route path="/admin/free/home" element={<AdminGuard planScope="free"><FreePwaHome/></AdminGuard>}/><Route path="/admin/free/account" element={<AdminGuard planScope="free"><FreeAccount/></AdminGuard>}/><Route path="/admin/free/notifications"', '<Route path="/admin/free/home" element={<AdminGuard planScope="free"><FreePwaHome/></AdminGuard>}/><Route path="/admin/free/account" element={<AdminGuard planScope="free"><FreeAccount/></AdminGuard>}/><Route path="/admin/free/credentials" element={<AdminGuard planScope="free"><FreeCredentials/></AdminGuard>}/><Route path="/admin/free/notifications"', 'ruta Credenciales')

needle = '            <SettingsRow tour="plan" icon={<span className="text-amber-500"><UpgradeCrownIcon className="h-6 w-6" /></span>} label="Mejora tu plan" detail="Conoce el Plan Plus" href={basicPlanWhatsAppUrl()} />\n'
insert = '            <SettingsRow icon={<svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="4" y="10" width="16" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>} label="Credenciales" detail="Google, correo y contraseña Kawvo" onClick={() => navigate(\'/admin/free/credentials\')} />\n' + needle
replace_once('app/src/components/admin/free/FreeAccount.tsx', needle, insert, 'acceso a Credenciales en Mi cuenta')

replace_once('app/src/components/admin/AdminLogin.tsx', "  const [email, setEmail] = useState('')\n", "  const [email, setEmail] = useState('')\n  const [password, setPassword] = useState('')\n  const [loginMethod, setLoginMethod] = useState<'email' | 'password'>('email')\n", 'estado login por contraseña')
old_submit = """    try {
      const json: any = await apiPost('/auth/magic-link/start', { email, mode })
      if (json.ok) {
        sessionStorage.setItem('magic_link_email', email)
        persistAuthMode(mode)
        if (teamResumeUrl) {
          sessionStorage.setItem('kawvo_team_resume_url', teamResumeUrl)
          localStorage.setItem('kawvo_team_resume_url', teamResumeUrl)
        }
        navigate('/admin/check-email')
      } else {
        setError(json.error || 'Error al enviar el enlace')
      }
"""
new_submit = """    try {
      if (mode === 'login' && loginMethod === 'password' && !hasProductContext) {
        const json: any = await apiPost('/auth/password/login', { email, password })
        if (json.ok) {
          persistAuthMode(mode)
          window.location.assign('/admin')
        } else {
          setError(json.error || 'Correo o contraseña incorrectos.')
        }
      } else {
        const json: any = await apiPost('/auth/magic-link/start', { email, mode })
        if (json.ok) {
          sessionStorage.setItem('magic_link_email', email)
          persistAuthMode(mode)
          if (teamResumeUrl) {
            sessionStorage.setItem('kawvo_team_resume_url', teamResumeUrl)
            localStorage.setItem('kawvo_team_resume_url', teamResumeUrl)
          }
          navigate('/admin/check-email')
        } else {
          setError(json.error || 'Error al enviar el enlace')
        }
      }
"""
replace_once('app/src/components/admin/AdminLogin.tsx', old_submit, new_submit, 'submit dual correo/contraseña')

old_form = """            <form onSubmit={handleSubmit} className="space-y-4">
              <label className="block text-xs font-extrabold uppercase tracking-[0.1em] text-slate-500">
                Correo electrónico
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nombre@email.com" required className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-400 focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100" />
              </label>
              {error && <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-600">{error}</p>}
              <button type="submit" disabled={loading} className="w-full rounded-2xl bg-slate-950 px-4 py-4 text-sm font-extrabold text-white transition hover:bg-slate-800 disabled:opacity-40">{loading ? 'Enviando…' : isTeamFlow ? 'Continuar como Master' : isRegister ? 'Validar mi correo' : 'Continuar'}</button>
            </form>
"""
new_form = """            {!isRegister && !hasProductContext && <div className="mb-4 grid grid-cols-2 gap-1 rounded-2xl bg-slate-100 p-1"><button type="button" onClick={() => { setLoginMethod('email'); setError('') }} className={`rounded-xl px-3 py-2.5 text-xs font-black ${loginMethod === 'email' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500'}`}>Correo seguro</button><button type="button" onClick={() => { setLoginMethod('password'); setError('') }} className={`rounded-xl px-3 py-2.5 text-xs font-black ${loginMethod === 'password' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500'}`}>Contraseña Kawvo</button></div>}
            <form onSubmit={handleSubmit} className="space-y-4">
              <label className="block text-xs font-extrabold uppercase tracking-[0.1em] text-slate-500">
                Correo electrónico
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nombre@email.com" required className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-400 focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100" />
              </label>
              {!isRegister && loginMethod === 'password' && !hasProductContext && <label className="block text-xs font-extrabold uppercase tracking-[0.1em] text-slate-500">Contraseña Kawvo<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Tu contraseña Kawvo" required className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-400 focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100" /></label>}
              {error && <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-600">{error}</p>}
              <button type="submit" disabled={loading} className="w-full rounded-2xl bg-slate-950 px-4 py-4 text-sm font-extrabold text-white transition hover:bg-slate-800 disabled:opacity-40">{loading ? 'Procesando…' : isTeamFlow ? 'Continuar como Master' : isRegister ? 'Validar mi correo' : loginMethod === 'password' && !hasProductContext ? 'Entrar con contraseña' : 'Continuar'}</button>
            </form>
"""
replace_once('app/src/components/admin/AdminLogin.tsx', old_form, new_form, 'selector de método en Login')

print('✓ PATCH ACCOUNT ACCESS METHODS V1 COMPLETO')
