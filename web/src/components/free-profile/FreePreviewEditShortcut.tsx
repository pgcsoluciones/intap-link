export default function FreePreviewEditShortcut() {
  if (typeof window === 'undefined') return null
  const params = new URLSearchParams(window.location.search)
  if (params.get('preview') !== '1') return null

  const appUrl = (import.meta.env.VITE_APP_URL || 'https://app.intaprd.com').replace(/\/$/, '')

  return (
    <div style={{ position: 'fixed', top: 14, left: 12, right: 12, zIndex: 2147483000, display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
      <a
        href={`${appUrl}/admin/free`}
        aria-label="Volver a editar mi perfil"
        style={{ pointerEvents: 'auto', display: 'inline-flex', alignItems: 'center', gap: 8, minHeight: 46, padding: '11px 18px', borderRadius: 999, background: '#07111f', color: '#fff', fontFamily: 'Inter, system-ui, sans-serif', fontSize: 13, fontWeight: 900, textDecoration: 'none', boxShadow: '0 14px 35px rgba(15,23,42,.32)', border: '1px solid rgba(255,255,255,.22)' }}
      >
        <span aria-hidden="true">←</span>
        <span>Volver a edición</span>
      </a>
    </div>
  )
}
