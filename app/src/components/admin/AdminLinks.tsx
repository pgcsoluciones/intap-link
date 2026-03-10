import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { apiGet, apiPost, apiPut, apiDelete, apiPatch } from '../../lib/api'

interface LinkItem {
  id: string
  label: string
  url: string
  sort_order: number
  is_active: number
  is_cta: number
}

function SortableLink({
  link,
  onToggleActive,
  onToggleCTA,
  onDelete,
}: {
  link: LinkItem
  onToggleActive: (link: LinkItem) => void
  onToggleCTA: (id: string, current: number) => void
  onDelete: (id: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: link.id })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`glass-card p-4 flex items-center gap-3 ${!link.is_active ? 'opacity-40' : ''} ${
        link.is_cta ? 'border border-intap-blue/40' : ''
      }`}
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="text-slate-500 hover:text-white cursor-grab active:cursor-grabbing touch-none"
        title="Arrastrar"
      >
        ⠿
      </button>

      {/* Link info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-bold truncate">{link.label}</p>
          {link.is_cta === 1 && (
            <span className="text-xs bg-intap-blue/20 text-intap-blue px-1.5 py-0.5 rounded-full font-bold shrink-0">
              CTA
            </span>
          )}
        </div>
        <p className="text-xs text-slate-400 truncate">{link.url}</p>
      </div>

      {/* CTA toggle */}
      <button
        onClick={() => onToggleCTA(link.id, link.is_cta)}
        title={link.is_cta ? 'Quitar CTA principal' : 'Marcar como CTA principal'}
        className={`text-xs transition-colors ${
          link.is_cta ? 'text-intap-blue' : 'text-slate-600 hover:text-intap-blue'
        }`}
      >
        ★
      </button>

      {/* Toggle active */}
      <button
        onClick={() => onToggleActive(link)}
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
        onClick={() => onDelete(link.id)}
        className="text-slate-500 hover:text-red-400 transition-colors text-sm"
        title="Eliminar"
      >
        🗑
      </button>
    </div>
  )
}

export default function AdminLinks() {
  const [links, setLinks] = useState<LinkItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [newUrl, setNewUrl] = useState('')
  const [error, setError] = useState('')
  const [limitError, setLimitError] = useState('')

  const sensors = useSensors(useSensor(PointerSensor))

  const reload = () =>
    apiGet('/me/links').then((json: any) => {
      if (json.ok) setLinks(json.data || [])
    }).finally(() => setLoading(false))

  useEffect(() => { reload() }, [])

  const addLink = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLimitError('')
    setSaving(true)
    const json: any = await apiPost('/me/links', { label: newLabel, url: newUrl })
    if (json.ok) {
      setNewLabel('')
      setNewUrl('')
      reload()
    } else if (json.limit) {
      setLimitError(`Límite del plan alcanzado (${json.limit} links). Actualiza tu plan.`)
    } else {
      setError(json.error || 'Error al guardar')
    }
    setSaving(false)
  }

  const toggleActive = async (link: LinkItem) => {
    await apiPut(`/me/links/${link.id}`, { is_active: !link.is_active })
    reload()
  }

  const toggleCTA = async (id: string, current: number) => {
    await apiPatch(`/me/links/${id}/cta`, { is_cta: !current })
    reload()
  }

  const deleteLink = async (id: string) => {
    if (!confirm('¿Eliminar este link?')) return
    await apiDelete(`/me/links/${id}`)
    reload()
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = links.findIndex((l) => l.id === active.id)
    const newIndex = links.findIndex((l) => l.id === over.id)
    const reordered = arrayMove(links, oldIndex, newIndex)
    setLinks(reordered)
    await apiPut('/me/links/reorder', { orderedIds: reordered.map((l) => l.id) })
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

        {/* Link list with DnD */}
        {links.length === 0 ? (
          <p className="text-center text-slate-500 text-sm py-8">Sin links aún. Agrega el primero.</p>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-xs text-slate-500 text-center">Arrastra ⠿ para reordenar · ★ para marcar CTA principal</p>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={links.map((l) => l.id)} strategy={verticalListSortingStrategy}>
                {links.map((link) => (
                  <SortableLink
                    key={link.id}
                    link={link}
                    onToggleActive={toggleActive}
                    onToggleCTA={toggleCTA}
                    onDelete={deleteLink}
                  />
                ))}
              </SortableContext>
            </DndContext>
          </div>
        )}
      </div>
    </div>
  )
}
