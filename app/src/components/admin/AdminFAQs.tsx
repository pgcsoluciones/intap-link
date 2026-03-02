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
import { apiGet, apiPost, apiPut, apiDelete } from '../../lib/api'

interface FAQ {
  id: string
  question: string
  answer: string
  sort_order: number
}

function SortableFAQ({
  faq,
  onToggleEdit,
  onDelete,
}: {
  faq: FAQ
  onToggleEdit: (id: string) => void
  onDelete: (id: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: faq.id })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="glass-card p-4 flex items-start gap-3"
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="mt-1 text-slate-500 hover:text-white cursor-grab active:cursor-grabbing touch-none"
        title="Arrastrar"
      >
        ⠿
      </button>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold truncate">{faq.question}</p>
        <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">{faq.answer}</p>
      </div>

      <div className="flex gap-2 shrink-0">
        <button
          onClick={() => onToggleEdit(faq.id)}
          className="text-xs text-slate-400 hover:text-white transition-colors"
          title="Editar"
        >
          ✎
        </button>
        <button
          onClick={() => onDelete(faq.id)}
          className="text-xs text-slate-500 hover:text-red-400 transition-colors"
          title="Eliminar"
        >
          🗑
        </button>
      </div>
    </div>
  )
}

export default function AdminFAQs() {
  const [faqs, setFaqs] = useState<FAQ[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [limitError, setLimitError] = useState('')

  const [newQuestion, setNewQuestion] = useState('')
  const [newAnswer, setNewAnswer] = useState('')

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editQ, setEditQ] = useState('')
  const [editA, setEditA] = useState('')

  const sensors = useSensors(useSensor(PointerSensor))

  const reload = () =>
    apiGet('/me/faqs').then((json: any) => {
      if (json.ok) setFaqs(json.data || [])
    }).finally(() => setLoading(false))

  useEffect(() => { reload() }, [])

  const addFAQ = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLimitError('')
    setSaving(true)
    const json: any = await apiPost('/me/faqs', { question: newQuestion, answer: newAnswer })
    if (json.ok) {
      setNewQuestion('')
      setNewAnswer('')
      reload()
    } else if (json.limit) {
      setLimitError(`Límite del plan alcanzado (${json.limit} FAQs). Actualiza tu plan.`)
    } else {
      setError(json.error || 'Error al guardar')
    }
    setSaving(false)
  }

  const toggleEdit = (id: string) => {
    if (editingId === id) {
      setEditingId(null)
      return
    }
    const faq = faqs.find((f) => f.id === id)
    if (!faq) return
    setEditingId(id)
    setEditQ(faq.question)
    setEditA(faq.answer)
  }

  const saveEdit = async (id: string) => {
    await apiPut(`/me/faqs/${id}`, { question: editQ, answer: editA })
    setEditingId(null)
    reload()
  }

  const deleteFAQ = async (id: string) => {
    if (!confirm('¿Eliminar esta FAQ?')) return
    await apiDelete(`/me/faqs/${id}`)
    reload()
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = faqs.findIndex((f) => f.id === active.id)
    const newIndex = faqs.findIndex((f) => f.id === over.id)
    const reordered = arrayMove(faqs, oldIndex, newIndex)
    setFaqs(reordered)
    await apiPut('/me/faqs/reorder', { orderedIds: reordered.map((f) => f.id) })
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
          <h1 className="text-xl font-black">Preguntas frecuentes</h1>
        </header>

        {/* Add new FAQ */}
        <form onSubmit={addFAQ} className="glass-card p-5 mb-6 flex flex-col gap-3">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Agregar FAQ</p>
          <input
            type="text"
            value={newQuestion}
            onChange={(e) => setNewQuestion(e.target.value)}
            placeholder="Pregunta"
            required
            className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-intap-mint/50 transition-colors"
          />
          <textarea
            value={newAnswer}
            onChange={(e) => setNewAnswer(e.target.value)}
            placeholder="Respuesta"
            required
            rows={3}
            className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-intap-mint/50 transition-colors resize-none"
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

        {/* FAQ list with DnD */}
        {faqs.length === 0 ? (
          <p className="text-center text-slate-500 text-sm py-8">Sin FAQs aún. Agrega la primera.</p>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-xs text-slate-500 text-center">Arrastra para reordenar</p>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={faqs.map((f) => f.id)} strategy={verticalListSortingStrategy}>
                {faqs.map((faq) => (
                  <div key={faq.id}>
                    <SortableFAQ faq={faq} onToggleEdit={toggleEdit} onDelete={deleteFAQ} />
                    {editingId === faq.id && (
                      <div className="bg-white/5 border border-white/10 rounded-xl p-4 mt-1 flex flex-col gap-3">
                        <input
                          value={editQ}
                          onChange={(e) => setEditQ(e.target.value)}
                          className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none"
                          placeholder="Pregunta"
                        />
                        <textarea
                          value={editA}
                          onChange={(e) => setEditA(e.target.value)}
                          rows={3}
                          className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none resize-none"
                          placeholder="Respuesta"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => saveEdit(faq.id)}
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
                ))}
              </SortableContext>
            </DndContext>
          </div>
        )}
      </div>
    </div>
  )
}
