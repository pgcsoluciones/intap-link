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


def require_replace(s, old, new, label):
    if old not in s:
        raise SystemExit(f'No encontré bloque esperado: {label}')
    return s.replace(old, new, 1)

# Android/iOS contact: prefer native file sharing where supported. This avoids forcing
# Chrome Android through an HTML download attribute while preserving a safe fallback.
def public_free_profile(s):
    old = """  function downloadVCard() {
    const content = ['BEGIN:VCARD', 'VERSION:3.0', `FN:${profile.name}`, `TITLE:${profile.role}`, profile.phone ? `TEL:${profile.phone}` : '', `URL:${window.location.href}`, 'END:VCARD'].filter(Boolean).join('\\n')
    const blob = new Blob([content], { type: 'text/vcard;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = profile.vcardFileName
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 0)
  }
"""
    new = """  async function downloadVCard() {
    const canonicalUrl = `${window.location.origin}${window.location.pathname}`
    const escapeVCard = (value: string) => String(value || '').replace(/\\/g, '\\\\').replace(/\\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;')
    const content = [
      'BEGIN:VCARD',
      'VERSION:3.0',
      `FN:${escapeVCard(profile.name)}`,
      `N:;${escapeVCard(profile.name)};;;`,
      profile.role ? `TITLE:${escapeVCard(profile.role)}` : '',
      profile.phone ? `TEL;TYPE=CELL:${profile.phone}` : '',
      `URL:${canonicalUrl}`,
      'END:VCARD',
      '',
    ].filter((line) => line !== '').join('\\r\\n')
    const blob = new Blob([content], { type: 'text/vcard;charset=utf-8' })
    const file = new File([blob], profile.vcardFileName || `${profile.slug || 'contacto'}.vcf`, { type: 'text/vcard' })
    try {
      if (navigator.share && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: `Guardar contacto de ${profile.name}` })
        return
      }
    } catch (error: any) {
      if (error?.name === 'AbortError') return
    }
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = file.name
    anchor.rel = 'noopener'
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 1500)
  }
"""
    return require_replace(s, old, new, 'free vCard native share')

patch('web/src/components/free-profile/IntapLinkGratisProfile.tsx', public_free_profile)

# Legacy/public layouts: remove forced download so Android may hand the vCard response
# to its contact handler. Server headers remain authoritative.
def public_profile(s):
    old = """              href={`${(import.meta.env.VITE_API_URL || '').replace(/\\/$/, '')}/api/v1/public/vcard/${data.profileId}`}
              download
              className="classic-pill"
"""
    new = """              href={`${(import.meta.env.VITE_API_URL || '').replace(/\\/$/, '')}/api/v1/public/vcard/${data.profileId}`}
              className="classic-pill"
"""
    if old in s:
      s = s.replace(old, new, 1)
    return s

# Don't fail if the active free profile is the only vCard surface.
p = Path('web/src/components/PublicProfile.tsx')
if p.exists():
    before = p.read_text(); after = public_profile(before)
    if after != before:
        p.write_text(after); print('✓ web/src/components/PublicProfile.tsx')
    else:
        print('· legacy vCard download attribute not present; no change')

# AI: explicit quota wording and soft Basic-plan nudge only when exhausted/near exhausted.
def ai_ui(s):
    old = """        <p className="mt-3 text-xs font-semibold leading-5 text-slate-500">
          {context.usage.unlimited
            ? 'IA ilimitada · Super Admin'
            : `Disponibilidad IA hoy: ${context.usage.remaining_today} · este mes: ${context.usage.remaining_month}`}
        </p>
"""
    new = """        <p className="mt-3 text-xs font-semibold leading-5 text-slate-500">
          {context.usage.unlimited
            ? 'IA ilimitada · Super Admin'
            : `Usos de IA disponibles: ${context.usage.remaining_today} hoy · ${context.usage.remaining_month} este mes`}
        </p>
        {!context.usage.unlimited && (Number(context.usage.remaining_today) <= 1 || Number(context.usage.remaining_month) <= 3) && (
          <div className="mt-3 rounded-2xl border border-violet-100 bg-violet-50/60 px-4 py-3 text-xs font-semibold leading-5 text-violet-800">
            {Number(context.usage.remaining_today) <= 0 || Number(context.usage.remaining_month) <= 0
              ? 'Ya utilizaste la cuota de IA disponible por ahora.'
              : 'Te queda poca cuota de IA disponible.'}{' '}
            El Plan Básico incluye una cuota mayor para seguir optimizando tu perfil.
            {context.plan.upgrade_available && <a href={basicPlanWhatsAppUrl()} target="_blank" rel="noreferrer" className="ml-1 font-black underline">Conocer Plan Básico</a>}
          </div>
        )}
"""
    return require_replace(s, old, new, 'AI quota copy')

patch('app/src/components/admin/free/FreeAiProfileAssistant.tsx', ai_ui)

# Identity: second back-to-panel control at the bottom of long edit screen.
def identity(s):
    marker = """          <div className="mt-5"><FreeUpgradeCard compact /></div>
"""
    if marker not in s:
        raise SystemExit('No encontré footer identity')
    return s.replace(marker, marker + "          <div className=\"mt-4\"><FreeBackButton onClick={() => navigate('/admin/free')} /></div>\n", 1)

patch('app/src/components/admin/free/onboarding/FreeOnboardingIdentity.tsx', identity)

# Visual editor cleanup after switching full-view link to authenticated public preview.
def editor(s):
    s2 = s.replace("  const isPreviewEnvironment = import.meta.env.VITE_ENVIRONMENT === 'preview' || window.location.hostname.includes('preview.intaprd.com')\n  const configuredWebUrl = (import.meta.env.VITE_WEB_URL ?? 'https://intaprd.com').replace(/\\/$/, '')\n  const webUrl = isPreviewEnvironment ? 'https://preview.intaprd.com' : configuredWebUrl\n", "")
    # Add bottom return button to edit column if a stable footer location exists.
    marker = """          </div>

          <aside className={`${mobileMode === 'edit' ? 'hidden' : 'block'} lg:sticky lg:top-5 lg:block`}>
"""
    if marker in s2:
        s2 = s2.replace(marker, """            <div className="pt-2"><FreeBackButton onClick={() => navigate('/admin/free')} /></div>
          </div>

          <aside className={`${mobileMode === 'edit' ? 'hidden' : 'block'} lg:sticky lg:top-5 lg:block`}>
""", 1)
    return s2

patch('app/src/components/admin/free/FreeVisualEditor.tsx', editor)

print('\nFollow-up aplicado. Ejecuta TypeScript/build antes de commit.')
