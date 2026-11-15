import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiGet } from '../../../lib/api'
import type { KawvoShellReturn } from './KawvoShellReturn'

type Props = { hideTrigger?: boolean; returnState?: KawvoShellReturn }

export default function FreeNotificationBell({ hideTrigger = false, returnState }: Props) {
  const navigate = useNavigate()
  const [unread, setUnread] = useState(0)

  const load = async () => {
    try {
      const json: any = await apiGet('/me/notifications?limit=1')
      if (json?.ok) setUnread(Number(json.data?.unread_count || 0))
    } catch { /* badge opcional */ }
  }

  useEffect(() => {
    void load()
    const timer = window.setInterval(() => void load(), 30000)
    const onFocus = () => void load()
    const onChanged = () => void load()
    const onOpen = () => navigate(returnState?'/admin/free/notifications':'/admin/free/notifications?from=account',returnState?{state:returnState}:undefined)
    window.addEventListener('focus', onFocus)
    window.addEventListener('kawvo:notifications-changed', onChanged)
    window.addEventListener('kawvo:open-notifications', onOpen)
    return () => { window.clearInterval(timer); window.removeEventListener('focus', onFocus); window.removeEventListener('kawvo:notifications-changed', onChanged); window.removeEventListener('kawvo:open-notifications', onOpen) }
  }, [navigate,returnState])

  if (hideTrigger) return null
  return (
    <button type="button" onClick={() => navigate('/admin/free/notifications',returnState?{state:returnState}:undefined)} aria-label={unread ? `Notificaciones, ${unread} sin leer` : 'Notificaciones'} className="relative flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white shadow-sm transition hover:bg-slate-50">
      <svg viewBox="0 0 24 24" className="h-5 w-5 text-slate-700" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></svg>
      {unread > 0 && <span className="absolute -right-1 -top-1 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-black text-white ring-2 ring-white">{unread > 9 ? '9+' : unread}</span>}
    </button>
  )
}
