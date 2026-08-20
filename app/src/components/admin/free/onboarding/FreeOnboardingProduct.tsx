import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiPost } from '../../../../lib/api'

const PENDING_PUBLIC_CODE = 'intap_activation_public_code'

const PRODUCT_LABELS: Record<string, string> = {
  card: 'Tarjeta NFC', ping: 'Ping NFC', bracelet: 'Brazalete NFC',
  keychain: 'Llavero NFC', stand: 'Stand NFC', qr: 'Código QR', other: 'Producto Kawvo',
}

export default function FreeOnboardingProduct() {
  const navigate = useNavigate()
  const [code, setCode] = useState(() => sessionStorage.getItem(PENDING_PUBLIC_CODE) || '')
  const [product, setProduct] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const identify = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!code.trim() || loading) return
    setLoading(true)
    setError('')
    setProduct(null)
    const normalized = code.trim().toUpperCase()
    const result: any = await apiPost('/public/artifacts/identify', { public_code: normalized })
      .catch(() => ({ ok: false, error: 'No pudimos revisar el código de compra.' }))
    setLoading(false)
    if (!result.ok) {
      sessionStorage.removeItem(PENDING_PUBLIC_CODE)
      setError(result.error || 'No encontramos un producto disponible con ese código.')
      return
    }
    sessionStorage.setItem(PENDING_PUBLIC_CODE, result.data.public_code)
    setCode(result.data.public_code)
    setProduct(result.data)
  }

  return (
    <main className="min-h-screen bg-[#f7f9fc] px-5 py-8 font-['Inter'] text-slate-950">
      <section className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-[430px] flex-col justify-center">
        <button type="button" onClick={() => navigate('/admin/free/onboarding/welcome')} className="mb-6 self-start text-xs font-bold text-slate-500">← Volver</button>
        <div className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_18px_55px_rgba(15,23,42,0.08)]">
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-cyan-600">KAWVO LINK · antes INTAP</p>
          <h1 className="mt-3 text-[28px] font-black leading-tight tracking-[-0.04em]">Revisa tu código de compra</h1>
          <p className="mt-3 text-sm leading-6 text-slate-500">Está impreso o asociado a tu artículo NFC o QR. Primero confirmaremos el producto; el código de activación se pedirá en el siguiente paso.</p>

          <form onSubmit={identify} className="mt-6">
            <label className="block text-xs font-extrabold uppercase tracking-[0.1em] text-slate-500">
              Código de compra
              <input
                value={code}
                onChange={(event) => setCode(event.target.value.toUpperCase())}
                autoComplete="off"
                spellCheck={false}
                placeholder="TJ6RLWSWXJ"
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-black tracking-[0.12em] uppercase outline-none placeholder:text-slate-400 focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100"
              />
            </label>

            {error && <p className="mt-4 rounded-xl bg-rose-50 px-3 py-3 text-xs font-semibold leading-5 text-rose-700">{error}</p>}

            {product && (
              <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                <p className="text-sm font-black text-emerald-800">✓ Producto encontrado</p>
                <p className="mt-1 text-sm font-extrabold text-slate-900">{PRODUCT_LABELS[product.product_type] || PRODUCT_LABELS.other}</p>
                <p className="mt-1 font-mono text-xs font-bold text-slate-500">{product.public_code}</p>
                <p className="mt-2 text-xs leading-5 text-slate-500">Perfecto. En el próximo paso te pediremos tu código de activación.</p>
              </div>
            )}

            {!product ? (
              <button disabled={loading || !code.trim()} className="mt-5 w-full rounded-2xl bg-slate-950 px-4 py-4 text-sm font-extrabold text-white disabled:opacity-35">
                {loading ? 'Revisando…' : 'Revisar mi código'}
              </button>
            ) : (
              <button type="button" onClick={() => navigate('/admin/free/onboarding/bootstrap')} className="mt-5 w-full rounded-2xl bg-slate-950 px-4 py-4 text-sm font-extrabold text-white">
                Continuar
              </button>
            )}
          </form>
        </div>
      </section>
    </main>
  )
}
