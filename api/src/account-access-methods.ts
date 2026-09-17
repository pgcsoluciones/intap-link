import app from './preview-entry'
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
function credentialActionCookieName(c: any) {
  return isPreviewEnvironment(c.env) ? 'kawvo_preview_credential_action' : 'kawvo_credential_action'
}
function credentialActionCookie(c: any, value: string, maxAge = 10 * 60) {
  return buildScopedCookie(c.env, appUrl(c), credentialActionCookieName(c), value, maxAge, '/api/v1/me/account')
}
function clearCredentialActionCookie(c: any) {
  return credentialActionCookie(c, '', 0)
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
  c.set('accountSessionId', String((row as any).session_id || ''))
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
  if (Number((recent as any)?.n || 0) >= 5) return { ok: false, status: 429, error: 'Demasiados intentos. Espera unos minutos.' }
  const id = crypto.randomUUID(), code = code6(), codeHash = await sha256Hex(`${id}:${code}`)
  await c.env.DB.prepare(`INSERT INTO account_verification_challenges(id,user_id,email,purpose,code_hash,expires_at,created_at) VALUES(?,?,?,?,?,datetime('now','+10 minutes'),datetime('now'))`).bind(id,userId,email,purpose,codeHash).run()
  try {
    await sendVerificationCode(c,email,code,purpose)
  } catch (error: any) {
    console.error('[account-credentials] verification email failed', { purpose, email, message: error?.message || String(error) })
    await c.env.DB.prepare(`DELETE FROM account_verification_challenges WHERE id=?`).bind(id).run().catch(() => undefined)
    const missingProvider = !c.env.RESEND_API_KEY
    return {
      ok: false,
      status: 503,
      error: missingProvider
        ? 'El servicio de verificación por correo no está configurado en este entorno.'
        : 'No pudimos enviar el código de verificación. Intenta nuevamente.',
    }
  }
  return { ok: true, status: 200 }
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
async function createVerifiedAction(c: any, userId: string, sessionId: string, purpose: string, targetEmail?: string) {
  const raw = token(32)
  await c.env.DB.prepare(`UPDATE account_verified_actions SET consumed_at=datetime('now') WHERE user_id=? AND purpose=? AND consumed_at IS NULL`).bind(userId,purpose).run()
  await c.env.DB.prepare(`INSERT INTO account_verified_actions(id,user_id,session_id,purpose,token_hash,target_email,expires_at,created_at) VALUES(?,?,?,?,?,?,datetime('now','+10 minutes'),datetime('now'))`).bind(crypto.randomUUID(),userId,sessionId,purpose,await sha256Hex(raw),targetEmail || null).run()
  return raw
}
async function consumeVerifiedAction(c: any, userId: string, purpose: string) {
  const raw = parseCookie(c.req.header('Cookie') || '', credentialActionCookieName(c))
  if (!raw) return null
  const row = await c.env.DB.prepare(`SELECT id,target_email FROM account_verified_actions WHERE user_id=? AND purpose=? AND token_hash=? AND consumed_at IS NULL AND expires_at>datetime('now') ORDER BY created_at DESC LIMIT 1`).bind(userId,purpose,await sha256Hex(raw)).first()
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
  return result.ok ? c.json({ok:true}) : c.json({ok:false,error:result.error}, result.status || 500)
})

app.post('/api/v1/me/account/credentials/verify/confirm', requireAccount, async (c:any) => {
  let body:any={}; try{body=await c.req.json()}catch{return c.json({ok:false,error:'Solicitud inválida.'},400)}
  const purpose=String(body?.purpose||''), code=String(body?.code||'').trim()
  if (!['password','email_change'].includes(purpose) || !/^\d{6}$/.test(code)) return c.json({ok:false,error:'Código inválido.'},400)
  const userId=c.get('accountUserId') as string, email=c.get('accountEmail') as string, sessionId=c.get('accountSessionId') as string
  if (!(await verifyChallenge(c,userId,email,purpose,code))) return c.json({ok:false,error:'Código incorrecto o expirado.'},400)
  const rawAction = await createVerifiedAction(c,userId,sessionId,purpose)
  return c.json({ok:true},200,{'Set-Cookie':credentialActionCookie(c,rawAction)})
})

app.post('/api/v1/me/account/password', requireAccount, async (c:any) => {
  let body:any={}; try{body=await c.req.json()}catch{return c.json({ok:false,error:'Solicitud inválida.'},400)}
  const userId=c.get('accountUserId') as string, password=String(body?.password||'')
  if (password.length < 8 || password.length > 128) return c.json({ok:false,error:'La contraseña debe tener entre 8 y 128 caracteres.'},400)
  if (!(await consumeVerifiedAction(c,userId,'password'))) return c.json({ok:false,error:'La verificación expiró. Solicita un nuevo código.'},403)
  const cred=await newPasswordRecord(password)
  await c.env.DB.prepare(`INSERT INTO user_password_credentials(user_id,password_salt,password_hash,failed_attempts,locked_until,created_at,updated_at) VALUES(?,?,?,0,NULL,datetime('now'),datetime('now')) ON CONFLICT(user_id) DO UPDATE SET password_salt=excluded.password_salt,password_hash=excluded.password_hash,failed_attempts=0,locked_until=NULL,updated_at=datetime('now')`).bind(userId,cred.salt,cred.hash).run()
  return c.json({ok:true},200,{'Set-Cookie':clearCredentialActionCookie(c)})
})

app.post('/api/v1/me/account/email/change/start', requireAccount, async (c:any) => {
  let body:any={}; try{body=await c.req.json()}catch{return c.json({ok:false,error:'Solicitud inválida.'},400)}
  const userId=c.get('accountUserId') as string, newEmail=String(body?.new_email||'').trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) return c.json({ok:false,error:'Correo inválido.'},400)
  if (newEmail === String(c.get('accountEmail')).toLowerCase()) return c.json({ok:false,error:'Ese correo ya está vinculado a tu cuenta.'},400)
  if (!(await consumeVerifiedAction(c,userId,'email_change'))) return c.json({ok:false,error:'La autorización expiró. Vuelve a validar tu correo actual.'},403)
  const exists=await c.env.DB.prepare(`SELECT id FROM users WHERE lower(email)=? AND id<>? LIMIT 1`).bind(newEmail,userId).first()
  if (exists) return c.json({ok:false,error:'Ese correo ya está vinculado a otra cuenta.'},409)
  const result=await createChallenge(c,userId,newEmail,'email_new')
  if (!result.ok) return c.json({ok:false,error:result.error}, result.status || 500)
  return c.json({ok:true},200,{'Set-Cookie':clearCredentialActionCookie(c)})
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
