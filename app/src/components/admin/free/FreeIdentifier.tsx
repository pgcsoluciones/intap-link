import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiGet, apiPut } from '../../../lib/api'
import { FreeBackButton } from './FreePanelUi'

function normalizeSlug(value: string) {
  return value.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9_-]/g, '').slice(0, 32)
}

export default function FreeIdentifier() {
  const navigate = useNavigate()
  const [slug, setSlug] = useState('')
  const [currentSlug, setCurrentSlug] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    apiGet('/me').then((json: any) => {
      if (!json?.ok) return
      const current = String(json.data?.slug || '')
      setCurrentSlug(current)
      if (current && !current.startsWith('kawvo-')) setSlug(current)
    }).finally(() => setLoading(false))
  }, [])

  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    const next = normalizeSlug(slug)
    if (next.length < 2 || saving) return
    setSaving(true)
    setError('')
    const result: any = await apiPut('/me/profile/slug', { slug: next }).catch(() => ({ ok: false, error: 'No pudimos reservar ese identificador.' }))
    setSaving(false)
    if (!result.ok) {
      setError(result.error === 'Slug no disponible' ? 'Ese identificador ya está siendo usado. Prueba con otro.' : result.error || 'No pudimos reservar ese identificador.')
      return
    }
    navigate('/admin/free', { replace: true })
  }

  if (loading) return <main className="min-h-screen bg-[#f7f9fc] flex items-center justify-center"><div className="loading-spinner" /></main>

  return (
    <main className="min-h-screen bg-[#f7f9fc] px-5 py-5 font-['Inter'] text-slate-950">
      <section className="mx-auto w-full max-w-[430px]">
        <FreeBackButton onClick={() => navigate('/admin/free')} />
        <p className="mt-6 text-[11px] font-black uppercase tracking-[0.2em] text-cyan-600">Primer paso recomendado</p>
        <h1 className="mt-2 text-[30px] font-black leading-tight tracking-[-0.04em]">Reserva tu identificador</h1>
        <p className="mt-2 text-[15px] leading-6 text-slate-500">Es la dirección corta que compartirás con otras personas. Elige algo fácil de recordar.</p>

        <form onSubmit={save} className="mt-7 rounded-[28px] border border-cyan-200 bg-white p-5 shadow-[0_18px_55px_rgba(15,23,42,0.07)] ring-4 ring-cyan-50">
          {currentSlug.startsWith('kawvo-') && <div className="mb-5 rounded-2xl bg-amber-50 p-4 text-xs leading-5 text-amber-800">El identificador que ves ahora es temporal. Nadie espera que memorices ese código; cámbialo por uno tuyo.</div>}
          <label className="block text-xs font-black uppercase tracking-[0.12em] text-slate-500">
            Tu identificador
            <div className="mt-2 flex items-center rounded-2xl border border-slate-200 bg-slate-50 px-4 focus-within:border-cyan-400 focus-within:ring-4 focus-within:ring-cyan-100">
              <span className="text-sm font-bold text-slate-400">/</span>
              <input value={slug} onChange={(event) => setSlug(normalizeSlug(event.target.value))} placeholder="tu-negocio" maxLength={32} autoCapitalize="none" autoCorrect="off" spellCheck={false} className="min-w-0 flex-1 bg-transparent px-1 py-4 text-sm font-black text-slate-900 outline-none" />
            </div>
          </label>
          <p className="mt-2 text-xs leading-5 text-slate-400">Usa letras, números, guion o guion bajo. Ejemplo: <strong>/cafedemaria</strong></p>
          {slug && <p className="mt-4 rounded-2xl bg-cyan-50 p-3 text-sm font-bold text-cyan-800">Tu perfil quedará como: <strong>/{slug}</strong></p>}
          {error && <p className="mt-4 rounded-xl bg-rose-50 px-3 py-3 text-xs font-semibold text-rose-700">{error}</p>}
          <button disabled={saving || normalizeSlug(slug).length < 2} className="mt-5 w-full rounded-2xl bg-slate-950 px-4 py-4 text-sm font-extrabold text-white disabled:opacity-35">{saving ? 'Reservando…' : 'Reservar mi identificador'}</button>
        </form>
      </section>
    </main>
  )
}
