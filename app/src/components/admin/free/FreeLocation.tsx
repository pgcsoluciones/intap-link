import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiGet, apiPut } from '../../../lib/api'

export default function FreeLocation() {
  const navigate = useNavigate()
  const [address, setAddress] = useState('')
  const [mapUrl, setMapUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    apiGet('/me/contact').then((json: any) => {
      if (!json.ok || !json.data) return
      setAddress(json.data.address || '')
      setMapUrl(json.data.map_url || '')
    })
  }, [])

  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setSaved(false)
    try {
      const json: any = await apiPut('/me/contact', { address: address.trim(), map_url: mapUrl.trim() })
      if (json.ok) setSaved(true)
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#f7f9fc] font-['Inter'] text-slate-950">
      <div className="mx-auto w-full max-w-[430px] px-5 pb-24 pt-5">
        <button onClick={() => navigate('/admin/free')} className="mb-5 text-sm font-bold text-cyan-700">← Mi panel</button>
        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-cyan-600">Plan Gratis</p>
        <h1 className="mt-1 text-2xl font-black tracking-[-0.04em]">Ubicación</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">Indica dónde pueden encontrarte. Puedes dejarlo vacío si no recibes clientes en un lugar físico.</p>

        <form onSubmit={save} className="mt-5 rounded-[26px] border border-slate-200 bg-white p-5 shadow-[0_12px_35px_rgba(15,23,42,.05)]">
          <label className="text-xs font-black text-slate-600">Dirección</label>
          <textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={3} placeholder="Calle, sector, ciudad" className="mt-2 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-cyan-400" />

          <label className="mt-5 block text-xs font-black text-slate-600">Enlace del mapa</label>
          <input value={mapUrl} onChange={(e) => setMapUrl(e.target.value)} inputMode="url" placeholder="https://maps.google.com/..." className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-cyan-400" />
          <p className="mt-2 text-xs leading-5 text-slate-400">Pega el enlace de tu ubicación desde Google Maps. Luego podremos mejorar esta pantalla con búsqueda directa sin cambiar tu perfil.</p>

          {saved && <p className="mt-4 rounded-2xl bg-emerald-50 px-4 py-3 text-xs font-bold text-emerald-700">Ubicación guardada.</p>}
          <button disabled={saving} className="mt-5 w-full rounded-2xl bg-gradient-to-r from-cyan-500 to-violet-600 py-3 text-sm font-black text-white disabled:opacity-50">{saving ? 'Guardando…' : 'Guardar ubicación'}</button>
        </form>
      </div>
    </main>
  )
}
