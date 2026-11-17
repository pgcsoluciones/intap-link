import { useEffect, useState } from 'react'
import { apiGet } from '../../../lib/api'
import { newestPendingAgenda, type AgendaSummaryItem } from '../free/freeAgendaSummaryData'
import type { KawMedAgendaSection } from './KawMedShellReturn'

const entries: { section: KawMedAgendaSection; title: string; detail: string }[] = [
  { section: 'requests', title: 'Solicitudes de citas médicas', detail: 'Revisar solicitudes pendientes; todavía no son citas confirmadas' },
  { section: 'confirmed', title: 'Citas confirmadas', detail: 'Consultar las citas que ya confirmaste' },
  { section: 'availability', title: 'Disponibilidad de Agenda', detail: 'Franjas que pueden solicitar los pacientes' },
  { section: 'blocks', title: 'Bloqueos', detail: 'Días y horas que no se ofrecerán para citas' },
  { section: 'settings', title: 'Configuración y motivos', detail: 'Duración, anticipación y motivos de las citas' },
]
/** Reuse Free's validated summary reducer; all actions enter the existing AppointmentManager. */
export default function KawMedAgendaOverview({ profileId, onOpen }: { profileId: string; onOpen: (section: KawMedAgendaSection, request?: string) => void }) {
  const [state, setState] = useState<{ status: 'loading' | 'ready' | 'error'; items: AgendaSummaryItem[]; error?: string }>({ status: 'loading', items: [] })
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let active = true
    setState({ status: 'loading', items: [] })
    apiGet('/me/medical-profile/appointments').then(response => {
      if (!(response as any)?.ok) throw Error((response as any)?.error || 'No pudimos cargar la Agenda.')
      const items = newestPendingAgenda(response, profileId)
      if (active) setState({ status: 'ready', items })
    }).catch(error => { if (active) setState({ status: 'error', items: [], error: /Unauthorized|permiso|cuenta activa|corresponde|autorizad/i.test(String(error?.message)) ? 'No se pudo verificar el acceso a la Agenda de esta cuenta. Comprueba la cuenta activa y tus permisos.' : 'No pudimos cargar la Agenda. Reintenta la consulta.' }) })
    return () => { active = false }
  }, [profileId, attempt])
  return <section aria-labelledby="kawmed-agenda-title" className="space-y-4">
    <div><h1 id="kawmed-agenda-title" className="text-2xl font-black">Agenda</h1><p className="mt-2 text-sm text-slate-600">Solicitudes, citas y disponibilidad de tu cuenta médica.</p><p className="mt-2 text-sm text-slate-600">Los horarios públicos por centro se editan en Perfil; son distintos de la disponibilidad de citas.</p></div>
    <div className="divide-y divide-slate-100 rounded-3xl border border-slate-200 bg-white">{entries.map(entry => <button key={entry.section} type="button" onClick={() => onOpen(entry.section)} className="flex min-h-16 w-full items-center justify-between gap-3 rounded-xl px-4 py-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-700"><span className="min-w-0"><strong className="block text-sm">{entry.title}</strong><span className="mt-1 block text-xs text-slate-600">{entry.detail}</span></span><span aria-hidden="true">›</span></button>)}</div>
    <section aria-label="Resumen de solicitudes de citas médicas" className="rounded-3xl border border-slate-200 bg-white p-4">
      <h2 className="text-base font-black">Últimas solicitudes pendientes</h2><p className="mt-1 text-sm text-slate-600">Hasta cinco solicitudes verificadas de tu perfil.</p>
      {state.status === 'loading' && <p role="status" className="mt-4 text-sm">Cargando solicitudes…</p>}
      {state.status === 'error' && <div role="alert" className="mt-4 text-sm text-rose-800"><p>{state.error}</p><button type="button" onClick={() => setAttempt(value => value + 1)} className="mt-2 min-h-11 min-w-11 rounded-xl border px-4 font-bold">Reintentar</button></div>}
      {state.status === 'ready' && (state.items.length ? <ul className="mt-3 divide-y divide-slate-100">{state.items.map(item => <li key={item.id}><button type="button" onClick={() => onOpen('requests', item.id)} className="min-h-16 w-full rounded-xl py-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-700"><strong className="block break-words text-sm">{item.customer_name}</strong><span className="mt-1 block break-words text-sm text-slate-600">{item.reason_label} · {item.appointment_date} {item.start_time.slice(0, 5)}</span><span className="block text-xs font-bold text-amber-800">Pendiente · Revisar solicitud →</span></button></li>)}</ul> : <p role="status" className="mt-4 text-sm text-slate-600">No tienes solicitudes pendientes.</p>)}
    </section>
  </section>
}
