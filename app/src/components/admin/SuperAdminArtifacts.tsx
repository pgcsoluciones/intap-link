import { useState } from 'react'
import { apiPost } from '../../lib/api'
import SuperAdminLayout from './SuperAdminLayout'

type ProductType = 'card' | 'ping' | 'bracelet' | 'keychain' | 'stand' | 'qr' | 'other'

type CreatedArtifact = {
  id: string
  public_code: string
  activation_code: string
  product_type: ProductType
  status: string
  public_url: string
  warning?: string
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

export default function SuperAdminArtifacts() {
  const [productType, setProductType] = useState<ProductType>('card')
  const [expiresAt, setExpiresAt] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [created, setCreated] = useState<CreatedArtifact | null>(null)
  const [copied, setCopied] = useState('')

  async function createArtifact() {
    if (saving) return
    setSaving(true)
    setError('')
    setCreated(null)

    try {
      const json: any = await apiPost('/admin/artifacts', {
        product_type: productType,
        expires_at: expiresAt || null,
      })

      if (!json?.ok || !json?.data) {
        throw new Error(json?.error || 'No se pudo crear el producto.')
      }

      setCreated(json.data as CreatedArtifact)
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

  return (
    <SuperAdminLayout
      currentSection="products"
      onNavigate={(section) => {
        if (section === 'products') return
        window.location.href = '/superadmin'
      }}
      onLogout={() => { window.location.href = '/admin/login' }}
    >
      <div className="mx-auto max-w-5xl rounded-3xl bg-white p-6 text-slate-900 shadow-sm md:p-8">
        <header className="mb-8">
          <p className="text-xs font-black uppercase tracking-[0.25em] text-emerald-600">INTAP LINK</p>
          <h1 className="mt-2 text-3xl font-black">Productos físicos y códigos</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Provisiona tarjetas, pings, brazaletes, llaveros, stands y QR. El código secreto se muestra una sola vez; la URL pública permanece estable para permitir vinculación dinámica con el perfil.
          </p>
        </header>

        <section className="grid gap-6 lg:grid-cols-[1fr_.9fr]">
          <div className="rounded-3xl border border-slate-200 p-5">
            <h2 className="text-xl font-black">Crear producto</h2>
            <p className="mt-1 text-sm text-slate-500">Genera el identificador público y un código de activación de un solo uso.</p>

            <label className="mt-5 block text-xs font-black text-slate-600">Tipo de producto</label>
            <select
              value={productType}
              onChange={(event) => setProductType(event.target.value as ProductType)}
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none focus:border-emerald-400"
            >
              {PRODUCT_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>

            <label className="mt-5 block text-xs font-black text-slate-600">Vencimiento del código (opcional)</label>
            <input
              type="datetime-local"
              value={expiresAt}
              onChange={(event) => setExpiresAt(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-emerald-400"
            />
            <p className="mt-2 text-xs leading-5 text-slate-400">Déjalo vacío si el código no debe vencer antes de ser utilizado.</p>

            {error && <p className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-600">{error}</p>}

            <button
              type="button"
              disabled={saving}
              onClick={() => void createArtifact()}
              className="mt-5 w-full rounded-2xl bg-slate-950 px-4 py-3.5 text-sm font-black text-white disabled:opacity-50"
            >
              {saving ? 'Generando…' : 'Generar producto y código'}
            </button>
          </div>

          <div className="rounded-3xl border border-emerald-200 bg-emerald-50/60 p-5">
            <h2 className="text-xl font-black text-emerald-950">Enlace dinámico</h2>
            <p className="mt-2 text-sm leading-6 text-emerald-900/75">
              El NFC o QR debe usar la URL pública del producto, nunca el slug final del perfil. Así el producto conserva el mismo enlace físico aunque la vinculación del perfil cambie posteriormente.
            </p>
            <div className="mt-5 rounded-2xl border border-emerald-200 bg-white p-4 text-sm text-slate-700">
              <p className="font-black">Flujo protegido</p>
              <p className="mt-2 leading-6">Producto → código secreto → cuenta/login → claim una sola vez → perfil → URL pública permanente.</p>
            </div>
            <p className="mt-4 text-xs leading-5 text-emerald-900/65">
              Este módulo no modifica la lógica B2 de claim. Solo utiliza el provisioning administrativo ya existente.
            </p>
          </div>
        </section>

        {created && (
          <section className="mt-7 rounded-3xl border-2 border-violet-200 bg-violet-50 p-5">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-600">Producto generado</p>
                <h2 className="mt-1 text-2xl font-black">Guarda el código ahora</h2>
              </div>
              <span className="w-fit rounded-full bg-white px-3 py-1.5 text-xs font-black text-violet-700">{created.product_type}</span>
            </div>

            <div className="mt-5 grid gap-3">
              <div className="rounded-2xl bg-white p-4">
                <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">Código de activación · secreto</p>
                <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <code className="break-all text-lg font-black text-slate-950">{created.activation_code}</code>
                  <button type="button" onClick={() => void copyValue('activation', created.activation_code)} className="rounded-xl bg-slate-950 px-3 py-2 text-xs font-black text-white">
                    {copied === 'activation' ? 'Copiado' : 'Copiar código'}
                  </button>
                </div>
              </div>

              <div className="rounded-2xl bg-white p-4">
                <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">URL pública permanente</p>
                <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <code className="break-all text-sm font-bold text-slate-800">{created.public_url}</code>
                  <button type="button" onClick={() => void copyValue('url', created.public_url)} className="rounded-xl bg-violet-600 px-3 py-2 text-xs font-black text-white">
                    {copied === 'url' ? 'Copiada' : 'Copiar URL'}
                  </button>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl bg-white p-4">
                  <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">Código público</p>
                  <p className="mt-2 font-black">{created.public_code}</p>
                </div>
                <div className="rounded-2xl bg-white p-4">
                  <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">Estado</p>
                  <p className="mt-2 font-black capitalize">{created.status}</p>
                </div>
              </div>
            </div>

            <p className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-xs font-bold leading-5 text-amber-800">
              {created.warning || 'El código secreto no puede recuperarse después. Guárdalo antes de salir de esta pantalla.'}
            </p>
          </section>
        )}
      </div>
    </SuperAdminLayout>
  )
}
