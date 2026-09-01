import { useEffect, useState } from 'react'
import { apiGet, apiPost } from '../../../lib/api'
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

function normalizePhrase(value: string) {
  return value.trim().replace(/\s+/g, ' ').toUpperCase()
}

export default function FreeProfileDangerZone({ slug, email = '' }: Props) {
  const [open, setOpen] = useState(false)
  const [phrase, setPhrase] = useState('')
  const [emailConfirm, setEmailConfirm] = useState('')
  const [acknowledged, setAcknowledged] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteStage, setDeleteStage] = useState('')
  const [deletedSuccessfully, setDeletedSuccessfully] = useState(false)
  const [error, setError] = useState('')
  const [reason, setReason] = useState('')
  const [improvementOne, setImprovementOne] = useState('')
  const [improvementTwo, setImprovementTwo] = useState('')
  const [trialEligible, setTrialEligible] = useState(false)
  const [checkingOptions, setCheckingOptions] = useState(false)

  const expectedPhrase = `ELIMINAR ${slug}`
  const phraseMatches = normalizePhrase(phrase) === normalizePhrase(expectedPhrase)
  const emailMatches = email
    ? emailConfirm.trim().toLowerCase() === email.trim().toLowerCase()
    : /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailConfirm.trim())
  const surveyReady = Boolean(reason && improvementOne.trim().length >= 3 && improvementTwo.trim().length >= 3)
  const ready = surveyReady && acknowledged && phraseMatches && emailMatches

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
    setDeleteStage('')
    setError('')
  }

  useEffect(() => {
    if (!open) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [open, deleting])

  const destroy = async () => {
    if (!ready || deleting) return
    setDeleting(true)
    setError('')

    try {
      setDeleteStage('Guardando tus respuestas…')
      const feedback: any = await apiPost('/me/profile/exit-feedback', {
        reason,
        improvement_one: improvementOne.trim(),
        improvement_two: improvementTwo.trim(),
      })

      if (!feedback?.ok) {
        setError(feedback?.error || 'No pudimos guardar tu respuesta antes de eliminar el perfil.')
        return
      }

      setDeleteStage('Eliminando el perfil…')
      const result: any = await apiPost('/me/profile/delete', {
        confirm_slug: expectedPhrase,
        confirm_email: emailConfirm.trim(),
      })

      if (!result?.ok) {
        setError(result?.error || 'No se pudo eliminar el perfil.')
        return
      }

      setDeleteStage('Verificando la eliminación…')
      const verification: any = await apiGet('/me').catch(() => null)
      if (!verification?.ok) {
        setError('El perfil respondió como eliminado, pero no pudimos verificar el estado final. Recarga e inténtalo nuevamente antes de repetir la eliminación.')
        return
      }

      if (verification.data?.profile_id) {
        setError('La verificación todavía detecta un perfil activo. No repetiremos la eliminación automáticamente.')
        return
      }

      ONBOARDING_SESSION_KEYS.forEach((key) => sessionStorage.removeItem(key))
      setOpen(false)
      setDeletedSuccessfully(true)
    } catch {
      setError('No pudimos completar la eliminación. Intenta nuevamente.')
    } finally {
      setDeleting(false)
      setDeleteStage('')
    }
  }

  const continueAfterDeletion = () => {
    window.location.replace('/admin/free/onboarding/welcome?profile_deleted=1')
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

      {deletedSuccessfully && (
        <div className="fixed inset-0 z-[120] flex min-h-[100dvh] items-center justify-center bg-slate-950/60 p-5" role="status" aria-live="polite">
          <div className="w-full max-w-[420px] rounded-[30px] bg-white px-6 py-8 text-center shadow-2xl">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-3xl font-black text-emerald-600">✓</div>
            <p className="mt-5 text-[11px] font-black uppercase tracking-[0.16em] text-emerald-600">Eliminación completada</p>
            <h2 className="mt-2 text-2xl font-black text-slate-950">Tu perfil fue eliminado correctamente</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Gracias por haber formado parte de Kawvo Link. Esperamos verte de nuevo muy pronto.
            </p>
            <p className="mt-3 text-xs leading-5 text-slate-500">
              Si en algún momento decides regresar, podrás crear un nuevo perfil con tu mismo acceso.
            </p>
            <button type="button" onClick={continueAfterDeletion} className="mt-6 w-full rounded-2xl bg-slate-950 px-5 py-3.5 text-sm font-black text-white">
              Continuar
            </button>
          </div>
        </div>
      )}

      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-stretch justify-center bg-slate-950/55 p-0 sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-profile-title"
        >
          <div className="relative h-[100dvh] max-h-[100dvh] w-full max-w-[430px] overflow-y-auto overscroll-contain rounded-none bg-white p-5 shadow-2xl sm:h-auto sm:max-h-[92vh] sm:rounded-[28px]">
            <button
              type="button"
              onClick={close}
              disabled={deleting}
              aria-label="Cerrar"
              className="sticky top-0 z-20 ml-auto flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-xl font-semibold text-slate-700 shadow-lg"
            >
              ×
            </button>

            <div className="-mt-8 pr-12">
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-rose-600">Antes de irte</p>
              <h2 id="delete-profile-title" className="mt-1 text-xl font-black text-slate-950">Ayúdanos a mejorar</h2>
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
              Escribe <span className="font-mono text-rose-700">{expectedPhrase}</span>
              <input value={phrase} onChange={(event) => setPhrase(event.target.value)} autoComplete="off" autoCapitalize="characters" spellCheck={false} className={`mt-2 w-full rounded-2xl border bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:ring-4 focus:ring-rose-100 ${phrase && !phraseMatches ? 'border-rose-300' : 'border-slate-200 focus:border-rose-400'}`} />
              {phrase && !phraseMatches && <span className="mt-1 block text-xs text-rose-600">La frase todavía no coincide.</span>}
            </label>

            <label className="mt-4 block text-xs font-black text-slate-700">
              Confirma tu correo de acceso
              <input type="email" value={emailConfirm} onChange={(event) => setEmailConfirm(event.target.value)} placeholder={email || 'tu-correo@ejemplo.com'} autoComplete="email" autoCapitalize="none" inputMode="email" className={`mt-2 w-full rounded-2xl border bg-slate-50 px-4 py-3 text-sm font-semibold outline-none focus:ring-4 focus:ring-rose-100 ${emailConfirm && !emailMatches ? 'border-rose-300' : 'border-slate-200 focus:border-rose-400'}`} />
              {emailConfirm && !emailMatches && <span className="mt-1 block text-xs text-rose-600">El correo debe coincidir con tu correo de acceso.</span>}
            </label>

            <label className="mt-4 flex items-start gap-3 rounded-2xl border border-slate-200 p-3 text-xs leading-5 text-slate-600">
              <input type="checkbox" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} className="mt-0.5 h-5 w-5 shrink-0" />
              <span>Entiendo que el perfil y sus datos no podrán recuperarse después de confirmar.</span>
            </label>

            {!ready && (
              <div className="mt-4 rounded-2xl bg-slate-50 p-3 text-xs leading-5 text-slate-600">
                Para activar el botón completa las 3 respuestas, escribe la frase indicada, confirma el mismo correo de acceso y marca la casilla final.
              </div>
            )}

            {deleteStage && <p className="mt-4 rounded-xl bg-slate-50 px-3 py-2 text-center text-xs font-semibold text-slate-600">{deleteStage}</p>}
            {error && <p className="mt-4 rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">{error}</p>}

            <div className="sticky bottom-0 -mx-5 mt-5 grid grid-cols-2 gap-2 border-t border-slate-100 bg-white/95 px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur">
              <button type="button" onClick={close} disabled={deleting} className="rounded-xl bg-slate-100 px-4 py-3 text-xs font-black text-slate-700">Cancelar</button>
              <button type="button" onClick={() => void destroy()} disabled={!ready || deleting} className="rounded-xl bg-rose-600 px-4 py-3 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-35">
                {deleting ? 'Procesando…' : 'Eliminar definitivamente'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
