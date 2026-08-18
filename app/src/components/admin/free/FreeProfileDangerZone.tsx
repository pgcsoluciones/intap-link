import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiDelete, apiGet, apiPost } from '../../../lib/api'
import { basicTrialWhatsAppUrl } from './FreePanelUi'

type Props = {
  slug: string
  email?: string
}

const ONBOARDING_SESSION_KEYS = [
  'kawvo_free_category',
  'kawvo_free_subcategory',
  'kawvo_free_lead_source',
  'kawvo_free_registration_intent',
  'intap_activation_public_code',
]

const EXIT_REASONS = [
  'No entendí cómo completar mi perfil',
  'No encontré una función que necesito',
  'Prefiero otra herramienta',
  'Solo estaba probando',
  'No quiero continuar por ahora',
  'Otro motivo',
]

export default function FreeProfileDangerZone({ slug, email = '' }: Props) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [phrase, setPhrase] = useState('')
  const [emailConfirm, setEmailConfirm] = useState('')
  const [acknowledged, setAcknowledged] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')
  const [reason, setReason] = useState('')
  const [improvementOne, setImprovementOne] = useState('')
  const [improvementTwo, setImprovementTwo] = useState('')
  const [trialEligible, setTrialEligible] = useState(false)
  const [checkingOptions, setCheckingOptions] = useState(false)

  const expectedPhrase = `ELIMINAR ${slug}`
  const surveyReady = Boolean(reason && improvementOne.trim().length >= 3 && improvementTwo.trim().length >= 3)
  const ready = surveyReady && acknowledged && phrase === expectedPhrase && emailConfirm.trim().length > 3

  const openDialog = async () => {
    setOpen(true)
    setCheckingOptions(true)
    try {
      const result: any = await apiGet('/me/profile/exit-options')
      setTrialEligible(Boolean(result?.ok && result.data?.trial_offer_eligible))
    } catch {
      setTrialEligible(false)
    } finally {
      setCheckingOptions(false)
    }
  }

  const close = () => {
    if (deleting) return
    setOpen(false)
    setPhrase('')
    setEmailConfirm('')
    setAcknowledged(false)
    setReason('')
    setImprovementOne('')
    setImprovementTwo('')
    setTrialEligible(false)
    setError('')
  }

  const destroy = async () => {
    if (!ready || deleting) return
    setDeleting(true)
    setError('')
    try {
      const feedback: any = await apiPost('/me/profile/exit-feedback', {
        reason,
        improvement_one: improvementOne.trim(),
        improvement_two: improvementTwo.trim(),
      })
      if (!feedback?.ok) {
        setError(feedback?.error || 'No pudimos guardar tu respuesta antes de eliminar el perfil.')
        return
      }

      const result: any = await apiDelete('/me/profile', {
        confirm_slug: phrase,
        confirm_email: emailConfirm.trim(),
      })
      if (!result.ok) {
        setError(result.error || 'No se pudo eliminar el perfil.')
        return
      }

      ONBOARDING_SESSION_KEYS.forEach((key) => sessionStorage.removeItem(key))
      navigate('/admin/free/onboarding/welcome', { replace: true })
    } catch {
      setError('No pudimos completar la eliminación. Intenta nuevamente.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <section className="mt-8 rounded-[22px] border border-rose-200 bg-rose-50/60 p-4">
      <p className="text-[11px] font-black uppercase tracking-[0.16em] text-rose-600">Zona de seguridad</p>
      <h2 className="mt-1 text-base font-black text-slate-950">Eliminar perfil definitivamente</h2>
      <p className="mt-2 text-xs leading-5 text-slate-600">
        Esta acción elimina el perfil, su contenido y su URL pública. Tu cuenta de acceso no se elimina. Los productos físicos seguirán perteneciendo a tu cuenta, pero quedarán sin perfil asociado.
      </p>
      <button type="button" onClick={() => void openDialog()} className="mt-4 w-full rounded-xl border border-rose-300 bg-white px-4 py-3 text-xs font-black text-rose-700">
        Eliminar mi perfil
      </button>

      {open && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/55 p-4 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="delete-profile-title">
          <div className="max-h-[92vh] w-full max-w-[430px] overflow-y-auto rounded-[28px] bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-rose-600">Antes de irte</p>
                <h2 id="delete-profile-title" className="mt-1 text-xl font-black text-slate-950">Ayúdanos a mejorar</h2>
              </div>
              <button type="button" onClick={close} disabled={deleting} className="rounded-full bg-slate-100 px-3 py-2 text-xs font-black text-slate-500">Cerrar</button>
            </div>

            <p className="mt-3 text-xs leading-5 text-slate-500">Son tres respuestas breves. Nos ayudan a entender qué debemos mejorar antes de completar la eliminación.</p>

            <label className="mt-4 block text-xs font-black text-slate-700">
              ¿Cuál es el motivo principal?
              <select value={reason} onChange={(event) => setReason(event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none focus:border-rose-300">
                <option value="">Selecciona una opción</option>
                {EXIT_REASONS.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>

            <label className="mt-4 block text-xs font-black text-slate-700">
              ¿Qué te faltó o te resultó difícil?
              <textarea value={improvementOne} onChange={(event) => setImprovementOne(event.target.value)} maxLength={600} rows={3} className="mt-2 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 outline-none focus:border-rose-300" placeholder="Cuéntanos brevemente…" />
            </label>

            <label className="mt-4 block text-xs font-black text-slate-700">
              ¿Qué cambio te haría considerar seguir usando Kawvo Link?
              <textarea value={improvementTwo} onChange={(event) => setImprovementTwo(event.target.value)} maxLength={600} rows={3} className="mt-2 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 outline-none focus:border-rose-300" placeholder="Una mejora, función o experiencia…" />
            </label>

            {checkingOptions && <p className="mt-4 text-center text-xs font-semibold text-slate-400">Revisando opciones disponibles para tu cuenta…</p>}

            {!checkingOptions && trialEligible && (
              <div className="mt-4 rounded-2xl border border-violet-200 bg-violet-50 p-4">
                <p className="text-sm font-black text-violet-950">Antes de eliminarlo, puedes probar el Plan Básico 7 días gratis</p>
                <p className="mt-1 text-xs leading-5 text-violet-800">Esta invitación aparece porque tu cuenta no está registrada como una cuenta que ya utilizó la prueba gratuita.</p>
                <a href={basicTrialWhatsAppUrl()} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex w-full items-center justify-center rounded-xl bg-white px-4 py-3 text-xs font-black text-violet-700 shadow-sm">Probar Básico 7 días gratis</a>
              </div>
            )}

            <div className="mt-5 rounded-2xl border border-rose-100 bg-rose-50 p-4 text-xs leading-5 text-rose-800">
              <strong>Se eliminará definitivamente:</strong> identidad, enlaces, servicios, portafolio, configuración, analíticas asociadas y la URL pública del perfil. Esta operación no se puede deshacer.
            </div>

            <label className="mt-5 block text-xs font-black text-slate-700">
              Escribe exactamente <span className="font-mono text-rose-700">{expectedPhrase}</span>
              <input value={phrase} onChange={(event) => setPhrase(event.target.value)} autoComplete="off" spellCheck={false} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:border-rose-400 focus:ring-4 focus:ring-rose-100" />
            </label>

            <label className="mt-4 block text-xs font-black text-slate-700">
              Confirma tu correo de acceso
              <input type="email" value={emailConfirm} onChange={(event) => setEmailConfirm(event.target.value)} placeholder={email || 'tu-correo@ejemplo.com'} autoComplete="email" className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none focus:border-rose-400 focus:ring-4 focus:ring-rose-100" />
            </label>

            <label className="mt-4 flex items-start gap-3 rounded-2xl border border-slate-200 p-3 text-xs leading-5 text-slate-600">
              <input type="checkbox" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} className="mt-0.5 h-4 w-4" />
              <span>Entiendo que el perfil y sus datos no podrán recuperarse después de confirmar.</span>
            </label>

            {error && <p className="mt-4 rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">{error}</p>}

            <div className="mt-5 grid grid-cols-2 gap-2">
              <button type="button" onClick={close} disabled={deleting} className="rounded-xl bg-slate-100 px-4 py-3 text-xs font-black text-slate-700">Cancelar</button>
              <button type="button" onClick={() => void destroy()} disabled={!ready || deleting} className="rounded-xl bg-rose-600 px-4 py-3 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-35">
                {deleting ? 'Eliminando…' : 'Eliminar definitivamente'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
