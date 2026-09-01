#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def replace_once(path: str, old: str, new: str, marker: str) -> None:
    p = ROOT / path
    text = p.read_text()
    if new in text:
        print(f'✓ {marker} ya aplicado')
        return
    if old not in text:
        raise SystemExit(f'No encontré el bloque esperado para: {marker} ({path})')
    p.write_text(text.replace(old, new, 1))
    print(f'✓ {marker}')


# Servicios: deja claro que ese botón solo edita título/descripción.
replace_once(
    'app/src/components/admin/free/FreeServices.tsx',
    '>Editar</button><button type="button" disabled={saving} onClick={() => { setImageTargetId(item.id); imageInputRef.current?.click() }}',
    '>Editar textos</button><button type="button" disabled={saving} onClick={() => { setImageTargetId(item.id); imageInputRef.current?.click() }}',
    'Servicios: Editar → Editar textos',
)

# Portafolio: idem para título/descripción.
replace_once(
    'app/src/components/admin/free/FreePortfolio.tsx',
    '>Editar</button><button type="button" disabled={uploading} onClick={() => { setReplaceTargetId(photo.id); replaceInputRef.current?.click() }}',
    '>Editar textos</button><button type="button" disabled={uploading} onClick={() => { setReplaceTargetId(photo.id); replaceInputRef.current?.click() }}',
    'Portafolio: Editar → Editar textos',
)

# Dashboard: soporte, eliminación y productos salen del panel. Mi cuenta vive en la barra superior.
dashboard = ROOT / 'app/src/components/admin/free/FreeDashboard.tsx'
text = dashboard.read_text()
text = text.replace("import FreeProfileDangerZone from './FreeProfileDangerZone'\n", '')
text = text.replace("import FreeSupportPanel from './FreeSupportPanel'\n", '')
old_products = """  {
    title: 'Mis productos Kawvo (NFC/QR)',
    text: 'Activa y administra tus productos físicos',
    to: '/admin/artifacts',
    icon: '⌁',
    help: 'Aquí administras las tarjetas, etiquetas u otros productos Kawvo vinculados a tu cuenta y al perfil digital.',
    optional: true,
  },
"""
account_card = """  {
    title: 'Mi cuenta',
    text: 'Plan, notificaciones, soporte, productos y seguridad',
    to: '/admin/free/account',
    icon: '◎',
    help: 'Administra tu plan, notificaciones, productos Kawvo, ayuda, recursos y sesiones activas desde un solo lugar.',
    optional: true,
  },
"""
if old_products in text:
    text = text.replace(old_products, '', 1)
if account_card in text:
    text = text.replace(account_card, '', 1)
old_bottom = """        <FreeUpgradeCard />
        <FreeSupportPanel />

        {me?.slug && <FreeProfileDangerZone slug={me.slug} email={me.email || ''} />}
"""
new_bottom = """        <FreeUpgradeCard />
"""
if old_bottom in text:
    text = text.replace(old_bottom, new_bottom, 1)
elif '<FreeSupportPanel />' in text or '<FreeProfileDangerZone' in text:
    raise SystemExit('No pude retirar ayuda/eliminación del dashboard de forma segura')
logout_fn = """  const handleLogout = async () => {
    try { await apiPost('/auth/logout', {}) } catch { /* ignore */ }
    window.location.replace('/admin/login')
  }

"""
if logout_fn in text:
    text = text.replace(logout_fn, '', 1)
old_logout_btn = """            <button onClick={handleLogout} className=\"rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-500\">Salir</button>
"""
account_btn = """            <button type=\"button\" onClick={() => navigate('/admin/free/account')} aria-label=\"Mi cuenta\" title=\"Mi cuenta\" className=\"flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-lg font-black text-slate-600 shadow-sm transition hover:bg-slate-50\">◎</button>
"""
if old_logout_btn in text:
    text = text.replace(old_logout_btn, account_btn, 1)
elif account_btn not in text:
    raise SystemExit('No encontré botón Salir del encabezado del dashboard')
dashboard.write_text(text)
print('✓ Dashboard: Mi cuenta en barra superior y Salir retirado')

# Rutas App.
app_path = ROOT / 'app/src/App.tsx'
text = app_path.read_text()
if "import FreeAccount from './components/admin/free/FreeAccount'" not in text:
    anchor = "import FreePwaHome from './components/admin/free/FreePwaHome'\n"
    if anchor not in text: raise SystemExit('No encontré import FreePwaHome')
    text = text.replace(anchor, anchor + "import FreeAccount from './components/admin/free/FreeAccount'\n", 1)
if "import SuperAdminResources from './components/admin/SuperAdminResources'" not in text:
    anchor = "import SuperAdminSupport from './components/admin/SuperAdminSupport'\n"
    if anchor not in text: raise SystemExit('No encontré import SuperAdminSupport')
    text = text.replace(anchor, anchor + "import SuperAdminResources from './components/admin/SuperAdminResources'\n", 1)
if 'path="/admin/free/account"' not in text:
    anchor = '        <Route path="/admin/free/home" element={<AdminGuard planScope="free"><FreePwaHome /></AdminGuard>} />\n'
    if anchor not in text: raise SystemExit('No encontré ruta FreePwaHome')
    text = text.replace(anchor, anchor + '        <Route path="/admin/free/account" element={<AdminGuard planScope="free"><FreeAccount /></AdminGuard>} />\n', 1)
if 'path="/superadmin/resources"' not in text:
    anchor = '        <Route path="/superadmin/support" element={<SuperAdminGuard><SuperAdminSupport /></SuperAdminGuard>} />\n'
    if anchor not in text: raise SystemExit('No encontré ruta SuperAdminSupport')
    text = text.replace(anchor, anchor + '        <Route path="/superadmin/resources" element={<SuperAdminGuard><SuperAdminResources /></SuperAdminGuard>} />\n', 1)
app_path.write_text(text)
print('✓ App: rutas Mi cuenta y Recursos SuperAdmin')

# Navegación SuperAdmin.
layout = ROOT / 'app/src/components/admin/SuperAdminLayout.tsx'
text = layout.read_text()
old_type = "type SuperAdminNavSection = SuperAdminSection | 'products' | 'support' | 'feedback' | 'demo'"
new_type = "type SuperAdminNavSection = SuperAdminSection | 'products' | 'support' | 'feedback' | 'demo' | 'resources'"
if old_type in text:
    text = text.replace(old_type, new_type, 1)
elif new_type not in text:
    raise SystemExit('No encontré SuperAdminNavSection')
if "{ key: 'resources', label: 'Recursos de usuarios' }," not in text:
    anchor = "  { key: 'support', label: 'Soporte / tickets' },\n"
    if anchor not in text: raise SystemExit('No encontré item Soporte SuperAdmin')
    text = text.replace(anchor, anchor + "  { key: 'resources', label: 'Recursos de usuarios' },\n", 1)
resources_nav = """    if (section === 'resources') {
      if (typeof window !== 'undefined' && window.location.pathname !== '/superadmin/resources') window.location.href = '/superadmin/resources'
      return
    }
"""
if resources_nav not in text:
    anchor = """    if (section === 'support') {
      if (typeof window !== 'undefined' && window.location.pathname !== '/superadmin/support') window.location.href = '/superadmin/support'
      return
    }
"""
    if anchor not in text: raise SystemExit('No encontré navegación de soporte SuperAdmin')
    text = text.replace(anchor, anchor + resources_nav, 1)
layout.write_text(text)
print('✓ SuperAdmin: acceso a Recursos de usuarios')

# Notificaciones: una sola bandeja. El detalle permite marcar como leída y eliminar.
bell = ROOT / 'app/src/components/admin/free/FreeNotificationBell.tsx'
text = bell.read_text()
old_open_item = """  const openItem = async (item: NotificationItem) => {
    const nextItem = item.read_at ? item : { ...item, read_at: new Date().toISOString() }
    setSelected(nextItem)
    setOpen(false)
    if (!item.read_at) {
      setItems((current) => current.map((entry) => entry.id === item.id ? nextItem : entry))
      setUnread((value) => Math.max(0, value - 1))
      try { await apiPatch(`/me/notifications/${item.id}/read`, {}) } catch { /* optimistic read */ }
    }
  }

"""
new_open_item = """  const openItem = (item: NotificationItem) => {
    setSelected(item)
    setOpen(false)
  }

  const markSelectedRead = async () => {
    if (!selected || selected.read_at) return
    const readAt = new Date().toISOString()
    const nextItem = { ...selected, read_at: readAt }
    setSelected(nextItem)
    setItems((current) => current.map((entry) => entry.id === selected.id ? nextItem : entry))
    setUnread((value) => Math.max(0, value - 1))
    try { await apiPatch(`/me/notifications/${selected.id}/read`, {}) } catch { /* optimistic read */ }
  }

"""
if old_open_item in text:
    text = text.replace(old_open_item, new_open_item, 1)
elif 'const markSelectedRead = async () =>' not in text:
    raise SystemExit('No encontré openItem en campana')
text = text.replace('onClick={() => void openItem(item)}', 'onClick={() => openItem(item)}')
read_button_anchor = """            {(selected.source_type === 'support_ticket' || selected.action_url) && (
              <button type=\"button\" onClick={act} className=\"mt-5 w-full rounded-xl bg-slate-950 px-4 py-3 text-sm font-black text-white\">
                {selected.action_label || (selected.source_type === 'support_ticket' ? 'Abrir solicitud' : 'Ver más')}
              </button>
            )}
            <button type=\"button\" disabled={deleting} onClick={() => void deleteSelected()} className=\"mt-3 w-full rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-black text-rose-700 disabled:opacity-40\">
"""
read_button_new = """            {(selected.source_type === 'support_ticket' || selected.action_url) && (
              <button type=\"button\" onClick={act} className=\"mt-5 w-full rounded-xl bg-slate-950 px-4 py-3 text-sm font-black text-white\">
                {selected.action_label || (selected.source_type === 'support_ticket' ? 'Abrir solicitud' : 'Ver más')}
              </button>
            )}
            {!selected.read_at && (
              <button type=\"button\" onClick={() => void markSelectedRead()} className=\"mt-3 w-full rounded-xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm font-black text-cyan-700\">Marcar como leída</button>
            )}
            <button type=\"button\" disabled={deleting} onClick={() => void deleteSelected()} className=\"mt-3 w-full rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-black text-rose-700 disabled:opacity-40\">
"""
if read_button_anchor in text:
    text = text.replace(read_button_anchor, read_button_new, 1)
elif 'Marcar como leída' not in text:
    raise SystemExit('No encontré acciones del modal de notificaciones')
old_action = """    if (selected.source_type === 'support_ticket' && selected.source_id) {
      window.dispatchEvent(new CustomEvent('kawvo:open-support-ticket', { detail: { ticketId: selected.source_id } }))
      setSelected(null)
      setOpen(false)
      window.setTimeout(() => document.getElementById('kawvo-support-panel')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 60)
      return
    }
"""
new_action = """    if (selected.source_type === 'support_ticket' && selected.source_id) {
      const ticketId = encodeURIComponent(selected.source_id)
      setSelected(null)
      setOpen(false)
      if (window.location.pathname === '/admin/free/account') {
        window.dispatchEvent(new CustomEvent('kawvo:open-support-ticket', { detail: { ticketId: selected.source_id } }))
        window.setTimeout(() => document.getElementById('kawvo-support-panel')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 60)
      } else {
        window.location.href = `/admin/free/account?ticket=${ticketId}`
      }
      return
    }
"""
if old_action in text:
    text = text.replace(old_action, new_action, 1)
elif new_action not in text:
    raise SystemExit('No encontré acción de ticket en campana')
bell.write_text(text)
print('✓ Notificaciones: detalle, marcar como leída y eliminar en una sola bandeja')

# Mi cuenta: abre tickets, comparte cuentas bancarias y contiene Cerrar sesión.
account = ROOT / 'app/src/components/admin/free/FreeAccount.tsx'
text = account.read_text()
ticket_effect = """  useEffect(() => {
    const ticketId = new URLSearchParams(window.location.search).get('ticket')
    if (!ticketId) return
    const timer = window.setTimeout(() => {
      window.dispatchEvent(new CustomEvent('kawvo:open-support-ticket', { detail: { ticketId } }))
      document.getElementById('kawvo-support-panel')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 250)
    return () => window.clearTimeout(timer)
  }, [])

"""
if ticket_effect not in text:
    anchor = """  const openNotifications = () => {
"""
    if anchor not in text: raise SystemExit('No encontré openNotifications en FreeAccount')
    text = text.replace(anchor, ticket_effect + anchor, 1)
share_bank_fn = """  const shareBankAccounts = async () => {
    if (!publicUrl) return
    const url = `${publicUrl}?share=bancos#bancos`
    const text = 'Te comparto mis datos bancarios para transferencias.'
    setShareFeedback('')
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Cuentas bancarias', text, url })
        return
      }
      await navigator.clipboard.writeText(url)
      setShareFeedback('Enlace de cuentas bancarias copiado para compartir.')
    } catch (error: any) {
      if (error?.name !== 'AbortError') setShareFeedback('No pudimos abrir el menú para compartir.')
    }
  }

"""
if share_bank_fn not in text:
    anchor = """  const revokeSession = async (session: SessionItem) => {
"""
    if anchor not in text: raise SystemExit('No encontré revokeSession en FreeAccount')
    text = text.replace(anchor, share_bank_fn + anchor, 1)
old_account_logout_top = """            <button type=\"button\" onClick={() => void handleLogout()} className=\"rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-500\">Salir</button>
"""
if old_account_logout_top in text:
    text = text.replace(old_account_logout_top, '', 1)
old_bank = """        {bankActive && (
          <button type=\"button\" onClick={() => navigate('/admin/free/bank-accounts')} className=\"flex w-full items-center gap-3 rounded-[22px] border border-emerald-100 bg-emerald-50 p-4 text-left\">
            <span className=\"flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-xl\">▤</span>
            <span className=\"min-w-0 flex-1\"><span className=\"block text-sm font-black text-slate-950\">Cuentas bancarias</span><span className=\"mt-1 block text-xs leading-5 text-slate-500\">Administrar tus datos bancarios</span></span>
            <span className=\"font-black text-emerald-700\">›</span>
          </button>
        )}
"""
new_bank = """        {bankActive && (
          <button type=\"button\" onClick={() => void shareBankAccounts()} className=\"flex w-full items-center gap-3 rounded-[22px] border border-emerald-100 bg-emerald-50 p-4 text-left\">
            <span className=\"flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-xl\">▤</span>
            <span className=\"min-w-0 flex-1\"><span className=\"block text-sm font-black text-slate-950\">Enviar cuentas bancarias</span><span className=\"mt-1 block text-xs leading-5 text-slate-500\">Compartir enlace directo a tus datos bancarios</span></span>
            <span className=\"font-black text-emerald-700\">›</span>
          </button>
        )}
"""
if old_bank in text:
    text = text.replace(old_bank, new_bank, 1)
elif new_bank not in text:
    raise SystemExit('No encontré bloque de cuentas bancarias en Mi cuenta')
logout_row = """        <button type=\"button\" onClick={() => void handleLogout()} className=\"flex w-full items-center gap-3 rounded-[22px] border border-slate-200 bg-white p-4 text-left\">
          <span className=\"flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-lg\">↪</span>
          <span className=\"min-w-0 flex-1\"><span className=\"block text-sm font-black text-slate-950\">Cerrar sesión</span><span className=\"mt-1 block text-xs leading-5 text-slate-500\">Salir de Kawvo en este dispositivo</span></span>
          <span className=\"font-black text-slate-400\">›</span>
        </button>

"""
if logout_row not in text:
    anchor = """        {me?.slug && <FreeProfileDangerZone slug={me.slug} email={me.email || ''} />}
"""
    if anchor not in text: raise SystemExit('No encontré zona de eliminación para insertar Cerrar sesión')
    text = text.replace(anchor, logout_row + anchor, 1)
account.write_text(text)
print('✓ Mi cuenta: compartir cuentas bancarias y Cerrar sesión dentro del panel')

# Ayuda contextual de Mi cuenta.
help_path = ROOT / 'app/src/components/admin/free/FreeContextHelp.tsx'
text = help_path.read_text()
account_help = "  { match: (p) => p === '/admin/free/account', entry: { title: 'Mi cuenta', intro: 'Aquí concentras la gestión de tu cuenta Kawvo.', points: ['Revisa tu plan y tus cuotas de IA.', 'Consulta notificaciones, productos y tickets de ayuda.', 'Administra sesiones activas y opciones de tu perfil.'] } },\n"
if account_help not in text:
    anchor = "  { match: (p) => p === '/admin/artifacts',"
    idx = text.find(anchor)
    if idx < 0: raise SystemExit('No encontré ancla de ayuda para productos')
    text = text[:idx] + account_help + text[idx:]
help_path.write_text(text)
print('✓ Ayuda contextual: Mi cuenta')

print('\n✓ Aplicación de Account Center v1 completada')
