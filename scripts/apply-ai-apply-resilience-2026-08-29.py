from pathlib import Path

p = Path('app/src/components/admin/free/FreeAiProfileAssistant.tsx')
s = p.read_text()
old = """      const json:any = await apiPost('/me/ai-profile-assistant/apply',{ proposal,apply:selection,replace_existing_services:replaceServices,editing_scope:editingScope })
      if (!json?.ok) { setError(json?.error || 'No pudimos aplicar los cambios. Tu perfil anterior se mantiene.'); return }
      setSuccess('Cambios aplicados correctamente')
      await Promise.all([loadContext(), loadRemainingProfileItems()])
"""
new = """      const payload = { proposal,apply:selection,replace_existing_services:replaceServices,editing_scope:editingScope }
      let json:any
      try {
        json = await apiPost('/me/ai-profile-assistant/apply', payload)
      } catch {
        await new Promise((resolve)=>window.setTimeout(resolve,350))
        json = await apiPost('/me/ai-profile-assistant/apply', payload)
      }
      if (!json?.ok && json?.code === 'db_write_failed') {
        await new Promise((resolve)=>window.setTimeout(resolve,350))
        json = await apiPost('/me/ai-profile-assistant/apply', payload)
      }
      if (!json?.ok) { setError(json?.error || 'No pudimos aplicar los cambios. Tu perfil anterior se mantiene.'); return }
      setSuccess(json.data?.no_changes ? 'Tu perfil ya estaba actualizado; no había cambios nuevos que aplicar.' : 'Cambios aplicados correctamente')
      await Promise.all([loadContext(), loadRemainingProfileItems()])
"""
if old not in s:
    raise SystemExit('No encontré el bloque applyProposal esperado')
s = s.replace(old, new, 1)
p.write_text(s)
print('✓ retry idempotente de apply ante red/D1 + mensaje no-op')
