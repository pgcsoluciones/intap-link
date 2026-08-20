import { useEffect, useState, type ReactNode } from 'react'
import { apiGet } from '../../lib/api'

export type SuperAdminSection =
  | 'dashboard'
  | 'subscribers'
  | 'billing'
  | 'paymentLinks'
  | 'landing'
  | 'plans'
  | 'gateways'
  | 'audit'
  | 'admins'
  | 'settings'

type SuperAdminNavSection = SuperAdminSection | 'products' | 'support' | 'feedback' | 'demo'

const sidebarItems: Array<{ key: SuperAdminNavSection; label: string }> = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'subscribers', label: 'Suscriptores' },
  { key: 'demo', label: 'Resultados Demo' },
  { key: 'support', label: 'Soporte / tickets' },
  { key: 'feedback', label: 'Onboarding / bajas' },
  { key: 'billing', label: 'Billing / Pagos' },
  { key: 'paymentLinks', label: 'Enlaces de pago' },
  { key: 'products', label: 'Productos / códigos' },
  { key: 'landing', label: 'Landing marketing' },
  { key: 'plans', label: 'Planes y módulos' },
  { key: 'gateways', label: 'Pasarelas' },
  { key: 'audit', label: 'Auditoría' },
  { key: 'admins', label: 'Admins / Roles' },
  { key: 'settings', label: 'Configuración' },
]

type SuperAdminLayoutProps = {
  currentSection?: SuperAdminNavSection
  onNavigate?: (section: any) => void
  onLogout?: () => void
  children: ReactNode
}

export default function SuperAdminLayout({
  currentSection = 'dashboard',
  onNavigate,
  onLogout,
  children,
}: SuperAdminLayoutProps) {
  const [supportCount, setSupportCount] = useState(0)

  useEffect(() => {
    let cancelled = false
    apiGet('/superadmin/support-tickets')
      .then((json: any) => {
        if (!cancelled && json?.ok) setSupportCount(Number(json.data?.open_count || 0))
      })
      .catch(() => undefined)
    return () => { cancelled = true }
  }, [currentSection])

  function navigate(section: SuperAdminNavSection) {
    if (section === 'products') {
      if (typeof window !== 'undefined' && window.location.pathname !== '/superadmin/products') window.location.href = '/superadmin/products'
      return
    }
    if (section === 'support') {
      if (typeof window !== 'undefined' && window.location.pathname !== '/superadmin/support') window.location.href = '/superadmin/support'
      return
    }
    if (section === 'feedback') {
      if (typeof window !== 'undefined' && window.location.pathname !== '/superadmin/feedback') window.location.href = '/superadmin/feedback'
      return
    }
    if (section === 'demo') {
      if (typeof window !== 'undefined' && window.location.pathname !== '/superadmin/demo') window.location.href = '/superadmin/demo'
      return
    }
    onNavigate?.(section)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f5f7fb', color: '#102033', display: 'grid', gridTemplateColumns: '270px 1fr' }}>
      <aside style={{ background: '#ffffff', borderRight: '1px solid #e5e7eb', padding: '24px 18px', display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1, color: '#6b7280', textTransform: 'uppercase' }}>KAWVO LINK</div>
          <div style={{ fontSize: 24, fontWeight: 900, marginTop: 6 }}>Super Admin</div>
          <div style={{ fontSize: 13, color: '#6b7280', marginTop: 6, lineHeight: 1.45 }}>Consola SaaS para perfiles, soporte, planes, pagos y operación.</div>
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {sidebarItems.map((item) => {
            const isActive = currentSection === item.key
            return (
              <button key={item.key} type="button" onClick={() => navigate(item.key)} style={{ textAlign: 'left', border: 'none', borderRadius: 12, padding: '12px 14px', background: isActive ? '#102033' : '#f3f4f6', color: isActive ? '#ffffff' : '#1f2937', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <span>{item.label}</span>
                {item.key === 'support' && supportCount > 0 && (
                  <span style={{ minWidth: 22, height: 22, padding: '0 6px', borderRadius: 999, background: '#06b6d4', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 900 }}>
                    {supportCount > 99 ? '99+' : supportCount}
                  </span>
                )}
              </button>
            )
          })}
        </nav>

        <div style={{ marginTop: 'auto' }}>
          <button type="button" onClick={onLogout} style={{ width: '100%', border: 'none', borderRadius: 12, padding: '12px 14px', background: '#ef4444', color: '#ffffff', fontWeight: 800, cursor: 'pointer' }}>Cerrar sesión</button>
        </div>
      </aside>

      <main style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <header style={{ background: '#ffffff', borderBottom: '1px solid #e5e7eb', padding: '18px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <div style={{ fontSize: 24, fontWeight: 900 }}>Panel de control</div>
            <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>Gestión administrativa, soporte, monetización, usuarios y operación SaaS.</div>
          </div>
          <div style={{ background: '#ecfdf5', color: '#065f46', border: '1px solid #a7f3d0', padding: '8px 12px', borderRadius: 999, fontSize: 13, fontWeight: 800, whiteSpace: 'nowrap' }}>Super Admin activo</div>
        </header>
        <section style={{ padding: '24px 28px' }}>{children}</section>
      </main>
    </div>
  )
}
