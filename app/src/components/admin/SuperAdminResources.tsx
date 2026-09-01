import { useEffect, useState } from 'react'
import { apiDelete, apiGet, apiPost, apiPut } from '../../lib/api'
import SuperAdminLayout from './SuperAdminLayout'

type ResourceItem = {
  id: string
  title: string
  description?: string | null
  url: string
  category?: string | null
  is_active: number
  sort_order: number
}

const emptyForm = {
  title: '',
  description: '',
  url: '',
  category: 'general',
  sort_order: 0,
  is_active: true,
}

export default function SuperAdminResources() {
  const [items, setItems] = useState<ResourceItem[]>([])
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    setError('')
    try {
      const json: any = await apiGet('/superadmin/account-resources')
      if (!json?.ok) throw new Error(json?.error || 'No se pudieron cargar los recursos.')
      setItems(Array.isArray(json.data?.items) ? json.data.items : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los recursos.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  function startEdit(item: ResourceItem) {
    setEditingId(item.id)
    setForm({
      title: item.title || '',
      description: item.description || '',
      url: item.url || '',
      category: item.category || 'general',
      sort_order: Number(item.sort_order || 0),
      is_active: Number(item.is_active) === 1,
    })
    setError('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function reset() {
    setEditingId('')
    setForm(emptyForm)
    setError('')
  }

  async function save(event: React.FormEvent) {
    event.preventDefault()
    if (saving) return
    if (!form.title.trim() || !/^https?:\/\//i.test(form.url.trim())) {
      setError('Completa un título y una URL que empiece con http:// o https://.')
      return
    }

    setSaving(true)
    setError('')
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description.trim(),
        url: form.url.trim(),
        category: form.category.trim() || 'general',
        sort_order: Number(form.sort_order || 0),
        is_active: form.is_active,
      }
      const json: any = editingId
        ? await apiPut(`/superadmin/account-resources/${editingId}`, payload)
        : await apiPost('/superadmin/account-resources', payload)
      if (!json?.ok) throw new Error(json?.error || 'No se pudo guardar el recurso.')
      reset()
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el recurso.')
    } finally {
      setSaving(false)
    }
  }

  async function remove(item: ResourceItem) {
    if (!window.confirm(`¿Eliminar el recurso “${item.title}”?`)) return
    setSaving(true)
    try {
      const json: any = await apiDelete(`/superadmin/account-resources/${item.id}`)
      if (!json?.ok) throw new Error(json?.error || 'No se pudo eliminar el recurso.')
      if (editingId === item.id) reset()
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar el recurso.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <SuperAdminLayout currentSection="resources">
      <section style={{ display: 'grid', gap: 18, maxWidth: 980 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: 1, textTransform: 'uppercase', color: '#0891b2' }}>Mi cuenta</div>
          <h1 style={{ margin: '6px 0 0', fontSize: 28, fontWeight: 900 }}>Recursos para usuarios</h1>
          <p style={{ margin: '7px 0 0', color: '#64748b', maxWidth: 720 }}>Publica guías, tutoriales, plantillas o enlaces útiles. Solo los recursos activos aparecen en el apartado Mi cuenta.</p>
        </div>

        {error && <div role="alert" style={{ padding: 14, borderRadius: 14, background: '#fff1f2', border: '1px solid #fecdd3', color: '#be123c', fontWeight: 800 }}>{error}</div>}

        <form onSubmit={save} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 20, padding: 20, display: 'grid', gap: 14 }}>
          <div style={{ fontWeight: 900, fontSize: 17 }}>{editingId ? 'Editar recurso' : 'Agregar recurso'}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 12 }}>
            <label style={{ fontSize: 12, fontWeight: 900, color: '#334155' }}>Título
              <input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value.slice(0, 120) }))} maxLength={120} style={{ marginTop: 7, width: '100%', boxSizing: 'border-box', border: '1px solid #cbd5e1', borderRadius: 12, padding: 11, font: 'inherit' }} />
            </label>
            <label style={{ fontSize: 12, fontWeight: 900, color: '#334155' }}>Categoría
              <input value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value.slice(0, 60) }))} maxLength={60} placeholder="general" style={{ marginTop: 7, width: '100%', boxSizing: 'border-box', border: '1px solid #cbd5e1', borderRadius: 12, padding: 11, font: 'inherit' }} />
            </label>
          </div>
          <label style={{ fontSize: 12, fontWeight: 900, color: '#334155' }}>Descripción
            <textarea value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value.slice(0, 600) }))} maxLength={600} rows={3} style={{ marginTop: 7, width: '100%', boxSizing: 'border-box', border: '1px solid #cbd5e1', borderRadius: 12, padding: 11, resize: 'vertical', font: 'inherit' }} />
          </label>
          <label style={{ fontSize: 12, fontWeight: 900, color: '#334155' }}>URL
            <input value={form.url} onChange={(event) => setForm((current) => ({ ...current, url: event.target.value.slice(0, 1200) }))} placeholder="https://..." style={{ marginTop: 7, width: '100%', boxSizing: 'border-box', border: '1px solid #cbd5e1', borderRadius: 12, padding: 11, font: 'inherit' }} />
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
            <label style={{ fontSize: 12, fontWeight: 900, color: '#334155' }}>Orden
              <input type="number" value={form.sort_order} onChange={(event) => setForm((current) => ({ ...current, sort_order: Number(event.target.value || 0) }))} style={{ marginLeft: 8, width: 80, border: '1px solid #cbd5e1', borderRadius: 10, padding: 9 }} />
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 900, color: '#334155' }}>
              <input type="checkbox" checked={form.is_active} onChange={(event) => setForm((current) => ({ ...current, is_active: event.target.checked }))} /> Visible para usuarios
            </label>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            {editingId && <button type="button" onClick={reset} style={{ border: 0, borderRadius: 11, padding: '10px 14px', background: '#f1f5f9', color: '#475569', fontWeight: 900, cursor: 'pointer' }}>Cancelar</button>}
            <button type="submit" disabled={saving} style={{ border: 0, borderRadius: 11, padding: '10px 16px', background: '#0f172a', color: '#fff', fontWeight: 900, cursor: 'pointer', opacity: saving ? .55 : 1 }}>{saving ? 'Guardando…' : editingId ? 'Guardar cambios' : 'Agregar recurso'}</button>
          </div>
        </form>

        <div style={{ display: 'grid', gap: 12 }}>
          {loading ? <div style={{ padding: 24, color: '#64748b' }}>Cargando recursos…</div> : items.length === 0 ? <div style={{ padding: 24, borderRadius: 18, background: '#fff', border: '1px solid #e2e8f0', color: '#64748b' }}>Todavía no hay recursos publicados.</div> : items.map((item) => (
            <article key={item.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 18, padding: 18, display: 'flex', justifyContent: 'space-between', gap: 18, alignItems: 'start' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <strong style={{ fontSize: 16 }}>{item.title}</strong>
                  <span style={{ borderRadius: 999, padding: '4px 8px', background: Number(item.is_active) === 1 ? '#ecfdf5' : '#f1f5f9', color: Number(item.is_active) === 1 ? '#047857' : '#64748b', fontSize: 10, fontWeight: 900 }}>{Number(item.is_active) === 1 ? 'Activo' : 'Oculto'}</span>
                  <span style={{ fontSize: 11, color: '#94a3b8' }}>Orden {item.sort_order}</span>
                </div>
                {item.description && <p style={{ margin: '7px 0 0', color: '#64748b', lineHeight: 1.5 }}>{item.description}</p>}
                <a href={item.url} target="_blank" rel="noreferrer" style={{ display: 'inline-block', marginTop: 8, color: '#0891b2', fontSize: 12, fontWeight: 800, wordBreak: 'break-all' }}>{item.url}</a>
              </div>
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                <button type="button" onClick={() => startEdit(item)} style={{ border: 0, borderRadius: 10, padding: '9px 11px', background: '#ecfeff', color: '#0e7490', fontWeight: 900, cursor: 'pointer' }}>Editar</button>
                <button type="button" disabled={saving} onClick={() => void remove(item)} style={{ border: 0, borderRadius: 10, padding: '9px 11px', background: '#fff1f2', color: '#be123c', fontWeight: 900, cursor: 'pointer' }}>Eliminar</button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </SuperAdminLayout>
  )
}
