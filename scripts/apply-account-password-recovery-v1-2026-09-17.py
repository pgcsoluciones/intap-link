from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
api = ROOT / 'api/src/account-access-methods.ts'
login = ROOT / 'app/src/components/admin/AdminLogin.tsx'


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f'No se encontró bloque esperado: {label}')
    return text.replace(old, new, 1)

# ---------------- API ----------------
s = api.read_text()

s = replace_once(
    s,
    "function clearCredentialActionCookie(c: any) {\n  return credentialActionCookie(c, '', 0)\n}\n",
    "function clearCredentialActionCookie(c: any) {\n  return credentialActionCookie(c, '', 0)\n}\nfunction passwordResetCookieName(c: any) {\n  return isPreviewEnvironment(c.env) ? 'kawvo_preview_password_reset' : 'kawvo_password_reset'\n}\nfunction passwordResetCookie(c: any, value: string, maxAge = 10 * 60) {\n  return buildScopedCookie(c.env, appUrl(c), passwordResetCookieName(c), value, maxAge, '/api/v1/auth/password')\n}\nfunction clearPasswordResetCookie(c: any) {\n  return passwordResetCookie(c, '', 0)\n}\n",
    'password reset cookie helpers',
)

s = replace_once(
    s,
    "  const label = purpose === 'email_new' ? 'confirmar tu nuevo correo' : purpose === 'email_change' ? 'autorizar el cambio de correo' : 'autorizar el cambio de contraseña'\n",
    "  const label = purpose === 'email_new' ? 'confirmar tu nuevo correo' : purpose === 'email_change' ? 'autorizar el cambio de correo' : purpose === 'password_reset' ? 'restablecer tu contraseña Kawvo' : 'autorizar el cambio de contraseña'\n",
    'verification email label',
)

s = replace_once(
    s,
    "async function createVerifiedAction(c: any, userId: string, sessionId: string, purpose: string, targetEmail?: string) {\n",
    "async function createVerifiedAction(c: any, userId: string, sessionId: string | null, purpose: string, targetEmail?: string) {\n",
    'nullable recovery session',
)
s = replace_once(
    s,
    ".bind(crypto.randomUUID(),userId,sessionId,purpose,await sha256Hex(raw),targetEmail || null).run()\n",
    ".bind(crypto.randomUUID(),userId,sessionId || null,purpose,await sha256Hex(raw),targetEmail || null).run()\n",
    'nullable session bind',
)

recovery_helper = """async function getPasswordResetAction(c: any) {
  const raw = parseCookie(c.req.header('Cookie') || '', passwordResetCookieName(c))
  if (!raw) return null
  return c.env.DB.prepare(`SELECT id,user_id,target_email FROM account_verified_actions WHERE purpose='password_reset' AND token_hash=? AND consumed_at IS NULL AND expires_at>datetime('now') ORDER BY created_at DESC LIMIT 1`).bind(await sha256Hex(raw)).first()
}

"""
s = replace_once(
    s,
    "app.get('/api/v1/me/account/credentials', requireAccount, async (c: any) => {\n",
    recovery_helper + "app.get('/api/v1/me/account/credentials', requireAccount, async (c: any) => {\n",
    'password reset action lookup',
)

recovery_endpoints = r"""
app.post('/api/v1/auth/password/reset/start', async (c:any) => {
  let body:any={}; try{body=await c.req.json()}catch{return c.json({ok:false,error:'Solicitud inválida.'},400)}
  const email=String(body?.email||'').trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return c.json({ok:false,error:'Correo inválido.'},400)
  const user=await c.env.DB.prepare(`SELECT id,email FROM users WHERE lower(email)=? LIMIT 1`).bind(email).first()
  // Respuesta uniforme para no revelar si una cuenta existe.
  if (!user) return c.json({ok:true,message:'Si el correo está registrado, recibirás un código de verificación.'})
  const result=await createChallenge(c,String((user as any).id),String((user as any).email||email).toLowerCase(),'password_reset')
  if (!result.ok && Number(result.status||500) >= 500) return c.json({ok:false,error:result.error},result.status||503)
  return c.json({ok:true,message:'Si el correo está registrado, recibirás un código de verificación.'})
})

app.post('/api/v1/auth/password/reset/confirm', async (c:any) => {
  let body:any={}; try{body=await c.req.json()}catch{return c.json({ok:false,error:'Solicitud inválida.'},400)}
  const email=String(body?.email||'').trim().toLowerCase(), code=String(body?.code||'').trim()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !/^\d{6}$/.test(code)) return c.json({ok:false,error:'Código inválido.'},400)
  const user=await c.env.DB.prepare(`SELECT id,email FROM users WHERE lower(email)=? LIMIT 1`).bind(email).first()
  if (!user) return c.json({ok:false,error:'Código incorrecto o expirado.'},400)
  const userId=String((user as any).id), canonicalEmail=String((user as any).email||email).toLowerCase()
  if (!(await verifyChallenge(c,userId,canonicalEmail,'password_reset',code))) return c.json({ok:false,error:'Código incorrecto o expirado.'},400)
  const rawAction=await createVerifiedAction(c,userId,null,'password_reset',canonicalEmail)
  return c.json({ok:true},200,{'Set-Cookie':passwordResetCookie(c,rawAction)})
})

app.post('/api/v1/auth/password/reset/complete', async (c:any) => {
  let body:any={}; try{body=await c.req.json()}catch{return c.json({ok:false,error:'Solicitud inválida.'},400)}
  const password=String(body?.password||'')
  if (password.length < 8 || password.length > 128) return c.json({ok:false,error:'La contraseña debe tener entre 8 y 128 caracteres.'},400)
  const action=await getPasswordResetAction(c)
  if (!action) return c.json({ok:false,error:'La verificación expiró. Solicita un nuevo código.'},403)
  const userId=String((action as any).user_id), cred=await newPasswordRecord(password)
  await c.env.DB.batch([
    c.env.DB.prepare(`INSERT INTO user_password_credentials(user_id,password_salt,password_hash,failed_attempts,locked_until,created_at,updated_at) VALUES(?,?,?,0,NULL,datetime('now'),datetime('now')) ON CONFLICT(user_id) DO UPDATE SET password_salt=excluded.password_salt,password_hash=excluded.password_hash,failed_attempts=0,locked_until=NULL,updated_at=datetime('now')`).bind(userId,cred.salt,cred.hash),
    c.env.DB.prepare(`UPDATE account_verified_actions SET consumed_at=datetime('now') WHERE id=? AND consumed_at IS NULL`).bind(String((action as any).id)),
    c.env.DB.prepare(`UPDATE auth_sessions SET revoked_at=datetime('now') WHERE user_id=? AND revoked_at IS NULL`).bind(userId),
  ])
  return c.json({ok:true},200,{'Set-Cookie':clearPasswordResetCookie(c)})
})

"""
s = replace_once(
    s,
    "app.post('/api/v1/auth/password/login', async (c:any) => {\n",
    recovery_endpoints + "app.post('/api/v1/auth/password/login', async (c:any) => {\n",
    'password recovery endpoints',
)

api.write_text(s)

# ---------------- APP LOGIN ----------------
t = login.read_text()

t = replace_once(
    t,
    "  const [password, setPassword] = useState('')\n",
    "  const [password, setPassword] = useState('')\n  const [recoveryStage, setRecoveryStage] = useState<'idle' | 'email' | 'code' | 'new' | 'done'>('idle')\n  const [recoveryCode, setRecoveryCode] = useState('')\n  const [recoveryPassword, setRecoveryPassword] = useState('')\n  const [recoveryConfirm, setRecoveryConfirm] = useState('')\n",
    'recovery states',
)

handlers = r"""
  const startPasswordRecovery = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setLoading(true)
    try {
      const json:any = await apiPost('/auth/password/reset/start', { email })
      if (json?.ok) setRecoveryStage('code')
      else setError(json?.error || 'No pudimos enviar el código.')
    } catch { setError('Error de conexión') } finally { setLoading(false) }
  }

  const confirmPasswordRecovery = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setLoading(true)
    try {
      const json:any = await apiPost('/auth/password/reset/confirm', { email, code: recoveryCode })
      if (json?.ok) setRecoveryStage('new')
      else setError(json?.error || 'Código incorrecto o expirado.')
    } catch { setError('Error de conexión') } finally { setLoading(false) }
  }

  const completePasswordRecovery = async (e: React.FormEvent) => {
    e.preventDefault(); setError('')
    if (recoveryPassword.length < 8) { setError('La contraseña debe tener al menos 8 caracteres.'); return }
    if (recoveryPassword !== recoveryConfirm) { setError('Las contraseñas no coinciden.'); return }
    setLoading(true)
    try {
      const json:any = await apiPost('/auth/password/reset/complete', { password: recoveryPassword })
      if (json?.ok) {
        setPassword(''); setRecoveryCode(''); setRecoveryPassword(''); setRecoveryConfirm(''); setRecoveryStage('done')
      } else setError(json?.error || 'No pudimos restablecer la contraseña.')
    } catch { setError('Error de conexión') } finally { setLoading(false) }
  }

"""
t = replace_once(t, "  const handleGoogle = () => {\n", handlers + "  const handleGoogle = () => {\n", 'recovery handlers')

t = replace_once(
    t,
    "            {!isRegister && !hasProductContext && <div className=\"mb-4 grid grid-cols-2 gap-1 rounded-2xl bg-slate-100 p-1\">",
    "            {!isRegister && !hasProductContext && recoveryStage === 'idle' && <div className=\"mb-4 grid grid-cols-2 gap-1 rounded-2xl bg-slate-100 p-1\">",
    'hide login method tabs while recovering',
)

t = replace_once(
    t,
    "            <form onSubmit={handleSubmit} className=\"space-y-4\">\n",
    "            <form onSubmit={handleSubmit} className={`space-y-4 ${recoveryStage !== 'idle' ? 'hidden' : ''}`}>\n",
    'hide login form while recovering',
)

forgot_anchor = "              {!isRegister && loginMethod === 'password' && !hasProductContext && <label className=\"block text-xs font-extrabold uppercase tracking-[0.1em] text-slate-500\">Contraseña Kawvo<input type=\"password\" value={password} onChange={(e) => setPassword(e.target.value)} placeholder=\"Tu contraseña Kawvo\" required className=\"mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-400 focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100\" /></label>}\n"
forgot_new = forgot_anchor + "              {!isRegister && loginMethod === 'password' && !hasProductContext && <button type=\"button\" onClick={() => { setRecoveryStage('email'); setError('') }} className=\"-mt-1 block w-full text-right text-xs font-extrabold text-cyan-700 hover:text-cyan-800\">Olvidé mi contraseña</button>}\n"
t = replace_once(t, forgot_anchor, forgot_new, 'forgot password link')

recovery_ui = r"""

            {recoveryStage !== 'idle' && <div className="space-y-4">
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-sm font-black text-slate-950">Restablecer contraseña</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">Usaremos un código enviado a tu correo para confirmar que eres el dueño de la cuenta.</p>
              </div>

              {recoveryStage === 'email' && <form onSubmit={startPasswordRecovery} className="space-y-4">
                <label className="block text-xs font-extrabold uppercase tracking-[0.1em] text-slate-500">Correo electrónico<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nombre@email.com" required autoComplete="email" className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-400 focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100" /></label>
                {error && <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-600">{error}</p>}
                <button type="submit" disabled={loading} className="w-full rounded-2xl bg-slate-950 px-4 py-4 text-sm font-extrabold text-white disabled:opacity-40">{loading ? 'Enviando…' : 'Enviar código'}</button>
              </form>}

              {recoveryStage === 'code' && <form onSubmit={confirmPasswordRecovery} className="space-y-4">
                <p className="text-xs leading-5 text-slate-500">Si <strong>{email}</strong> está registrado, recibirás un código de 6 dígitos. Expira en 10 minutos.</p>
                <label className="block text-xs font-extrabold uppercase tracking-[0.1em] text-slate-500">Código de verificación<input inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={recoveryCode} onChange={(e) => setRecoveryCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" required className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-center text-lg font-black tracking-[0.25em] text-slate-900 outline-none focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100" /></label>
                {error && <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-600">{error}</p>}
                <button type="submit" disabled={loading || recoveryCode.length !== 6} className="w-full rounded-2xl bg-slate-950 px-4 py-4 text-sm font-extrabold text-white disabled:opacity-40">{loading ? 'Validando…' : 'Validar código'}</button>
                <button type="button" onClick={() => { setRecoveryStage('email'); setRecoveryCode(''); setError('') }} className="w-full text-xs font-extrabold text-cyan-700">Enviar otro código</button>
              </form>}

              {recoveryStage === 'new' && <form onSubmit={completePasswordRecovery} className="space-y-4">
                <label className="block text-xs font-extrabold uppercase tracking-[0.1em] text-slate-500">Nueva contraseña Kawvo<input type="password" value={recoveryPassword} onChange={(e) => setRecoveryPassword(e.target.value)} minLength={8} maxLength={128} autoComplete="new-password" required className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-semibold text-slate-900 outline-none focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100" /></label>
                <label className="block text-xs font-extrabold uppercase tracking-[0.1em] text-slate-500">Repetir contraseña<input type="password" value={recoveryConfirm} onChange={(e) => setRecoveryConfirm(e.target.value)} minLength={8} maxLength={128} autoComplete="new-password" required className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-semibold text-slate-900 outline-none focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100" /></label>
                {error && <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-600">{error}</p>}
                <button type="submit" disabled={loading} className="w-full rounded-2xl bg-slate-950 px-4 py-4 text-sm font-extrabold text-white disabled:opacity-40">{loading ? 'Guardando…' : 'Restablecer contraseña'}</button>
              </form>}

              {recoveryStage === 'done' && <div className="space-y-4">
                <div className="rounded-2xl bg-emerald-50 px-4 py-4 text-sm font-bold text-emerald-800">Contraseña Kawvo restablecida. Ya puedes acceder con tu nueva contraseña.</div>
                <button type="button" onClick={() => { setRecoveryStage('idle'); setLoginMethod('password'); setError('') }} className="w-full rounded-2xl bg-slate-950 px-4 py-4 text-sm font-extrabold text-white">Volver a acceder</button>
              </div>}

              {recoveryStage !== 'done' && <button type="button" onClick={() => { setRecoveryStage('idle'); setRecoveryCode(''); setRecoveryPassword(''); setRecoveryConfirm(''); setError('') }} className="w-full text-xs font-extrabold text-slate-500">Cancelar</button>}
            </div>}
"""
t = replace_once(t, "            </form>\n\n            <div className=\"my-5 flex items-center gap-3\">", "            </form>" + recovery_ui + "\n            <div className=\"my-5 flex items-center gap-3\">", 'recovery panel')

login.write_text(t)
print('✓ Password recovery patch aplicado')
