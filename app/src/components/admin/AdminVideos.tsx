import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiGet, apiPost, apiPut, apiDelete } from '../../lib/api'

interface VideoItem {
  id: string
  title: string
  url: string
  sort_order: number
  is_active: number
}

function getEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url)
    // YouTube
    if (u.hostname.includes('youtube.com') || u.hostname.includes('youtu.be')) {
      const vid =
        u.searchParams.get('v') ||
        (u.hostname === 'youtu.be' ? u.pathname.slice(1) : null) ||
        u.pathname.split('/').pop()
      if (vid) return `https://www.youtube.com/embed/${vid}`
    }
    // Vimeo
    if (u.hostname.includes('vimeo.com')) {
      const vid = u.pathname.split('/').filter(Boolean).pop()
      if (vid) return `https://player.vimeo.com/video/${vid}`
    }
  } catch { /* ignore */ }
  return null
}

export default function AdminVideos() {
  const [videos, setVideos] = useState<VideoItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [limitError, setLimitError] = useState('')

  const [newTitle, setNewTitle] = useState('')
  const [newUrl, setNewUrl] = useState('')

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editUrl, setEditUrl] = useState('')

  const reload = () =>
    apiGet('/me/videos').then((json: any) => {
      if (json.ok) setVideos(json.data || [])
    }).finally(() => setLoading(false))

  useEffect(() => { reload() }, [])

  const addVideo = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLimitError('')
    setSaving(true)
    const json: any = await apiPost('/me/videos', { title: newTitle, url: newUrl })
    if (json.ok) {
      setNewTitle('')
      setNewUrl('')
      reload()
    } else if (json.limit) {
      setLimitError(`Límite del plan alcanzado (${json.limit} videos). Actualiza tu plan.`)
    } else {
      setError(json.error || 'Error al guardar')
    }
    setSaving(false)
  }

  const toggleEdit = (id: string) => {
    if (editingId === id) { setEditingId(null); return }
    const v = videos.find((x) => x.id === id)
    if (!v) return
    setEditingId(id)
    setEditTitle(v.title)
    setEditUrl(v.url)
  }

  const saveEdit = async (id: string) => {
    await apiPut(`/me/videos/${id}`, { title: editTitle, url: editUrl })
    setEditingId(null)
    reload()
  }

  const toggleActive = async (v: VideoItem) => {
    await apiPut(`/me/videos/${v.id}`, { is_active: !v.is_active })
    reload()
  }

  const deleteVideo = async (id: string) => {
    if (!confirm('¿Eliminar este video?')) return
    await apiDelete(`/me/videos/${id}`)
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
          <h1 className="text-xl font-black">Videos</h1>
        </header>

        <div className="glass-card p-4 mb-6 text-xs text-slate-400 leading-relaxed">
          Soporta links de <strong className="text-white">YouTube</strong> y{' '}
          <strong className="text-white">Vimeo</strong>. El video se incrustará automáticamente en
          tu perfil público.
        </div>

        {/* Add form */}
        <form onSubmit={addVideo} className="glass-card p-5 mb-6 flex flex-col gap-3">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Agregar video</p>
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Título del video"
            className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-intap-mint/50 transition-colors"
          />
          <input
            type="url"
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            placeholder="https://youtube.com/watch?v=... o https://vimeo.com/..."
            required
            className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-intap-mint/50 transition-colors"
          />
          {newUrl && !getEmbedUrl(newUrl) && (
            <p className="text-xs text-amber-400">URL no reconocida. Usa un link de YouTube o Vimeo.</p>
          )}
          {error && <p className="text-xs text-red-400">{error}</p>}
          {limitError && (
            <p className="text-xs text-amber-400 bg-amber-400/10 rounded-xl px-3 py-2">{limitError}</p>
          )}
          <button
            type="submit"
            disabled={saving}
            className="w-full bg-gradient-to-r from-intap-blue to-purple-600 text-white font-bold py-3 rounded-xl text-sm disabled:opacity-50"
          >
            {saving ? 'Guardando…' : '+ Agregar'}
          </button>
        </form>

        {/* Video list */}
        {videos.length === 0 ? (
          <p className="text-center text-slate-500 text-sm py-8">Sin videos aún.</p>
        ) : (
          <div className="flex flex-col gap-4">
            {videos.map((video) => {
              const embedUrl = getEmbedUrl(video.url)
              return (
                <div key={video.id} className={`glass-card overflow-hidden ${!video.is_active ? 'opacity-50' : ''}`}>
                  {embedUrl && (
                    <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                      <iframe
                        src={embedUrl}
                        title={video.title}
                        className="absolute inset-0 w-full h-full"
                        frameBorder="0"
                        allowFullScreen
                      />
                    </div>
                  )}
                  <div className="p-4 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold truncate">{video.title}</p>
                      <p className="text-xs text-slate-500 truncate">{video.url}</p>
                    </div>
                    <button
                      onClick={() => toggleActive(video)}
                      className={`text-xs px-2 py-1 rounded-full border font-bold transition-colors ${
                        video.is_active
                          ? 'border-intap-mint/30 text-intap-mint bg-intap-mint/10'
                          : 'border-white/10 text-slate-500'
                      }`}
                    >
                      {video.is_active ? 'ON' : 'OFF'}
                    </button>
                    <button
                      onClick={() => toggleEdit(video.id)}
                      className="text-xs text-slate-400 hover:text-white transition-colors"
                    >
                      ✎
                    </button>
                    <button
                      onClick={() => deleteVideo(video.id)}
                      className="text-xs text-slate-500 hover:text-red-400 transition-colors"
                    >
                      🗑
                    </button>
                  </div>
                  {editingId === video.id && (
                    <div className="border-t border-white/10 p-4 flex flex-col gap-3">
                      <input
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none"
                        placeholder="Título"
                      />
                      <input
                        value={editUrl}
                        onChange={(e) => setEditUrl(e.target.value)}
                        className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none"
                        placeholder="URL"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => saveEdit(video.id)}
                          className="flex-1 bg-intap-blue text-white text-xs font-bold py-2 rounded-xl"
                        >
                          Guardar
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="flex-1 bg-white/10 text-slate-300 text-xs font-bold py-2 rounded-xl"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
