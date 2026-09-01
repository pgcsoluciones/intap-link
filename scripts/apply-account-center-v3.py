#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def replace_all(path: str, pairs: list[tuple[str, str]]) -> None:
    p = ROOT / path
    text = p.read_text()
    original = text
    for old, new in pairs:
        text = text.replace(old, new)
    if text != original:
        p.write_text(text)
        print(f'✓ {path}')


# Comercial: el plan de pago se presenta al usuario como Plus. El código interno `basic` y la URL existente se conservan.
for rel in [
    'app/src/components/admin/free/FreeQuickActions.tsx',
    'app/src/components/admin/free/FreeDashboard.tsx',
    'app/src/components/admin/free/FreeLinks.tsx',
    'app/src/components/admin/free/FreeBankAccounts.tsx',
    'app/src/components/admin/free/FreePortfolio.tsx',
    'app/src/components/admin/free/FreeProfileDangerZone.tsx',
    'app/src/components/admin/free/FreeServices.tsx',
    'app/src/components/admin/free/FreeAiProfileAssistant.tsx',
]:
    replace_all(rel, [('Plan Básico', 'Plan Plus'), ('plan Básico', 'plan Plus')])

# Ayuda contextual: en Mi cuenta no se muestra el flotante porque el Centro de ayuda forma parte de la propia pantalla.
help_path = ROOT / 'app/src/components/admin/free/FreeContextHelp.tsx'
help = help_path.read_text()
account_help = "  { match: (p) => p === '/admin/free/account', entry: { title: 'Mi cuenta', intro: 'Aquí concentras la gestión de tu cuenta Kawvo.', points: ['Revisa tu plan y tus cuotas de IA.', 'Consulta notificaciones, productos y tickets de ayuda.', 'Administra sesiones activas y opciones de tu perfil.'] } },\n"
help = help.replace(account_help, '')
help_path.write_text(help)
print('✓ Mi cuenta: flotante de ayuda retirado')

# Centro de ayuda: este es el panel/tickets único dentro de Mi cuenta.
support_path = ROOT / 'app/src/components/admin/free/FreeSupportPanel.tsx'
support = support_path.read_text()
support = support.replace('¿Necesitas ayuda?', 'Centro de ayuda')
support = support.replace('Soporte Kawvo', 'Ayuda y tickets')
support = support.replace('Envía una duda y revisa el seguimiento de tus solicitudes.', 'Haz una consulta y revisa aquí tus tickets y respuestas.')
support_path.write_text(support)
print('✓ Centro de ayuda y tickets unificado')

# Mi cuenta v3.
account_path = ROOT / 'app/src/components/admin/free/FreeAccount.tsx'
text = account_path.read_text()

text = text.replace("import { basicPlanWhatsAppUrl } from './FreePanelUi'", "import { UpgradeCrownIcon, basicPlanWhatsAppUrl } from './FreePanelUi'")
text = text.replace("  if (plan === 'basic') return 'BÁSICO'", "  if (plan === 'basic') return 'PLUS'")

# Quitar dispositivos vinculados de la UI y su estado/consultas.
text = text.replace("type SessionItem = {\n  id: string\n  label: string\n  created_at?: string | null\n  expires_at?: string | null\n  is_current?: boolean\n}\n\n", '')
text = text.replace("  const [sessions, setSessions] = useState<SessionItem[]>([])\n", '')
text = text.replace("  const [sessionBusy, setSessionBusy] = useState('')\n", '')
text = text.replace("  const [showDevices, setShowDevices] = useState(false)\n", '')
text = text.replace("      apiGet('/me/account/sessions').catch(() => ({ ok: false })),\n", '')
text = text.replace("    ]).then(([meJson, bankJson, aiJson, resourcesJson, sessionsJson, notificationsJson]: any[]) => {", "    ]).then(([meJson, bankJson, aiJson, resourcesJson, notificationsJson]: any[]) => {")
text = text.replace("      if (sessionsJson?.ok) setSessions(Array.isArray(sessionsJson.data?.items) ? sessionsJson.data.items : [])\n", '')

start = text.find("  const loadSessions = async () => {")
if start >= 0:
    end = text.find("\n  useEffect(() => {", start)
    if end > start:
        text = text[:start] + text[end+1:]
start = text.find("  const revokeSession = async (")
if start >= 0:
    end = text.find("\n  const handleLogout", start)
    if end > start:
        text = text[:start] + text[end+1:]

# Estados para preview de QR e invitación.
anchor = "  const [qrBusy, setQrBusy] = useState(false)\n"
if "qrPreview" not in text:
    text = text.replace(anchor, anchor + "  const [qrPreview, setQrPreview] = useState('')\n  const [showQrPreview, setShowQrPreview] = useState(false)\n  const [showInvitePreview, setShowInvitePreview] = useState(false)\n")

# QR: primero mostrar preview; descargar solo desde el preview.
old_qr = """  const downloadQr = async () => {
    if (!publicUrl || qrBusy) return
    setQrBusy(true)
    setShareFeedback('')
    try {
      const QRCode = await import('qrcode')
      const dataUrl = await QRCode.toDataURL(publicUrl, { width: 1400, margin: 3, errorCorrectionLevel: 'H', color: { dark: '#111111', light: '#FFFFFF' } })
      const link = document.createElement('a')
      link.href = dataUrl
      link.download = `kawvo-${me?.slug || 'perfil'}-qr.png`
      document.body.appendChild(link)
      link.click()
      link.remove()
      setShareFeedback('QR descargado.')
    } catch {
      setShareFeedback('No pudimos generar el QR en este momento.')
    } finally {
      setQrBusy(false)
    }
  }
"""
new_qr = """  const previewQr = async () => {
    if (!publicUrl || qrBusy) return
    setQrBusy(true)
    setShareFeedback('')
    try {
      const QRCode = await import('qrcode')
      const dataUrl = await QRCode.toDataURL(publicUrl, { width: 1400, margin: 3, errorCorrectionLevel: 'H', color: { dark: '#111111', light: '#FFFFFF' } })
      setQrPreview(dataUrl)
      setShowQrPreview(true)
    } catch {
      setShareFeedback('No pudimos generar el QR en este momento.')
    } finally {
      setQrBusy(false)
    }
  }

  const downloadQr = () => {
    if (!qrPreview) return
    const link = document.createElement('a')
    link.href = qrPreview
    link.download = `kawvo-${me?.slug || 'perfil'}-qr.png`
    document.body.appendChild(link)
    link.click()
    link.remove()
    setShareFeedback('QR descargado.')
  }
"""
if old_qr in text:
    text = text.replace(old_qr, new_qr, 1)

# Invitación: el texto se muestra primero y el usuario decide compartir.
text = text.replace("  const inviteFriend = async () => {", "  const sendInvite = async () => {")

# Iconografía lineal coherente.
crown_old = '<SettingsRow icon="✦" label="Mejora tu plan" href={basicPlanWhatsAppUrl()} />'
crown_new = '<SettingsRow icon={<span className="text-amber-500"><UpgradeCrownIcon className="h-6 w-6" /></span>} label="Mejora tu plan" detail="Conoce el Plan Plus" href={basicPlanWhatsAppUrl()} />'
text = text.replace(crown_old, crown_new)
text = text.replace('<SettingsRow icon="♧" label="Notificaciones"', '<SettingsRow icon={<svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></svg>} label="Notificaciones"')

# Bloque dispositivos completo: eliminar si sigue presente.
marker = '<SettingsRow icon="▣" label="Dispositivos vinculados"'
pos = text.find(marker)
if pos >= 0:
    # Busca el siguiente cierre del bloque principal de CUENTA tras showDevices.
    after = text.find("          </div>\n          {avatarError", pos)
    if after > pos:
        # Preservar el cierre del contenedor CUENTA.
        text = text[:pos] + text[after:]

# MI KAWVO: sustituir iconos y acciones existentes.
text = text.replace('<SettingsRow icon="⌁" label="Mis productos"', '<SettingsRow icon={<svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M6 7h12l1 13H5L6 7Z"/><path d="M9 9V6a3 3 0 0 1 6 0v3"/></svg>} label="Mis productos"')
text = text.replace('icon="▦" label="Descargar QR"', 'icon={<svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><path d="M14 14h3v3h-3zM19 14h2v7h-7v-2"/></svg>} label="Descargar código QR"')
text = text.replace('onClick={() => void downloadQr()}', 'onClick={() => void previewQr()}')
text = text.replace('icon="▤" label="Enviar cuentas bancarias"', 'icon={<svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 10h18M5 10v8m4-8v8m6-8v8m4-8v8M3 20h18M12 3 3 8h18L12 3Z"/></svg>} label="Enviar enlace de cuentas"')
text = text.replace('detail="Compartir enlace directo a tus cuentas"', 'detail="Comparte con tus clientes el enlace directo a tus cuentas bancarias"')
text = text.replace('icon="↗" label="Invitar a un amigo"', 'icon={<svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="9" cy="8" r="3"/><circle cx="16" cy="9" r="2.5"/><path d="M3.5 19c.5-3.5 2.6-5.5 5.5-5.5s5 2 5.5 5.5M14 14c2.8-.3 5 1.4 5.5 4.5"/></svg>} label="Invitar a un amigo"')
text = text.replace('onClick={() => void inviteFriend()}', 'onClick={() => setShowInvitePreview(true)}')

# Ayuda y cerrar sesión.
text = text.replace('icon="?" label="Centro de ayuda"', 'icon={<svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="9"/><path d="M9.8 9a2.4 2.4 0 0 1 4.6 1c0 1.7-2.4 2.1-2.4 3.7"/><path d="M12 17h.01"/></svg>} label="Centro de ayuda y tickets"')
text = text.replace('icon="↪" label="Cerrar sesión"', 'icon={<svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M10 4H5v16h5"/><path d="M13 8l4 4-4 4M8 12h9"/></svg>} label="Cerrar sesión"')

# Quitar fila vacía/duplicada de ayuda si existe y dejar un solo panel con el copy Centro de ayuda.
text = text.replace('<SettingsRow icon={<svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="9"/><path d="M9.8 9a2.4 2.4 0 0 1 4.6 1c0 1.7-2.4 2.1-2.4 3.7"/><path d="M12 17h.01"/></svg>} label="Centro de ayuda y tickets" onClick={() => document.getElementById(\'kawvo-support-panel\')?.scrollIntoView({ behavior: \'smooth\' })} />\n', '')

# Paneles de preview antes del cierre del fragmento principal.
insert_anchor = "      {avatarFile && <ImageCropModal file={avatarFile} aspectRatio={1} outputWidth={400} onSave={uploadAvatar} onCancel={() => setAvatarFile(null)} />}\n"
if 'aria-label="Vista previa del código QR"' not in text:
    overlays = """      {showQrPreview && qrPreview && (
        <div className="fixed inset-0 z-[140] flex items-end justify-center bg-slate-950/55 p-4 sm:items-center" role="dialog" aria-modal="true" aria-label="Vista previa del código QR" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowQrPreview(false) }}>
          <article className="w-full max-w-[390px] rounded-[26px] bg-white p-5 shadow-2xl">
            <div className="flex items-center justify-between"><h2 className="text-lg font-black">Tu código QR</h2><button type="button" onClick={() => setShowQrPreview(false)} className="rounded-full bg-slate-100 px-3 py-2 text-xs font-bold text-slate-600">Cerrar</button></div>
            <div className="mt-5 flex justify-center"><img src={qrPreview} alt="Vista previa del código QR de tu perfil" className="h-56 w-56 rounded-2xl border border-slate-200" /></div>
            <p className="mt-4 text-center text-sm leading-6 text-slate-500">Este QR abre directamente tu perfil Kawvo.</p>
            <button type="button" onClick={downloadQr} className="mt-4 w-full rounded-xl bg-slate-950 px-4 py-3 text-sm font-black text-white">Descargar código QR</button>
          </article>
        </div>
      )}
      {showInvitePreview && (
        <div className="fixed inset-0 z-[140] flex items-end justify-center bg-slate-950/55 p-4 sm:items-center" role="dialog" aria-modal="true" aria-label="Vista previa de invitación" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowInvitePreview(false) }}>
          <article className="w-full max-w-[390px] rounded-[26px] bg-white p-5 shadow-2xl">
            <div className="flex items-center justify-between"><h2 className="text-lg font-black">Invitar a un amigo</h2><button type="button" onClick={() => setShowInvitePreview(false)} className="rounded-full bg-slate-100 px-3 py-2 text-xs font-bold text-slate-600">Cerrar</button></div>
            <p className="mt-4 text-sm font-semibold text-slate-500">Mensaje que vas a compartir</p>
            <div className="mt-2 rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-700">Conoce Kawvo Link y crea una presentación digital para compartir tus datos y servicios.<br/><span className="mt-2 block font-semibold text-cyan-700">https://nfc.kawvoia.com</span></div>
            <button type="button" onClick={() => void sendInvite()} className="mt-4 w-full rounded-xl bg-slate-950 px-4 py-3 text-sm font-black text-white">Compartir invitación</button>
          </article>
        </div>
      )}
"""
    text = text.replace(insert_anchor, insert_anchor + overlays, 1)

# Nota bancaria más visible si aparece una nota de feedback/explicación específica.
text = text.replace('text-[12px] leading-5 text-slate-400', 'text-[13px] leading-5 text-slate-500')

account_path.write_text(text)
print('✓ Mi cuenta v3: iconos, QR preview, invitación preview, banco y dispositivos')

print('\n✓ Account Center v3 aplicado')
