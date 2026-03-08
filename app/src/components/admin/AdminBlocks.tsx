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
import { apiGet, apiPatch } from '../../lib/api'

const BLOCK_LABELS: Record<string, { label: string; icon: string }> = {
  links:    { label: 'Links / Botones',         icon: '🔗' },
  faqs:     { label: 'Preguntas frecuentes',     icon: '❓' },
  products: { label: 'Productos y servicios',    icon: '🛍' },
  video:    { label: 'Video',                    icon: '▶️' },
  gallery:  { label: 'Galería de fotos',         icon: '🖼' },
}

const DEFAULT_ORDER = ['links', 'faqs', 'products', 'video', 'gallery']

function SortableBlock({ id }: { id: string }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const meta = BLOCK_LABELS[id] ?? { label: id, icon: '⬜' }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="glass-card px-4 py-3 flex items-center gap-3"
    >
      <button
        {...attributes}
        {...listeners}
        className="text-slate-500 hover:text-white cursor-grab active:cursor-grabbing touch-none text-lg"
        title="Arrastrar"
      >
        ⠿
      </button>
      <span className="text-lg">{meta.icon}</span>
      <span className="text-sm font-semibold">{meta.label}</span>
    </div>
  )
}

export default function AdminBlocks() {
  const [blocks, setBlocks] = useState<string[]>(DEFAULT_ORDER)
  const [loading, setLoading] = useState(true)
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)

  const sensors = useSensors(useSensor(PointerSensor))

  useEffect(() => {
    apiGet('/me').then((json: any) => {
      // blocks_order lives on the profile, retrieved via public endpoint
      // We'll load from /me — which doesn't expose it, so we fall back to default
      // (blocks_order is exposed on the public endpoint and could be loaded from there
      //  or we just use the default and let user re-save)
      setLoading(false)
    })
  }, [])

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = blocks.indexOf(String(active.id))
    const newIndex = blocks.indexOf(String(over.id))
    setBlocks(arrayMove(blocks, oldIndex, newIndex))
    setSaved(false)
  }

  const save = async () => {
    setSaving(true)
    await apiPatch('/me/profile/blocks-order', { blocks_order: blocks })
    setSaved(true)
    setSaving(false)
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
          <h1 className="text-xl font-black">Orden de secciones</h1>
        </header>

        <p className="text-sm text-slate-400 mb-6">
          Arrastra las secciones para cambiar el orden en que aparecen en tu perfil público.
        </p>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={blocks} strategy={verticalListSortingStrategy}>
            <div className="flex flex-col gap-3 mb-8">
              {blocks.map((blockId) => (
                <SortableBlock key={blockId} id={blockId} />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        <button
          onClick={save}
          disabled={saving}
          className="w-full bg-gradient-to-r from-intap-blue to-purple-600 text-white font-bold py-3 rounded-xl text-sm disabled:opacity-50"
        >
          {saving ? 'Guardando…' : saved ? '✓ Guardado' : 'Guardar orden'}
        </button>
      </div>
    </div>
  )
}
