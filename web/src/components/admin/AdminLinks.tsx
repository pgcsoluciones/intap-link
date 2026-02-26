import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiGet, apiPost, apiPut, apiDelete } from '../../lib/api'

interface LinkItem {
  id: string
  label: string
  url: string
  sort_order: number
  is_active: number
}

export default function AdminLinks() {
  const [links, setLinks] = useState<LinkItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [newUrl, setNewUrl] = useState('')
  const [error, setError] = useState('')

  const reload = () =>
    apiGet('/me/links').then((json: any) => {
      if (json.ok) setLinks(json.data || [])
    }).finally(() => setLoading(false))

  useEffect(() => { reload() }, [])

  const addLink = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSaving(true)
    const json: any = await apiPost('/me/links', { label: newLabel, url: newUrl })
    if (json.ok) { setNewLabel(''); setNewUrl(''); reload() }
    else setError(json.error || 'Error al guardar')
    setSaving(false)
  }

  const toggleActive = async (link: LinkItem) => {
    await apiPut(`/me/links/${link.id}`, { is_active: !link.is_active })
    reload()
  }

  const deleteLink = async (id: string) => {
    if (!confirm('¿Eliminar este link?')) return
    await apiDelete(`/me/links/${id}`)
    reload()
  }

  const move = async (index: number, dir: -1 | 1) => {
    const newLinks = [...links]
    const swapIndex = index + dir
    if (swapIndex < 0 || swapIndex >= newLinks.length) return
    ;[newLinks[index], newLinks[swapIndex]] = [newLinks[swapIndex], newLinks[index]]
    const orderedIds = newLinks.map((l) => l.id)
    setLinks(newLinks)
    await apiPut('/me/links/reorder', { orderedIds })
    reload()
  }

  if (loading) return (
    <div className="min-h-screen bg-intap-dark flex items-center justify-center">
      <div className="loading-spinner" />
    </div>
  )

  return (
    <div className="min-h-screen bg-intap-dark text-white font-['Inter'] flex flex-col items-center py-10 px-4">
      <div className="w-full max-w-lg">
        <header className="flex items-center gap-4 mb-8">
          <Link to="/admin" className="text-slate-400 hover:text-white transition-colors">←</Link>
          <h1 className="text-xl font-black">Mis links</h1>
        </header>

        {/* Add new link */}
        <form onSubmit={addLink} className="glass-card p-5 mb-6 flex flex-col gap-3">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Agregar link</p>
          <input
            type="text"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="Etiqueta (ej. Mi Instagram)"
            required
            className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-intap-mint/50 transition-colors"
          />
          <input
            type="url"
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            placeholder="https://..."
            required
            className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-intap-mint/50 transition-colors"
          />
          {error && <p className="text-xs text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={saving}
            className="w-full bg-gradient-to-r from-intap-blue to-purple-600 text-white font-bold py-3 rounded-xl text-sm disabled:opacity-50"
          >
            {saving ? 'Guardando…' : '+ Agregar'}
          </button>
        </form>

        {/* Link list */}
        {links.length === 0 ? (
          <p className="text-center text-slate-500 text-sm py-8">Sin links aún. Agrega el primero.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {links.map((link, i) => (
              <div key={link.id} className={`glass-card p-4 flex items-center gap-3 ${!link.is_active ? 'opacity-40' : ''}`}>
                {/* Reorder buttons */}
                <div className="flex flex-col gap-0.5">
                  <button onClick={() => move(i, -1)} disabled={i === 0} className="text-slate-500 hover:text-white disabled:opacity-20 text-xs leading-none">▲</button>
                  <button onClick={() => move(i, 1)} disabled={i === links.length - 1} className="text-slate-500 hover:text-white disabled:opacity-20 text-xs leading-none">▼</button>
                </div>

                {/* Link info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate">{link.label}</p>
                  <p className="text-xs text-slate-400 truncate">{link.url}</p>
                </div>

                {/* Toggle active */}
                <button
                  onClick={() => toggleActive(link)}
                  title={link.is_active ? 'Desactivar' : 'Activar'}
                  className={`text-xs px-2 py-1 rounded-full border font-bold transition-colors ${
                    link.is_active
                      ? 'border-intap-mint/30 text-intap-mint bg-intap-mint/10'
                      : 'border-white/10 text-slate-500'
                  }`}
                >
                  {link.is_active ? 'ON' : 'OFF'}
                </button>

                {/* Delete */}
                <button
                  onClick={() => deleteLink(link.id)}
                  className="text-slate-500 hover:text-red-400 transition-colors text-sm"
                  title="Eliminar"
                >
                  🗑
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
