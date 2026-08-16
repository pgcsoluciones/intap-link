import { useEffect, useMemo, useState } from 'react'
import { apiGet, apiPatch, apiPost } from '../../lib/api'
import SuperAdminLayout from './SuperAdminLayout'

type ProductType = 'card' | 'ping' | 'bracelet' | 'keychain' | 'stand' | 'qr' | 'other'
type ArtifactStatus = 'unassigned' | 'available' | 'activated' | 'suspended' | 'revoked'
type CodeStatus = 'active' | 'used' | 'revoked' | 'expired' | 'none'

type CreatedArtifact = {
  id: string
  public_code: string
  activation_code: string
  product_type: ProductType
  status: ArtifactStatus
  public_url: string
  warning?: string
}

type ArtifactItem = {
  id: string
  public_code: string
  product_type: ProductType
  status: ArtifactStatus
  owner_user_id?: string | null
  owner_email?: string | null
  profile_id?: string | null
  profile_slug?: string | null
  profile_name?: string | null
  profile_is_active?: number | boolean | null
  profile_is_published?: number | boolean | null
  activation_code_status?: CodeStatus
  activation_code_expires_at?: string | null
  activation_code_used_at?: string | null
  activated_at?: string | null
  created_at?: string | null
  updated_at?: string | null
  claim_at?: string | null
  public_url?: string
}

type ProfileOption = {
  id: string
  slug: string
  name?: string | null
  email?: string | null
  is_active?: number | boolean
  is_published?: number | boolean
}

const PRODUCT_TYPES: Array<{ value: ProductType; label: string }> = [
  { value: 'card', label: 'Tarjeta NFC' },
  { value: 'ping', label: 'Ping NFC' },
  { value: 'bracelet', label: 'Brazalete' },
  { value: 'keychain', label: 'Llavero' },
  { value: 'stand', label: 'Stand / exhibidor' },
  { value: 'qr', label: 'QR físico' },
  { value: 'other', label: 'Otro producto' },
]

const STATUS_LABELS: Record<ArtifactStatus, string> = {
  unassigned: 'Sin asignar',
  available: 'Disponible',
  activated: 'Activado',
  suspended: 'Suspendido',
  revoked: 'Revocado',
}

const CODE_LABELS: Record<CodeStatus, string> = {
  active: 'Activo',
  used: 'Utilizado',
  revoked: 'Revocado',
  expired: 'Vencido',
  none: 'Sin código',
}

function productLabel(type: ProductType) {
  return PRODUCT_TYPES.find(item => item.value === type)?.label || 'Producto INTAP'
}

function formatDate(value?: string | null) {
  if (!value) return '—'
  const date = new Date(value.endsWith('Z') || value.includes('+') ? value : `${value.replace(' ', 'T')}Z`)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('es-DO')
}

export default function SuperAdminArtifacts() {
  const [productType, setProductType] = useState<ProductType>('card')
  const [expiresAt, setExpiresAt] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [created, setCreated] = useState<CreatedArtifact | null>(null)
  const [copied, setCopied] = useState('')

  const [artifacts, setArtifacts] = useState<ArtifactItem[]>([])
  const [profiles, setProfiles] = useState<ProfileOption[]>([])
  const [loadingInventory, setLoadingInventory] = useState(true)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [selected, setSelected] = useState<ArtifactItem | null>(null)
  const [selectedProfileId, setSelectedProfileId] = useState('')
  const [rotatedCode, setRotatedCode] = useState('')
  const [rotateExpiresAt, setRotateExpiresAt] = useState('')

  const loadInventory = async () => {
    setLoadingInventory(true)
    try {
      const params = new URLSearchParams({ limit: '100' })
      if (query.trim()) params.set('q', query.trim())
      if (statusFilter) params.set('status', statusFilter)
      const [artifactsJson, subscribersJson]: any[] = await Promise.all([
        apiGet(`/superadmin/artifacts?${params.toString()}`),
        apiGet('/superadmin/subscribers?limit=100'),
      ])

      if (!artifactsJson?.ok) throw new Error(artifactsJson?.error || 'No se pudo cargar el inventario.')
      const items = artifactsJson.data?.items || artifactsJson.data || []
      setArtifacts(Array.isArray(items) ? items : [])

      if (subscribersJson?.ok) {
        const subscribers = subscribersJson.data?.subscribers || subscribersJson.data || []
        setProfiles((Array.isArray(subscribers) ? subscribers : [])
          .filter((item: any) => item.profile_id && item.slug)
          .map((item: any) => ({
            id: item.profile_id,
            slug: item.slug,
            name: item.profile_name || item.name || null,
            email: item.email || null,
            is_active: item.is_active,
            is_published: item.is_published,
          })))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar el inventario.')
    } finally {
      setLoadingInventory(false)
    }
  }

  useEffect(() => { void loadInventory() }, [])

  const stats = useMemo(() => ({
    total: artifacts.length,
    available: artifacts.filter(item => item.status === 'available' || item.status === 'unassigned').length,
    activated: artifacts.filter(item => item.status === 'activated').length,
    suspended: artifacts.filter(item => item.status === 'suspended').length,
  }), [artifacts])

  async function createArtifact() {
    if (saving) return
    setSaving(true)
    setError('')
    setMessage('')
    setCreated(null)

    try {
      const json: any = await apiPost('/admin/artifacts', {
        product_type: productType,
        expires_at: expiresAt || null,
      })

      if (!json?.ok || !json?.data) throw new Error(json?.error || 'No se pudo crear el producto.')
      setCreated(json.data as CreatedArtifact)
      setMessage('Producto creado. Guarda el código secreto antes de salir de esta pantalla.')
      await loadInventory()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear el producto.')
    } finally {
      setSaving(false)
    }
  }

  async function copyValue(label: string, value: string) {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(label)
      window.setTimeout(() => setCopied(''), 1600)
    } catch {
      setError('No se pudo copiar automáticamente. Copia el valor manualmente.')
    }
  }

  async function openDetail(item: ArtifactItem) {
    setError('')
    setMessage('')
    setRotatedCode('')
    try {
      const json: any = await apiGet(`/superadmin/artifacts/${item.id}`)
      if (!json?.ok || !json?.data) throw new Error(json?.error || 'No se pudo abrir el producto.')
      const detail = json.data as ArtifactItem
      setSelected(detail)
      setSelectedProfileId(detail.profile_id || '')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo abrir el producto.')
    }
  }

  async function saveProfile() {
    if (!selected || saving) return
    setSaving(true)
    setError('')
    setMessage('')
    try {
      const json: any = await apiPatch(`/superadmin/artifacts/${selected.id}/profile`, { profile_id: selectedProfileId || null })
      if (!json?.ok) throw new Error(json?.error || 'No se pudo actualizar el destino.')
      setMessage('Destino dinámico actualizado. La URL física no cambió.')
      await loadInventory()
      await openDetail({ ...selected, ...(json.data || {}) })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar el destino.')
    } finally {
      setSaving(false)
    }
  }

  async function changeStatus(nextStatus: 'activated' | 'suspended' | 'revoked') {
    if (!selected || saving) return
    setSaving(true)
    setError('')
    setMessage('')
    try {
      const json: any = await apiPatch(`/superadmin/artifacts/${selected.id}/status`, { status: nextStatus })
      if (!json?.ok) throw new Error(json?.error || 'No se pudo cambiar el estado.')
      setMessage(`Estado actualizado a ${STATUS_LABELS[nextStatus]}.`)
      await loadInventory()
      await openDetail({ ...selected, ...(json.data || {}) })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cambiar el estado.')
    } finally {
      setSaving(false)
    }
  }

  async function rotateActivationCode() {
    if (!selected || saving) return
    if (!window.confirm('Se revocará cualquier código de activación todavía activo y se generará uno nuevo. ¿Continuar?')) return
    setSaving(true)
    setError('')
    setMessage('')
    setRotatedCode('')
    try {
      const json: any = await apiPost(`/superadmin/artifacts/${selected.id}/activation-code/rotate`, {
        expires_at: rotateExpiresAt || null,
      })
      if (!json?.ok || !json?.data?.activation_code) throw new Error(json?.error || 'No se pudo generar un nuevo código.')
      setRotatedCode(json.data.activation_code)
      setMessage('Nuevo código generado. Se mostrará solamente en esta sesión.')
      await loadInventory()
      await openDetail(selected)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo generar un nuevo código.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <SuperAdminLayout
      currentSection="products"
      onNavigate={(section) => {
        if (section === 'products') return
        window.location.href = '/superadmin'
      }}
      onLogout={() => { window.location.href = '/admin/login' }}
    >
      <div className="mx-auto max-w-6xl space-y-6 text-slate-900">
        <section className="rounded-3xl bg-white p-6 shadow-sm md:p-8">
          <header className="mb-8">
            <p className="text-xs font-black uppercase tracking-[0.25em] text-emerald-600">INTAP LINK</p>
            <h1 className="mt-2 text-3xl font-black">Productos, códigos y enlaces dinámicos</h1>
            <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600">
              Provisiona productos, revisa el estado real de cada código, identifica quién reclamó un producto y administra el perfil destino sin cambiar la URL grabada en NFC o QR.
            </p>
          </header>

          {error && <p className="mb-5 rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-600">{error}</p>}
          {message && <p className="mb-5 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">{message}</p>}

          <div className="grid gap-4 md:grid-cols-4">
            <Stat label="Total" value={stats.total} />
            <Stat label="Disponibles" value={stats.available} />
            <Stat label="Activados" value={stats.activated} />
            <Stat label="Suspendidos" value={stats.suspended} />
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1fr_.9fr]">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-xl font-black">Crear producto</h2>
            <p className="mt-1 text-sm text-slate-500">Genera el identificador público y un código secreto de un solo uso.</p>

            <label className="mt-5 block text-xs font-black text-slate-600">Tipo de producto</label>
            <select value={productType} onChange={(event) => setProductType(event.target.value as ProductType)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none focus:border-emerald-400">
              {PRODUCT_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>

            <label className="mt-5 block text-xs font-black text-slate-600">Vencimiento del código (opcional)</label>
            <input type="datetime-local" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-emerald-400" />
            <p className="mt-2 text-xs leading-5 text-slate-400">Déjalo vacío si el código no debe vencer antes de ser utilizado.</p>

            <button type="button" disabled={saving} onClick={() => void createArtifact()} className="mt-5 w-full rounded-2xl bg-slate-950 px-4 py-3.5 text-sm font-black text-white disabled:opacity-50">
              {saving ? 'Procesando…' : 'Generar producto y código'}
            </button>
          </div>

          <div className="rounded-3xl border border-emerald-200 bg-emerald-50/60 p-5 shadow-sm">
            <h2 className="text-xl font-black text-emerald-950">Regla del enlace dinámico</h2>
            <p className="mt-2 text-sm leading-6 text-emerald-900/75">El NFC o QR usa siempre la URL pública del producto. El destino puede cambiar desde aquí sin reprogramar el dispositivo.</p>
            <div className="mt-5 rounded-2xl border border-emerald-200 bg-white p-4 text-sm text-slate-700">
              <p className="font-black">Separación correcta</p>
              <p className="mt-2 leading-6">Código secreto = reclamar una vez · Código público = identificar · URL pública = grabar físicamente · Perfil destino = administrar dinámicamente.</p>
            </div>
          </div>
        </section>

        {created && (
          <section className="rounded-3xl border-2 border-violet-200 bg-violet-50 p-5 shadow-sm">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div><p className="text-xs font-black uppercase tracking-[0.18em] text-violet-600">Producto generado</p><h2 className="mt-1 text-2xl font-black">Guarda el código ahora</h2></div>
              <span className="w-fit rounded-full bg-white px-3 py-1.5 text-xs font-black text-violet-700">{productLabel(created.product_type)}</span>
            </div>
            <div className="mt-5 grid gap-3">
              <ValueRow label="Código de activación · secreto" value={created.activation_code} actionLabel={copied === 'activation' ? 'Copiado' : 'Copiar código'} onAction={() => void copyValue('activation', created.activation_code)} strong />
              <ValueRow label="URL pública permanente" value={created.public_url} actionLabel={copied === 'url' ? 'Copiada' : 'Copiar URL'} onAction={() => void copyValue('url', created.public_url)} />
              <div className="grid gap-3 sm:grid-cols-2"><InfoBox label="Código público" value={created.public_code} /><InfoBox label="Estado" value={STATUS_LABELS[created.status]} /></div>
            </div>
            <p className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-xs font-bold leading-5 text-amber-800">{created.warning || 'El código secreto no puede recuperarse después. Si se pierde antes de utilizarse, Super Admin puede revocarlo y emitir uno nuevo.'}</p>
          </section>
        )}

        <section className="rounded-3xl bg-white p-6 shadow-sm md:p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div><p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Inventario</p><h2 className="mt-1 text-2xl font-black">Productos generados</h2></div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input value={query} onChange={event => setQuery(event.target.value.toUpperCase())} placeholder="Código público, email o slug" className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-emerald-400" />
              <select value={statusFilter} onChange={event => setStatusFilter(event.target.value)} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold"><option value="">Todos los estados</option>{Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
              <button onClick={() => void loadInventory()} className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-black text-white">Buscar</button>
            </div>
          </div>

          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[960px] text-left text-sm">
              <thead className="text-[11px] uppercase tracking-wide text-slate-400"><tr><th className="border-b p-3">Código</th><th className="border-b p-3">Producto</th><th className="border-b p-3">Estado</th><th className="border-b p-3">Código activación</th><th className="border-b p-3">Propietario</th><th className="border-b p-3">Destino</th><th className="border-b p-3">Creado</th><th className="border-b p-3"></th></tr></thead>
              <tbody>
                {artifacts.map(item => (
                  <tr key={item.id} className="border-b border-slate-100 align-top">
                    <td className="p-3 font-mono font-black">{item.public_code}</td>
                    <td className="p-3">{productLabel(item.product_type)}</td>
                    <td className="p-3"><Badge>{STATUS_LABELS[item.status] || item.status}</Badge></td>
                    <td className="p-3"><Badge>{CODE_LABELS[item.activation_code_status || 'none']}</Badge>{item.activation_code_used_at && <div className="mt-1 text-[10px] text-slate-400">{formatDate(item.activation_code_used_at)}</div>}</td>
                    <td className="p-3"><div className="font-semibold">{item.owner_email || '—'}</div></td>
                    <td className="p-3"><div className="font-semibold">{item.profile_slug ? `/${item.profile_slug}` : 'Sin perfil'}</div></td>
                    <td className="p-3 text-xs text-slate-500">{formatDate(item.created_at)}</td>
                    <td className="p-3"><button onClick={() => void openDetail(item)} className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-black text-slate-700">Gestionar</button></td>
                  </tr>
                ))}
                {!loadingInventory && artifacts.length === 0 && <tr><td colSpan={8} className="p-8 text-center text-slate-400">No hay productos con estos filtros.</td></tr>}
              </tbody>
            </table>
          </div>
          {loadingInventory && <p className="mt-5 text-sm text-slate-400">Cargando inventario…</p>}
        </section>
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null) }}>
          <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl md:p-8">
            <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-600">Gestionar producto</p><h2 className="mt-1 font-mono text-2xl font-black">{selected.public_code}</h2><p className="mt-1 text-sm text-slate-500">{productLabel(selected.product_type)}</p></div><button onClick={() => setSelected(null)} className="rounded-full bg-slate-100 px-3 py-2 text-sm font-black">✕</button></div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <InfoBox label="Estado producto" value={STATUS_LABELS[selected.status]} />
              <InfoBox label="Estado código" value={CODE_LABELS[selected.activation_code_status || 'none']} />
              <InfoBox label="Activado" value={formatDate(selected.activated_at)} />
              <InfoBox label="Propietario" value={selected.owner_email || 'Sin propietario'} />
              <InfoBox label="Claim" value={formatDate(selected.claim_at)} />
              <InfoBox label="Destino actual" value={selected.profile_slug ? `/${selected.profile_slug}` : 'Sin perfil'} />
            </div>

            <div className="mt-6 rounded-2xl border border-slate-200 p-4">
              <p className="text-sm font-black">Enlace físico permanente</p>
              <code className="mt-2 block break-all text-xs font-bold text-slate-600">{selected.public_url || '—'}</code>
              {selected.public_url && <button onClick={() => void copyValue('selected-url', selected.public_url!)} className="mt-3 rounded-xl bg-slate-100 px-3 py-2 text-xs font-black">{copied === 'selected-url' ? 'Copiada' : 'Copiar URL'}</button>}
            </div>

            <div className="mt-6 rounded-2xl border border-violet-200 bg-violet-50/50 p-4">
              <p className="text-sm font-black text-violet-950">Destino dinámico</p>
              <p className="mt-1 text-xs leading-5 text-violet-900/70">Cambiar el perfil no modifica el código público ni la URL programada en el producto.</p>
              <select value={selectedProfileId} onChange={event => setSelectedProfileId(event.target.value)} className="mt-3 w-full rounded-xl border border-violet-200 bg-white px-3 py-3 text-sm"><option value="">Sin perfil vinculado</option>{profiles.map(profile => <option key={profile.id} value={profile.id}>/{profile.slug} · {profile.name || profile.email || 'Perfil'}</option>)}</select>
              <button disabled={saving || !['activated', 'suspended'].includes(selected.status)} onClick={() => void saveProfile()} className="mt-3 w-full rounded-xl bg-violet-600 px-4 py-3 text-sm font-black text-white disabled:opacity-40">Guardar destino</button>
            </div>

            <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
              <p className="text-sm font-black text-amber-950">Código de activación</p>
              <p className="mt-1 text-xs leading-5 text-amber-900/70">El secreto original no se almacena y no puede mostrarse otra vez. Si todavía no fue utilizado, puedes revocarlo y emitir uno nuevo.</p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row"><input type="datetime-local" value={rotateExpiresAt} onChange={event => setRotateExpiresAt(event.target.value)} className="flex-1 rounded-xl border border-amber-200 bg-white px-3 py-3 text-sm" /><button disabled={saving || !['available', 'unassigned'].includes(selected.status)} onClick={() => void rotateActivationCode()} className="rounded-xl bg-amber-600 px-4 py-3 text-sm font-black text-white disabled:opacity-40">Emitir nuevo código</button></div>
              {rotatedCode && <div className="mt-4 rounded-xl bg-white p-4"><p className="text-[10px] font-black uppercase text-amber-700">Nuevo secreto · guardar ahora</p><div className="mt-2 flex items-center justify-between gap-3"><code className="break-all text-lg font-black">{rotatedCode}</code><button onClick={() => void copyValue('rotated', rotatedCode)} className="rounded-lg bg-slate-950 px-3 py-2 text-xs font-black text-white">{copied === 'rotated' ? 'Copiado' : 'Copiar'}</button></div></div>}
            </div>

            <div className="mt-6 rounded-2xl border border-slate-200 p-4">
              <p className="text-sm font-black">Estado operativo</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {selected.status === 'activated' && <button disabled={saving} onClick={() => void changeStatus('suspended')} className="rounded-xl bg-amber-50 px-4 py-2.5 text-xs font-black text-amber-700">Suspender</button>}
                {selected.status === 'suspended' && <button disabled={saving} onClick={() => void changeStatus('activated')} className="rounded-xl bg-emerald-50 px-4 py-2.5 text-xs font-black text-emerald-700">Reactivar</button>}
                {selected.status !== 'revoked' && <button disabled={saving} onClick={() => { if (window.confirm('Revocar este producto deshabilitará permanentemente su resolución pública.')) void changeStatus('revoked') }} className="rounded-xl bg-red-50 px-4 py-2.5 text-xs font-black text-red-600">Revocar producto</button>}
              </div>
            </div>
          </div>
        </div>
      )}
    </SuperAdminLayout>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-[10px] font-black uppercase tracking-wide text-slate-400">{label}</p><p className="mt-2 text-2xl font-black">{value}</p></div>
}
function Badge({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-black text-slate-600">{children}</span>
}
function InfoBox({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl bg-slate-50 p-4"><p className="text-[10px] font-black uppercase tracking-wide text-slate-400">{label}</p><p className="mt-2 break-words text-sm font-black text-slate-800">{value}</p></div>
}
function ValueRow({ label, value, actionLabel, onAction, strong = false }: { label: string; value: string; actionLabel: string; onAction: () => void; strong?: boolean }) {
  return <div className="rounded-2xl bg-white p-4"><p className="text-[10px] font-black uppercase tracking-wide text-slate-400">{label}</p><div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><code className={`break-all ${strong ? 'text-lg font-black text-slate-950' : 'text-sm font-bold text-slate-800'}`}>{value}</code><button type="button" onClick={onAction} className="rounded-xl bg-slate-950 px-3 py-2 text-xs font-black text-white">{actionLabel}</button></div></div>
}
