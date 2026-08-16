from pathlib import Path

path = Path('app/src/components/admin/SuperAdminArtifacts.tsx')
source = path.read_text()

sentinel = "const [batchCount, setBatchCount] = useState(10)"
if sentinel in source:
    print('Batch UI already applied; nothing to do.')
    raise SystemExit(0)

source = source.replace(
"  const [rotateExpiresAt, setRotateExpiresAt] = useState('')\n",
"  const [rotateExpiresAt, setRotateExpiresAt] = useState('')\n  const [batchCount, setBatchCount] = useState(10)\n  const [batchRunning, setBatchRunning] = useState(false)\n  const [batchResults, setBatchResults] = useState<CreatedArtifact[]>([])\n"
)

insert_after = """  async function createArtifact() {\n    if (saving) return\n    setSaving(true)\n    setError('')\n    setMessage('')\n    setCreated(null)\n\n    try {\n      const json: any = await apiPost('/admin/artifacts', {\n        product_type: productType,\n        expires_at: expiresAt || null,\n      })\n\n      if (!json?.ok || !json?.data) throw new Error(json?.error || 'No se pudo crear el producto.')\n      setCreated(json.data as CreatedArtifact)\n      setMessage('Producto creado. Guarda el código secreto antes de salir de esta pantalla.')\n      await loadInventory()\n    } catch (err) {\n      setError(err instanceof Error ? err.message : 'No se pudo crear el producto.')\n    } finally {\n      setSaving(false)\n    }\n  }\n"""

batch_functions = r'''

  async function createBatch() {
    if (batchRunning || saving) return
    const quantity = Math.max(2, Math.min(100, Math.floor(Number(batchCount) || 0)))
    if (quantity < 2 || quantity > 100) {
      setError('El lote debe tener entre 2 y 100 productos.')
      return
    }
    if (!window.confirm(`Se generarán ${quantity} productos ${productLabel(productType)} con códigos secretos únicos. Los secretos solo podrán verse en este resultado. ¿Continuar?`)) return

    setBatchRunning(true)
    setError('')
    setMessage('')
    setCreated(null)
    setBatchResults([])

    const generated: CreatedArtifact[] = []
    try {
      for (let index = 0; index < quantity; index += 1) {
        const json: any = await apiPost('/admin/artifacts', {
          product_type: productType,
          expires_at: expiresAt || null,
        })
        if (!json?.ok || !json?.data) {
          throw new Error(json?.error || `No se pudo generar el producto ${index + 1} de ${quantity}.`)
        }
        generated.push(json.data as CreatedArtifact)
        setBatchResults([...generated])
      }
      setMessage(`Lote completado: ${generated.length} productos generados. Descarga el CSV antes de salir de la pantalla.`)
      await loadInventory()
    } catch (err) {
      setBatchResults([...generated])
      setError(`${err instanceof Error ? err.message : 'No se pudo completar el lote.'}${generated.length ? ` Se conservaron ${generated.length} productos ya generados; descarga sus códigos ahora.` : ''}`)
      await loadInventory()
    } finally {
      setBatchRunning(false)
    }
  }

  function downloadBatchCsv() {
    if (!batchResults.length) return
    const escapeCsv = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`
    const rows = [
      ['tipo_producto', 'codigo_publico', 'codigo_activacion', 'url_publica', 'estado', 'vencimiento'],
      ...batchResults.map(item => [
        productLabel(item.product_type),
        item.public_code,
        item.activation_code,
        item.public_url,
        STATUS_LABELS[item.status],
        expiresAt || '',
      ]),
    ]
    const csv = '\ufeff' + rows.map(row => row.map(escapeCsv).join(',')).join('\r\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `intap-codigos-${productType}-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)
  }
'''

if insert_after not in source:
    raise SystemExit('createArtifact marker not found')
source = source.replace(insert_after, insert_after + batch_functions)

single_button = """            <button type=\"button\" disabled={saving} onClick={() => void createArtifact()} className=\"mt-5 w-full rounded-2xl bg-slate-950 px-4 py-3.5 text-sm font-black text-white disabled:opacity-50\">\n              {saving ? 'Procesando…' : 'Generar producto y código'}\n            </button>\n"""

batch_controls = r'''
            <div className="mt-5 border-t border-slate-100 pt-5">
              <div className="flex items-end gap-3">
                <label className="flex-1 text-xs font-black text-slate-600">
                  Cantidad para lote
                  <input
                    type="number"
                    min={2}
                    max={100}
                    value={batchCount}
                    onChange={event => setBatchCount(Math.max(2, Math.min(100, Number(event.target.value) || 2)))}
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-violet-400"
                  />
                </label>
                <button
                  type="button"
                  disabled={saving || batchRunning}
                  onClick={() => void createBatch()}
                  className="rounded-2xl bg-violet-600 px-5 py-3 text-sm font-black text-white disabled:opacity-50"
                >
                  {batchRunning ? `Generando ${batchResults.length}/${batchCount}…` : 'Generar lote'}
                </button>
              </div>
              <p className="mt-2 text-xs leading-5 text-slate-400">Máximo 100 por lote. Cada producto recibe su propio código público, URL permanente y código secreto de activación.</p>
            </div>
'''
if single_button not in source:
    raise SystemExit('single create button marker not found')
source = source.replace(single_button, single_button + batch_controls)

created_section_end = """        {created && (\n          <section className=\"rounded-3xl border-2 border-violet-200 bg-violet-50 p-5 shadow-sm\">\n"""
if created_section_end not in source:
    raise SystemExit('created section marker not found')

inventory_marker = """        <section className=\"rounded-3xl bg-white p-6 shadow-sm md:p-8\">\n          <div className=\"flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between\">\n            <div><p className=\"text-xs font-black uppercase tracking-[0.2em] text-slate-400\">Inventario</p><h2 className=\"mt-1 text-2xl font-black\">Productos generados</h2></div>\n"""

batch_results_ui = r'''
        {batchResults.length > 0 && (
          <section className="rounded-3xl border-2 border-violet-200 bg-violet-50 p-5 shadow-sm">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-600">Lote generado</p>
                <h2 className="mt-1 text-2xl font-black">{batchResults.length} códigos listos</h2>
                <p className="mt-1 text-xs text-violet-900/70">Los códigos secretos de este lote no podrán recuperarse después. Descarga el archivo ahora.</p>
              </div>
              <button type="button" onClick={downloadBatchCsv} className="rounded-xl bg-violet-600 px-4 py-3 text-sm font-black text-white">Descargar CSV</button>
            </div>
            <div className="mt-5 max-h-[360px] overflow-auto rounded-2xl bg-white">
              <table className="w-full min-w-[760px] text-left text-xs">
                <thead className="sticky top-0 bg-slate-50 text-[10px] uppercase tracking-wide text-slate-400"><tr><th className="p-3">#</th><th className="p-3">Código público</th><th className="p-3">Código activación · secreto</th><th className="p-3">URL permanente</th></tr></thead>
                <tbody>{batchResults.map((item, index) => <tr key={item.id} className="border-t border-slate-100"><td className="p-3 font-bold">{index + 1}</td><td className="p-3 font-mono font-black">{item.public_code}</td><td className="p-3 font-mono font-black text-violet-700">{item.activation_code}</td><td className="p-3 font-mono text-[11px]">{item.public_url}</td></tr>)}</tbody>
              </table>
            </div>
          </section>
        )}

'''
if inventory_marker not in source:
    raise SystemExit('inventory marker not found')
source = source.replace(inventory_marker, batch_results_ui + inventory_marker)

old_activation = r'''            <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
              <p className="text-sm font-black text-amber-950">Código de activación</p>
              <p className="mt-1 text-xs leading-5 text-amber-900/70">El secreto original no se almacena y no puede mostrarse otra vez. Si todavía no fue utilizado, puedes revocarlo y emitir uno nuevo.</p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row"><input type="datetime-local" value={rotateExpiresAt} onChange={event => setRotateExpiresAt(event.target.value)} className="flex-1 rounded-xl border border-amber-200 bg-white px-3 py-3 text-sm" /><button disabled={saving || !['available', 'unassigned'].includes(selected.status)} onClick={() => void rotateActivationCode()} className="rounded-xl bg-amber-600 px-4 py-3 text-sm font-black text-white disabled:opacity-40">Emitir nuevo código</button></div>
              {rotatedCode && <div className="mt-4 rounded-xl bg-white p-4"><p className="text-[10px] font-black uppercase text-amber-700">Nuevo secreto · guardar ahora</p><div className="mt-2 flex items-center justify-between gap-3"><code className="break-all text-lg font-black">{rotatedCode}</code><button onClick={() => void copyValue('rotated', rotatedCode)} className="rounded-lg bg-slate-950 px-3 py-2 text-xs font-black text-white">{copied === 'rotated' ? 'Copiado' : 'Copiar'}</button></div></div>}
            </div>
'''

new_activation = r'''            <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
              <p className="text-sm font-black text-amber-950">Código de activación</p>
              {['available', 'unassigned'].includes(selected.status) && !selected.owner_user_id ? (
                <>
                  <p className="mt-1 text-xs leading-5 text-amber-900/70">El secreto original no se almacena y no puede mostrarse otra vez. Mientras el producto no haya sido reclamado, puedes revocar el código activo y emitir uno nuevo.</p>
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row"><input type="datetime-local" value={rotateExpiresAt} onChange={event => setRotateExpiresAt(event.target.value)} className="flex-1 rounded-xl border border-amber-200 bg-white px-3 py-3 text-sm" /><button disabled={saving} onClick={() => void rotateActivationCode()} className="rounded-xl bg-amber-600 px-4 py-3 text-sm font-black text-white disabled:opacity-40">Emitir nuevo código</button></div>
                </>
              ) : (
                <div className="mt-3 rounded-xl bg-white px-4 py-3">
                  <p className="text-sm font-black text-slate-900">Código {CODE_LABELS[selected.activation_code_status || 'none'].toLowerCase()}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">Este producto ya fue reclamado. No se emite otro código de activación sobre el mismo producto porque el código es de un solo uso. Para cambiar el perfil utiliza Destino dinámico; para un producto nuevo genera un nuevo código/producto.</p>
                </div>
              )}
              {rotatedCode && <div className="mt-4 rounded-xl bg-white p-4"><p className="text-[10px] font-black uppercase text-amber-700">Nuevo secreto · guardar ahora</p><div className="mt-2 flex items-center justify-between gap-3"><code className="break-all text-lg font-black">{rotatedCode}</code><button onClick={() => void copyValue('rotated', rotatedCode)} className="rounded-lg bg-slate-950 px-3 py-2 text-xs font-black text-white">{copied === 'rotated' ? 'Copiado' : 'Copiar'}</button></div></div>}
            </div>
'''

if old_activation not in source:
    raise SystemExit('activation management block marker not found')
source = source.replace(old_activation, new_activation)

path.write_text(source)
print('Applied batch generation UI and clarified activation-code reissue rules.')
