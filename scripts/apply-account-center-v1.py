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

# Dashboard: soporte, eliminación y productos salen del panel y pasan a Mi cuenta.
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
new_account = """  {
    title: 'Mi cuenta',
    text: 'Plan, notificaciones, soporte, productos y seguridad',
    to: '/admin/free/account',
    icon: '◎',
    help: 'Administra tu plan, notificaciones, productos Kawvo, ayuda, recursos y sesiones activas desde un solo lugar.',
    optional: true,
  },
"""
if old_products in text:
    text = text.replace(old_products, new_account, 1)
elif new_account not in text:
    raise SystemExit('No encontré el acceso Mis productos del dashboard')
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
dashboard.write_text(text)
print('✓ Dashboard: Mi cuenta centraliza productos, ayuda y eliminación')

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

# Desde una notificación de soporte fuera de Mi cuenta, lleva al ticket dentro de Mi cuenta.
bell = ROOT / 'app/src/components/admin/free/FreeNotificationBell.tsx'
text = bell.read_text()
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
print('✓ Campana: tickets abren Centro de ayuda en Mi cuenta')

# Mi cuenta abre directamente un ticket recibido por query string.
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
account.write_text(text)
print('✓ Mi cuenta: apertura directa de tickets desde notificaciones')

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
