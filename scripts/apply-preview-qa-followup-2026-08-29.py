from pathlib import Path


def patch(path, transform):
    p = Path(path)
    if not p.exists():
        raise SystemExit(f'Missing {path}')
    before = p.read_text()
    after = transform(before)
    if after == before:
        raise SystemExit(f'No changes produced for {path}')
    p.write_text(after)
    print(f'✓ {path}')


def replace_once(s, old, new, label):
    if old not in s:
        raise SystemExit(f'No encontré bloque esperado: {label}')
    return s.replace(old, new, 1)


# Dashboard: avatar opens the picker/cropper directly, dark card copy is forced readable,
# publish lifecycle notification is triggered only through an idempotent server endpoint,
# and remaining user-facing identifier copy becomes "usuario".
def dashboard(s):
    s = replace_once(s,
        "import { useEffect, useState } from 'react'",
        "import { useEffect, useRef, useState } from 'react'",
        'dashboard react import')
    s = replace_once(s,
        "import { apiGet, apiPost, apiPut } from '../../../lib/api'",
        "import { apiGet, apiPost, apiPut, apiUpload } from '../../../lib/api'\nimport ImageCropModal from '../ImageCropModal'",
        'dashboard api/crop imports')

    s = replace_once(s,
        "  const navigate = useNavigate()\n  const [me, setMe] = useState<MeData | null>(null)",
        "  const navigate = useNavigate()\n  const avatarInputRef = useRef<HTMLInputElement>(null)\n  const [avatarFile, setAvatarFile] = useState<File | null>(null)\n  const [avatarUploading, setAvatarUploading] = useState(false)\n  const [avatarError, setAvatarError] = useState('')\n  const [me, setMe] = useState<MeData | null>(null)",
        'dashboard avatar state')

    s = replace_once(s,
        "      if (result.ok) {\n        setMe({ ...me, is_published: next })\n",
        "      if (result.ok) {\n        setMe({ ...me, is_published: next })\n        if (next === 1) void apiPost('/me/notifications/profile-published', {}).catch(() => undefined)\n",
        'publish notification trigger')

    marker = """  const copyPublicUrl = async (url: string) => {
"""
    avatar_handlers = """  const chooseAvatar = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null
    if (avatarInputRef.current) avatarInputRef.current.value = ''
    if (!file || avatarUploading) return
    setAvatarError('')
    setAvatarFile(file)
  }

  const uploadAvatar = async (blob: Blob) => {
    if (avatarUploading) return
    setAvatarFile(null)
    setAvatarUploading(true)
    setAvatarError('')
    try {
      const form = new FormData()
      form.append('file', blob, 'avatar.jpg')
      const result: any = await apiUpload('/me/profile/avatar', form)
      if (!result?.ok || !result?.avatar_url) {
        setAvatarError(result?.error || 'No pudimos cambiar tu foto.')
        return
      }
      setMe((current) => current ? { ...current, avatar_url: result.avatar_url } : current)
    } catch {
      setAvatarError('No pudimos cambiar tu foto.')
    } finally {
      setAvatarUploading(false)
    }
  }

""" + marker
    s = replace_once(s, marker, avatar_handlers, 'dashboard avatar handlers')

    s = s.replace("!readiness?.steps?.identifier ? 'tu identificador' : ''", "!readiness?.steps?.identifier ? 'tu usuario' : ''", 1)

    old_avatar = """            <button type="button" onClick={() => navigate('/admin/free/onboarding/identity')} aria-label="Cambiar foto de perfil" className="h-16 w-16 shrink-0 overflow-hidden rounded-full border border-slate-200 bg-slate-100 ring-offset-2 transition hover:ring-2 hover:ring-cyan-300">
              {me?.avatar_url ? <img src={me.avatar_url} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-2xl text-slate-400">👤</div>}
            </button>
"""
    new_avatar = """            <div className="relative shrink-0">
              <button type="button" onClick={() => avatarInputRef.current?.click()} disabled={avatarUploading} aria-label="Cambiar foto de perfil" className="relative h-16 w-16 overflow-hidden rounded-full border border-slate-200 bg-slate-100 ring-offset-2 transition hover:ring-2 hover:ring-cyan-300 disabled:opacity-60">
                {me?.avatar_url ? <img src={me.avatar_url} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-2xl text-slate-400">👤</div>}
                <span className="absolute inset-x-0 bottom-0 bg-slate-950/75 py-1 text-center text-[9px] font-black text-white">{avatarUploading ? 'Subiendo…' : 'Cambiar'}</span>
              </button>
              <input ref={avatarInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" disabled={avatarUploading} onChange={chooseAvatar} />
            </div>
"""
    s = replace_once(s, old_avatar, new_avatar, 'dashboard direct avatar')

    s = s.replace('<span className="block text-base font-black">Personaliza el diseño de tu perfil</span>', '<span className="block text-base font-black" style={{ color: \'#FFFFFF\' }}>Personaliza el diseño de tu perfil</span>', 1)
    s = s.replace('<span className="mt-1 block text-xs font-medium text-slate-300">Plantilla, colores y apariencia visual de tu perfil.</span>', '<span className="mt-1 block text-xs font-medium" style={{ color: \'#E2E8F0\' }}>Plantilla, colores y apariencia visual de tu perfil.</span>', 1)

    # Render cropper at component root and show upload error close to avatar card.
    s = replace_once(s,
        "  return (\n    <main className=\"min-h-screen bg-[#f7f9fc] pb-24 font-['Inter'] text-slate-950\">",
        "  return (\n    <>\n      {avatarFile && <ImageCropModal file={avatarFile} aspectRatio={1} outputWidth={400} onSave={uploadAvatar} onCancel={() => setAvatarFile(null)} />}\n    <main className=\"min-h-screen bg-[#f7f9fc] pb-24 font-['Inter'] text-slate-950\">",
        'dashboard crop modal root')
    # Close fragment at final component end.
    pos = s.rfind('    </main>\n  )')
    if pos < 0:
        raise SystemExit('No encontré cierre de Dashboard')
    s = s[:pos] + '    </main>\n    </>\n  )' + s[pos + len('    </main>\n  )'):]
    s = s.replace("          </div>\n          <button type=\"button\" onClick={() => navigate('/admin/free/editor')}", "          </div>\n          {avatarError && <p className=\"mt-3 rounded-xl bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700\">{avatarError}</p>}\n          <button type=\"button\" onClick={() => navigate('/admin/free/editor')}", 1)
    return s

patch('app/src/components/admin/free/FreeDashboard.tsx', dashboard)


# Visual editor: preserve scroll position when toggling preview/edit and use the requested label.
def editor(s):
    s = replace_once(s,
        "import { useEffect, useMemo, useState } from 'react'",
        "import { useEffect, useMemo, useRef, useState } from 'react'",
        'editor react import')
    s = replace_once(s,
        "  const navigate = useNavigate()\n  const [loading, setLoading] = useState(true)",
        "  const navigate = useNavigate()\n  const editScrollRef = useRef(0)\n  const [loading, setLoading] = useState(true)",
        'editor scroll ref')

    marker = """  const refreshPreview = () => setPreviewVersion((value) => value + 1)
"""
    helpers = marker + """
  function showPreview() {
    editScrollRef.current = window.scrollY
    setMobileMode('preview')
    window.scrollTo({ top: 0, behavior: 'auto' })
  }

  function showEdit() {
    setMobileMode('edit')
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => window.scrollTo({ top: editScrollRef.current, behavior: 'auto' }))
    })
  }
"""
    s = replace_once(s, marker, helpers, 'editor mode helpers')
    s = s.replace("onClick={() => setMobileMode('edit')}", "onClick={showEdit}", 1)
    s = s.replace("onClick={() => setMobileMode('preview')}", "onClick={showPreview}", 1)
    s = s.replace('>Vista pública</button>', '>Vista previa</button>', 1)
    s = s.replace('Reserva tu identificador para ver la vista previa.', 'Elige tu usuario para ver la vista previa.', 1)
    return s

patch('app/src/components/admin/free/FreeVisualEditor.tsx', editor)


# Publish readiness: only explain what the user needs; remove internal implementation commentary.
def guide(s):
    s = s.replace("? 'Completaste los datos mínimos de publicación.'", "? 'Cumples los requisitos necesarios para publicar tu perfil.'", 1)
    old = """      <p className="mt-3 text-xs font-semibold leading-5 text-slate-500">
        No repetimos aquí cada sección: usa las tarjetas del panel para completar o editar tus datos. Los apartados opcionales no afectan este progreso.
      </p>
"""
    new = """      {!readiness.ready && <p className="mt-3 text-xs font-semibold leading-5 text-slate-500">
        Completa los apartados pendientes para habilitar la publicación.
      </p>}
"""
    return replace_once(s, old, new, 'guide internal copy')

patch('app/src/components/admin/free/FreeFirstRunGuide.tsx', guide)


# Banking: every back action returns to the main panel; add a second one at the bottom.
def banks(s):
    s = s.replace("navigate('/admin/free/editor')", "navigate('/admin/free')")
    closing = """      </section>
    </main>
  )
}
"""
    addition = """        <div className="mt-6"><FreeBackButton onClick={() => navigate('/admin/free')} /></div>
      </section>
    </main>
  )
}
"""
    return replace_once(s, closing, addition, 'bank bottom back')

patch('app/src/components/admin/free/FreeBankAccounts.tsx', banks)


# Identifier screen: user-facing language becomes "usuario"; internal slug terminology remains untouched.
def identifier(s):
    replacements = {
        'No pudimos reservar ese identificador.': 'No pudimos guardar ese usuario.',
        'Ese identificador ya está siendo usado por otro perfil. Prueba con otro.': 'Ese usuario ya está siendo usado por otro perfil. Prueba con otro.',
        'Reserva tu identificador': 'Elige tu usuario',
        'El identificador que ves ahora es temporal.': 'El usuario que ves ahora es temporal.',
        'Tu identificador': 'Tu usuario',
        'Reservar mi identificador': 'Guardar mi usuario',
    }
    changed = False
    for old, new in replacements.items():
        if old in s:
            s = s.replace(old, new)
            changed = True
    if not changed:
        raise SystemExit('No encontré textos de identificador para actualizar')
    return s

patch('app/src/components/admin/free/FreeIdentifier.tsx', identifier)


# Activation flow: create one welcome notification after successful activation. The endpoint is idempotent.
def activation(s):
    s = replace_once(s,
        "      sessionStorage.setItem('kawvo_free_artifact_activated', activatedCode)\n      navigate('/admin/free', { replace: true })",
        "      sessionStorage.setItem('kawvo_free_artifact_activated', activatedCode)\n      await apiPost('/me/notifications/welcome', {}).catch(() => undefined)\n      navigate('/admin/free', { replace: true })",
        'scan welcome notification')
    s = replace_once(s,
        "    sessionStorage.setItem('kawvo_free_artifact_activated', result.data?.public_code || product.public_code)\n    navigate('/admin/free/onboarding/intro', { replace: true })",
        "    sessionStorage.setItem('kawvo_free_artifact_activated', result.data?.public_code || product.public_code)\n    await apiPost('/me/notifications/welcome', {}).catch(() => undefined)\n    navigate('/admin/free/onboarding/intro', { replace: true })",
        'legacy welcome notification')
    return s

patch('app/src/components/admin/free/onboarding/FreeArtifactActivation.tsx', activation)


# Notification backend: the bell already exists in App, but the lifecycle/read endpoints were missing.
# Register authenticated routes at the main API layer so the code is production-ready later, while this batch deploys only Preview.
def api_notifications(s):
    if "app.get('/api/v1/me/notifications'" in s:
        raise SystemExit('Notification routes already exist; audit before applying duplicate routes')
    marker = '\nexport default app\n'
    block = r'''

// ─── User notifications ───────────────────────────────────────────────────

app.get('/api/v1/me/notifications', requireAuth, async (c) => {
  const userId = c.get('userId') as string
  const rawLimit = Number(c.req.query('limit') || 30)
  const limit = Math.max(1, Math.min(50, Number.isFinite(rawLimit) ? Math.floor(rawLimit) : 30))
  const [itemsResult, unreadRow] = await Promise.all([
    c.env.DB.prepare(
      `SELECT id, type, title, message, source_type, source_id, action_label, action_url, read_at, created_at
         FROM user_notifications
        WHERE user_id = ?
        ORDER BY created_at DESC, id DESC
        LIMIT ?`,
    ).bind(userId, limit).all(),
    c.env.DB.prepare(
      `SELECT COUNT(*) AS count FROM user_notifications WHERE user_id = ? AND read_at IS NULL`,
    ).bind(userId).first(),
  ])
  return c.json({ ok: true, data: { items: itemsResult.results || [], unread_count: Number((unreadRow as any)?.count || 0) } })
})

app.patch('/api/v1/me/notifications/read-all', requireAuth, async (c) => {
  const userId = c.get('userId') as string
  await c.env.DB.prepare(
    `UPDATE user_notifications SET read_at = COALESCE(read_at, datetime('now')) WHERE user_id = ? AND read_at IS NULL`,
  ).bind(userId).run()
  return c.json({ ok: true })
})

app.patch('/api/v1/me/notifications/:id/read', requireAuth, async (c) => {
  const userId = c.get('userId') as string
  const id = String(c.req.param('id') || '')
  await c.env.DB.prepare(
    `UPDATE user_notifications SET read_at = COALESCE(read_at, datetime('now')) WHERE id = ? AND user_id = ?`,
  ).bind(id, userId).run()
  return c.json({ ok: true })
})

async function createLifecycleNotification(c: any, input: {
  type: 'profile_welcome' | 'profile_first_published'
  title: string
  message: string
  actionLabel: string
  actionUrl: string
}) {
  const userId = c.get('userId') as string
  const profile = await c.env.DB.prepare(`SELECT id FROM profiles WHERE user_id = ? LIMIT 1`).bind(userId).first()
  const profileId = profile ? String((profile as any).id || '') || null : null
  const id = crypto.randomUUID()
  await c.env.DB.prepare(
    `INSERT INTO user_notifications (id, user_id, profile_id, type, title, message, source_type, action_label, action_url, created_at)
     SELECT ?, ?, ?, ?, ?, ?, 'lifecycle', ?, ?, datetime('now')
      WHERE NOT EXISTS (
        SELECT 1 FROM user_notifications WHERE user_id = ? AND type = ?
      )`,
  ).bind(id, userId, profileId, input.type, input.title, input.message, input.actionLabel, input.actionUrl, userId, input.type).run()
  return c.json({ ok: true })
}

app.post('/api/v1/me/notifications/welcome', requireAuth, async (c) => {
  return createLifecycleNotification(c, {
    type: 'profile_welcome',
    title: '¡Bienvenido a Kawvo Link!',
    message: 'Tu perfil está listo para completar. Elige tu usuario, agrega tu presentación, tus datos de contacto, botones, trabajos y servicios. Si quieres avanzar más rápido, usa la IA de Kawvo para ayudarte a mejorar tus textos.',
    actionLabel: 'Completar mi perfil',
    actionUrl: '/admin/free',
  })
})

app.post('/api/v1/me/notifications/profile-published', requireAuth, async (c) => {
  const userId = c.get('userId') as string
  const profile = await c.env.DB.prepare(`SELECT id, is_published FROM profiles WHERE user_id = ? LIMIT 1`).bind(userId).first()
  if (!profile || Number((profile as any).is_published || 0) !== 1) {
    return c.json({ ok: false, error: 'El perfil todavía no está publicado.' }, 409)
  }
  return createLifecycleNotification(c, {
    type: 'profile_first_published',
    title: '¡Tu perfil ya está publicado!',
    message: 'Tu perfil digital se publicó con éxito. Ya puedes enviar tu enlace, agregarlo a la bio de tus redes o a tu firma de correo, compartirlo por WhatsApp y descargar el código QR de tu perfil para usarlo también de forma impresa.',
    actionLabel: 'Ir a mi perfil',
    actionUrl: '/admin/free',
  })
})
'''
    return replace_once(s, marker, block + marker, 'API notification routes')

patch('api/src/index.ts', api_notifications)

print('\n✓ QA follow-up aplicado. Ejecuta TypeScript/build antes de commit.')
