from pathlib import Path


def replace_once(path: str, old: str, new: str, label: str) -> None:
    p = Path(path)
    s = p.read_text()
    if old not in s:
        raise SystemExit(f'No encontré patrón para {label}: {path}')
    p.write_text(s.replace(old, new, 1))
    print(f'✓ {label}')

# Dashboard tour: persistent auto-disable survives tour version changes.
p = 'app/src/components/admin/free/FreeGuidedTour.tsx'
replace_once(
    p,
    "function storageKey(storageId: string) {\n  return `kawvo:${TOUR_VERSION}:${storageId || 'anonymous'}`\n}\n",
    "function storageKey(storageId: string) {\n  return `kawvo:${TOUR_VERSION}:${storageId || 'anonymous'}`\n}\n\nfunction autoDisableKey(storageId: string) {\n  return `kawvo:tour-auto-disabled:dashboard:${storageId || 'anonymous'}`\n}\n",
    'clave persistente de auto-recorrido Dashboard',
)
replace_once(
    p,
    "  const key = useMemo(() => storageKey(storageId), [storageId])\n",
    "  const key = useMemo(() => storageKey(storageId), [storageId])\n  const autoKey = useMemo(() => autoDisableKey(storageId), [storageId])\n",
    'autoKey Dashboard',
)
replace_once(
    p,
    "      const state = readState(key)\n      if (state.completed || Number(state.snoozeUntil || 0) > Date.now()) return\n",
    "      const state = readState(key)\n      if (localStorage.getItem(autoKey) === '1' || state.completed || Number(state.snoozeUntil || 0) > Date.now()) return\n",
    'bloqueo automático Dashboard',
)
replace_once(
    p,
    "  }, [findAvailableIndex, key, positionCurrent])\n",
    "  }, [autoKey, findAvailableIndex, key, positionCurrent])\n",
    'dependencia autoKey Dashboard',
)
replace_once(
    p,
    "  const complete = () => {\n    writeState(key, { completed: true })\n    setOpen(false)\n  }\n",
    "  const disableAuto = () => {\n    try { localStorage.setItem(autoKey, '1') } catch {}\n    writeState(key, { completed: true })\n    setOpen(false)\n  }\n\n  const complete = () => {\n    try { localStorage.setItem(autoKey, '1') } catch {}\n    writeState(key, { completed: true })\n    setOpen(false)\n  }\n",
    'finalización persistente Dashboard',
)
replace_once(
    p,
    '<button type="button" onClick={later} className="rounded-xl px-2 py-2 text-xs font-black text-slate-500">Ver más tarde</button>',
    '<button type="button" onClick={disableAuto} className="rounded-xl px-2 py-2 text-xs font-black text-slate-500">Ya entendí · no mostrar solo</button>',
    'botón no volver a mostrar Dashboard',
)

# Account tour: same persistent behavior, manual replay still bypasses it.
p = 'app/src/components/admin/free/FreeAccountGuidedTour.tsx'
replace_once(
    p,
    "  const key=useMemo(()=>keyOf(storageId),[storageId])\n",
    "  const key=useMemo(()=>keyOf(storageId),[storageId])\n  const autoKey=useMemo(()=>`kawvo:tour-auto-disabled:account:${storageId||'anonymous'}`,[storageId])\n",
    'autoKey Mi cuenta',
)
replace_once(
    p,
    "  const start=useCallback((force=false)=>{if(!force){const s=read(key);if(s.completed||Number(s.snoozeUntil||0)>Date.now())return}const first=find(0);if(first<0)return;setIndex(first);setOpen(true);window.setTimeout(()=>position(first),40)},[find,key,position])\n",
    "  const start=useCallback((force=false)=>{if(!force){const s=read(key);if(localStorage.getItem(autoKey)==='1'||s.completed||Number(s.snoozeUntil||0)>Date.now())return}const first=find(0);if(first<0)return;setIndex(first);setOpen(true);window.setTimeout(()=>position(first),40)},[autoKey,find,key,position])\n",
    'bloqueo automático Mi cuenta',
)
replace_once(
    p,
    "  const complete=()=>{write(key,{completed:true});setOpen(false)}\n",
    "  const disableAuto=()=>{try{localStorage.setItem(autoKey,'1')}catch{};write(key,{completed:true});setOpen(false)}\n  const complete=()=>{try{localStorage.setItem(autoKey,'1')}catch{};write(key,{completed:true});setOpen(false)}\n",
    'finalización persistente Mi cuenta',
)
replace_once(
    p,
    '<button type="button" onClick={later} className="rounded-xl px-2 py-2 text-xs font-black text-slate-500">Ver más tarde</button>',
    '<button type="button" onClick={disableAuto} className="rounded-xl px-2 py-2 text-xs font-black text-slate-500">Ya entendí · no mostrar solo</button>',
    'botón no volver a mostrar Mi cuenta',
)

# Team tour: one persistent auto-disable for first/standard modes; manual Recorrido remains available.
p = 'app/src/components/admin/free/FreeTeamGuidedTour.tsx'
replace_once(
    p,
    "  const key=useMemo(()=>`kawvo:team-tour-${firstTeam?'first':'standard'}-v2:${storageId||'anonymous'}`,[firstTeam,storageId])\n",
    "  const key=useMemo(()=>`kawvo:team-tour-${firstTeam?'first':'standard'}-v2:${storageId||'anonymous'}`,[firstTeam,storageId])\n  const autoKey=useMemo(()=>`kawvo:tour-auto-disabled:team:${storageId||'anonymous'}`,[storageId])\n",
    'autoKey Team',
)
replace_once(
    p,
    "  const start=useCallback((force=false)=>{if(!force){const s=read(key);if(s.completed||Number(s.snoozeUntil||0)>Date.now())return}const first=find(0);if(first<0)return;setIndex(first);setOpen(true);window.setTimeout(()=>position(first),40)},[find,key,position])\n",
    "  const start=useCallback((force=false)=>{if(!force){const s=read(key);if(localStorage.getItem(autoKey)==='1'||s.completed||Number(s.snoozeUntil||0)>Date.now())return}const first=find(0);if(first<0)return;setIndex(first);setOpen(true);window.setTimeout(()=>position(first),40)},[autoKey,find,key,position])\n",
    'bloqueo automático Team',
)
replace_once(
    p,
    "  const complete=()=>{write(key,{completed:true});setOpen(false)}\n",
    "  const disableAuto=()=>{try{localStorage.setItem(autoKey,'1')}catch{};write(key,{completed:true});setOpen(false)}\n  const complete=()=>{try{localStorage.setItem(autoKey,'1')}catch{};write(key,{completed:true});setOpen(false)}\n",
    'finalización persistente Team',
)
replace_once(
    p,
    '<button type="button" onClick={later} className="rounded-xl px-2 py-2 text-xs font-black text-slate-500">Ver más tarde</button>',
    '<button type="button" onClick={disableAuto} className="rounded-xl px-2 py-2 text-xs font-black text-slate-500">Ya entendí · no mostrar solo</button>',
    'botón no volver a mostrar Team',
)

# Notifications: broadcast read-state changes so counters/badges refresh immediately.
p = 'app/src/components/admin/free/FreeNotifications.tsx'
replace_once(
    p,
    "function formatDate(value?: string | null) {\n  if (!value) return ''\n  const date = new Date(value.endsWith('Z') || value.includes('+') ? value : `${value.replace(' ', 'T')}Z`)\n  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('es-DO')\n}\n",
    "function formatDate(value?: string | null) {\n  if (!value) return ''\n  const date = new Date(value.endsWith('Z') || value.includes('+') ? value : `${value.replace(' ', 'T')}Z`)\n  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('es-DO')\n}\n\nfunction broadcastNotificationChange() {\n  window.dispatchEvent(new Event('kawvo:notifications-changed'))\n}\n",
    'evento global de notificaciones',
)
replace_once(
    p,
    "      setSelected({ ...item, read_at: readAt })\n      try { await apiPatch(`/me/notifications/${item.id}/read`, {}) } catch { /* optimistic */ }\n",
    "      setSelected({ ...item, read_at: readAt })\n      broadcastNotificationChange()\n      try { await apiPatch(`/me/notifications/${item.id}/read`, {}); broadcastNotificationChange() } catch { /* optimistic */ }\n",
    'marcar abierta y refrescar badge',
)
replace_once(
    p,
    "    setItems((current) => current.map((entry) => entry.id === selected.id ? { ...entry, read_at: readAt } : entry))\n    try { await apiPatch(`/me/notifications/${selected.id}/read`, {}) } catch { /* optimistic */ }\n",
    "    setItems((current) => current.map((entry) => entry.id === selected.id ? { ...entry, read_at: readAt } : entry))\n    broadcastNotificationChange()\n    try { await apiPatch(`/me/notifications/${selected.id}/read`, {}); broadcastNotificationChange() } catch { /* optimistic */ }\n",
    'marcar seleccionada y refrescar badge',
)
replace_once(
    p,
    "    setItems((current) => current.map((item) => ({ ...item, read_at: item.read_at || readAt })))\n    try { await apiPatch('/me/notifications/read-all', {}) } catch { /* optimistic */ }\n",
    "    setItems((current) => current.map((item) => ({ ...item, read_at: item.read_at || readAt })))\n    broadcastNotificationChange()\n    try { await apiPatch('/me/notifications/read-all', {}); broadcastNotificationChange() } catch { /* optimistic */ }\n",
    'marcar todas y refrescar badge',
)

# Bell: refresh immediately when notification center changes read state.
p = 'app/src/components/admin/free/FreeNotificationBell.tsx'
replace_once(
    p,
    "    const onFocus = () => void load()\n    const onOpen = () => navigate('/admin/free/notifications?from=account')\n    window.addEventListener('focus', onFocus)\n    window.addEventListener('kawvo:open-notifications', onOpen)\n    return () => { window.clearInterval(timer); window.removeEventListener('focus', onFocus); window.removeEventListener('kawvo:open-notifications', onOpen) }\n",
    "    const onFocus = () => void load()\n    const onChanged = () => void load()\n    const onOpen = () => navigate('/admin/free/notifications?from=account')\n    window.addEventListener('focus', onFocus)\n    window.addEventListener('kawvo:notifications-changed', onChanged)\n    window.addEventListener('kawvo:open-notifications', onOpen)\n    return () => { window.clearInterval(timer); window.removeEventListener('focus', onFocus); window.removeEventListener('kawvo:notifications-changed', onChanged); window.removeEventListener('kawvo:open-notifications', onOpen) }\n",
    'badge de campana reactivo',
)

print('✓ PATCH CONSOLIDADO V2 COMPLETO')
