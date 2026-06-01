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
import { apiGet, apiPost, apiPut, apiDelete, apiUpload } from '../../lib/api'

type ItemType = 'product' | 'service' | 'project'

interface Product {
  id: string
  title: string
  description: string | null
  price: string | null
  image_url: string | null
  whatsapp_text: string | null
  is_featured: number
  sort_order: number
  item_type?: ItemType
}

interface ProductForm {
  title: string
  description: string
  price: string
  image_url: string
  whatsapp_text: string
  item_type: ItemType
  is_featured: boolean
}

const EMPTY_FORM: ProductForm = {
  title: '',
  description: '',
  price: '',
  image_url: '',
  whatsapp_text: '',
  item_type: 'product',
  is_featured: false,
}

const ITEM_TYPE_LABELS: Record<ItemType, string> = {
  product: 'Producto',
  service: 'Servicio',
  project: 'Proyecto',
}

function SortableProduct({
  product,
  onToggleEdit,
  onDelete,
  onToggleFeatured,
}: {
  product: Product
  onToggleEdit: (id: string) => void
  onDelete: (id: string) => void
  onToggleFeatured: (id: string, current: number) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: product.id })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const typeLabel = ITEM_TYPE_LABELS[(product.item_type || 'product') as ItemType] || 'Producto'

  return (
    <div ref={setNodeRef} style={style} className="glass-card p-4 flex items-start gap-3">
      <button
        {...attributes}
        {...listeners}
        className="mt-1 text-slate-500 hover:text-white cursor-grab active:cursor-grabbing touch-none"
        title="Arrastrar"
      >
        ⠿
      </button>

      {product.image_url && (
        <img
          src={product.image_url}
          alt={product.title}
          className="w-20 h-20 rounded-2xl object-cover border border-white/10 bg-white/5 shrink-0"
        />
      )}

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-bold truncate">{product.title}</p>
          <span className="text-[10px] bg-white/10 text-slate-300 px-2 py-0.5 rounded-full font-bold uppercase tracking-wide">
            {typeLabel}
          </span>
          {product.is_featured === 1 && (
            <span className="text-xs bg-yellow-500/20 text-yellow-400 px-1.5 py-0.5 rounded-full font-bold shrink-0">
              Destacado
            </span>
          )}
        </div>

        {product.price && (
          <p className="text-xs text-intap-mint font-bold mt-1">{product.price}</p>
        )}

        {product.description && (
          <p className="text-xs text-slate-400 mt-1 line-clamp-2">{product.description}</p>
        )}

        {!product.image_url && (
          <p className="text-[11px] text-amber-300 mt-2 bg-amber-400/10 rounded-lg px-2 py-1 inline-block">
            Sin imagen cargada
          </p>
        )}
      </div>

      <div className="flex gap-2 shrink-0">
        <button
          onClick={() => onToggleFeatured(product.id, product.is_featured)}
          title={product.is_featured ? 'Quitar destacado' : 'Destacar'}
          className="text-xs text-slate-400 hover:text-yellow-400 transition-colors"
        >
          ★
        </button>
        <button
          onClick={() => onToggleEdit(product.id)}
          className="text-xs text-slate-400 hover:text-white transition-colors"
          title="Editar"
        >
          ✎
        </button>
        <button
          onClick={() => onDelete(product.id)}
          className="text-xs text-slate-500 hover:text-red-400 transition-colors"
          title="Eliminar"
        >
          🗑
        </button>
      </div>
    </div>
  )
}

export default function AdminProducts() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingNew, setUploadingNew] = useState(false)
  const [uploadingEdit, setUploadingEdit] = useState(false)
  const [error, setError] = useState('')
  const [uploadSuccess, setUploadSuccess] = useState('')
  const [limitError, setLimitError] = useState('')

  const [form, setForm] = useState<ProductForm>(EMPTY_FORM)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<ProductForm>(EMPTY_FORM)

  const sensors = useSensors(useSensor(PointerSensor))

  const reload = () =>
    apiGet('/me/products').then((json: any) => {
      if (json.ok) setProducts(json.data || [])
    }).finally(() => setLoading(false))

  useEffect(() => { reload() }, [])

  const uploadCatalogImage = async (file: File, target: 'new' | 'edit') => {
    setError('')
    setUploadSuccess('')
    if (target === 'new') setUploadingNew(true)
    if (target === 'edit') setUploadingEdit(true)

    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('type', 'catalog_item')

      const json: any = await apiUpload('/me/assets', fd)

      if (!json.ok) {
        setError(json.error || 'No se pudo subir la imagen.')
        return
      }

      const url = json.data?.url || ''
      if (!url) {
        setError('La imagen subió, pero no recibimos la URL pública.')
        return
      }

      if (target === 'new') {
        setForm((prev) => ({ ...prev, image_url: url }))
        setUploadSuccess('Imagen subida correctamente. Ya puedes guardar el item.')
      } else {
        setEditForm((prev) => ({ ...prev, image_url: url }))
        setUploadSuccess('Imagen actualizada correctamente. Guarda los cambios del item.')
      }
    } finally {
      setUploadingNew(false)
      setUploadingEdit(false)
    }
  }

  const handleCatalogFile = (
    e: React.ChangeEvent<HTMLInputElement>,
    target: 'new' | 'edit'
  ) => {
    const file = e.target.files?.[0]
    if (!file) return
    void uploadCatalogImage(file, target)
    e.currentTarget.value = ''
  }

  const addProduct = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLimitError('')

    if (!form.title.trim()) {
      setError('Escribe el nombre del producto, servicio o proyecto.')
      return
    }

    if (!form.image_url.trim()) {
      setError('Sube una imagen antes de guardar. Usa el botón “Examinar / Subir imagen”.')
      return
    }

    setSaving(true)

    const json: any = await apiPost('/me/products', {
      title: form.title,
      description: form.description,
      price: form.price,
      image_url: form.image_url,
      whatsapp_text: form.whatsapp_text,
      item_type: form.item_type,
      is_featured: form.is_featured,
    })

    if (json.ok) {
      setForm({ ...EMPTY_FORM })
      setUploadSuccess('')
      reload()
    } else if (json.limit) {
      setLimitError(`Límite del plan alcanzado (${json.limit} items). Actualiza tu plan.`)
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

    const p = products.find((x) => x.id === id)
    if (!p) return

    setEditingId(id)
    setEditForm({
      title: p.title,
      description: p.description || '',
      price: p.price || '',
      image_url: p.image_url || '',
      whatsapp_text: p.whatsapp_text || '',
      item_type: (p.item_type || 'product') as ItemType,
      is_featured: p.is_featured === 1,
    })
  }

  const saveEdit = async (id: string) => {
    setError('')
    if (!editForm.image_url.trim()) {
      setError('Este item necesita una imagen antes de guardar los cambios.')
      return
    }

    await apiPut(`/me/products/${id}`, {
      title: editForm.title,
      description: editForm.description,
      price: editForm.price,
      image_url: editForm.image_url,
      whatsapp_text: editForm.whatsapp_text,
      item_type: editForm.item_type,
      is_featured: editForm.is_featured,
    })

    setEditingId(null)
    reload()
  }

  const deleteProduct = async (id: string) => {
    if (!confirm('¿Eliminar este item del catálogo?')) return
    await apiDelete(`/me/products/${id}`)
    reload()
  }

  const toggleFeatured = async (id: string, current: number) => {
    await apiPut(`/me/products/${id}`, { is_featured: !current })
    reload()
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = products.findIndex((p) => p.id === active.id)
    const newIndex = products.findIndex((p) => p.id === over.id)
    const reordered = arrayMove(products, oldIndex, newIndex)

    setProducts(reordered)
    await apiPut('/me/products/reorder', { orderedIds: reordered.map((p) => p.id) })
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
          <div>
            <h1 className="text-xl font-black">Catálogo visual</h1>
            <p className="text-xs text-slate-400 mt-1">
              Agrega productos, servicios o proyectos con imagen, descripción y precio opcional.
            </p>
          </div>
        </header>

        <form onSubmit={addProduct} className="glass-card p-5 mb-6 flex flex-col gap-3">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">
            Agregar item al catálogo
          </p>

          <select
            value={form.item_type}
            onChange={(e) => setForm({ ...form, item_type: e.target.value as ItemType })}
            className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-intap-mint/50 transition-colors"
          >
            <option value="product">Producto</option>
            <option value="service">Servicio</option>
            <option value="project">Proyecto</option>
          </select>
          <p className="text-[11px] text-slate-400 -mt-1">
            Tipo seleccionado: <strong className="text-white">{ITEM_TYPE_LABELS[form.item_type]}</strong>
          </p>

          <input
            type="text"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Nombre *"
            required
            className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-intap-mint/50 transition-colors"
          />

          <input
            type="text"
            value={form.price}
            onChange={(e) => setForm({ ...form, price: e.target.value })}
            placeholder="Precio opcional (ej. RD$1,500 / Desde US$120,000)"
            className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-intap-mint/50 transition-colors"
          />

          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Descripción"
            rows={3}
            className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-intap-mint/50 transition-colors resize-none"
          />

          <div className="bg-white/5 border border-white/10 rounded-xl p-3">
            <p className="text-xs text-slate-400 mb-2">Imagen del catálogo</p>

            {form.image_url && (
              <img
                src={form.image_url}
                alt="Vista previa"
                className="w-full h-36 object-cover rounded-xl mb-3 border border-white/10 bg-white/5"
              />
            )}

            <label className="block w-full text-center bg-white/10 hover:bg-white/15 text-white font-bold py-3 rounded-xl text-sm cursor-pointer transition-colors">
              {uploadingNew ? 'Subiendo imagen…' : 'Examinar / Subir imagen'}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={uploadingNew}
                onChange={(e) => handleCatalogFile(e, 'new')}
              />
            </label>

            <input
              type="url"
              value={form.image_url}
              onChange={(e) => setForm({ ...form, image_url: e.target.value })}
              placeholder="URL manual opcional"
              className="mt-3 w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-intap-mint/50 transition-colors"
            />
            {uploadSuccess && (
              <p className="text-xs text-emerald-300 bg-emerald-400/10 rounded-xl px-3 py-2 mt-3">
                {uploadSuccess}
              </p>
            )}
          </div>

          <input
            type="text"
            value={form.whatsapp_text}
            onChange={(e) => setForm({ ...form, whatsapp_text: e.target.value })}
            placeholder="Texto para WhatsApp opcional"
            className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-intap-mint/50 transition-colors"
          />

          <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={form.is_featured}
              onChange={(e) => setForm({ ...form, is_featured: e.target.checked })}
              className="w-4 h-4 accent-yellow-400"
            />
            Destacar este item
          </label>

          {error && <p className="text-xs text-red-400">{error}</p>}
          {limitError && (
            <p className="text-xs text-amber-400 bg-amber-400/10 rounded-xl px-3 py-2">{limitError}</p>
          )}

          <button
            type="submit"
            disabled={saving || uploadingNew}
            className="w-full bg-gradient-to-r from-intap-blue to-purple-600 text-white font-bold py-3 rounded-xl text-sm disabled:opacity-50"
          >
            {saving ? 'Guardando…' : '+ Agregar'}
          </button>
        </form>

        {products.length === 0 ? (
          <p className="text-center text-slate-500 text-sm py-8">Sin items aún.</p>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-xs text-slate-500 text-center">Arrastra para reordenar</p>

            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={products.map((p) => p.id)} strategy={verticalListSortingStrategy}>
                {products.map((product) => (
                  <div key={product.id}>
                    <SortableProduct
                      product={product}
                      onToggleEdit={toggleEdit}
                      onDelete={deleteProduct}
                      onToggleFeatured={toggleFeatured}
                    />

                    {editingId === product.id && (
                      <div className="bg-white/5 border border-white/10 rounded-xl p-4 mt-1 flex flex-col gap-3">
                        <select
                          value={editForm.item_type}
                          onChange={(e) => setEditForm({ ...editForm, item_type: e.target.value as ItemType })}
                          className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none"
                        >
                          <option value="product">Producto</option>
                          <option value="service">Servicio</option>
                          <option value="project">Proyecto</option>
                        </select>

                        <input
                          value={editForm.title}
                          onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                          className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none"
                          placeholder="Nombre"
                        />

                        <input
                          value={editForm.price}
                          onChange={(e) => setEditForm({ ...editForm, price: e.target.value })}
                          className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none"
                          placeholder="Precio opcional"
                        />

                        <textarea
                          value={editForm.description}
                          onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                          rows={3}
                          className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none resize-none"
                          placeholder="Descripción"
                        />

                        <div className="bg-white/5 border border-white/10 rounded-xl p-3">
                          <p className="text-xs text-slate-400 mb-2">Imagen del catálogo</p>

                          {editForm.image_url && (
                            <img
                              src={editForm.image_url}
                              alt="Vista previa"
                              className="w-full h-36 object-cover rounded-xl mb-3 border border-white/10 bg-white/5"
                            />
                          )}

                          <label className="block w-full text-center bg-white/10 hover:bg-white/15 text-white font-bold py-2.5 rounded-xl text-xs cursor-pointer transition-colors">
                            {uploadingEdit ? 'Subiendo imagen…' : 'Examinar / Cambiar imagen'}
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              disabled={uploadingEdit}
                              onChange={(e) => handleCatalogFile(e, 'edit')}
                            />
                          </label>

                          <input
                            value={editForm.image_url}
                            onChange={(e) => setEditForm({ ...editForm, image_url: e.target.value })}
                            className="mt-3 w-full bg-black/20 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none"
                            placeholder="URL manual opcional"
                          />
                          {uploadSuccess && (
                            <p className="text-xs text-emerald-300 bg-emerald-400/10 rounded-xl px-3 py-2 mt-3">
                              {uploadSuccess}
                            </p>
                          )}
                        </div>

                        <input
                          value={editForm.whatsapp_text}
                          onChange={(e) => setEditForm({ ...editForm, whatsapp_text: e.target.value })}
                          className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none"
                          placeholder="Texto WhatsApp opcional"
                        />

                        <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={editForm.is_featured}
                            onChange={(e) => setEditForm({ ...editForm, is_featured: e.target.checked })}
                            className="w-4 h-4 accent-yellow-400"
                          />
                          Destacar este item
                        </label>

                        <div className="flex gap-2">
                          <button
                            onClick={() => saveEdit(product.id)}
                            disabled={uploadingEdit}
                            className="flex-1 bg-intap-blue text-white text-xs font-bold py-2 rounded-xl disabled:opacity-50"
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
