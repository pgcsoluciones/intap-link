/** Presentation hints only. Authentication, selected account and ownership stay in the existing guards/API. */
export type KawMedShellTab = 'home' | 'profile' | 'agenda' | 'more'
export type KawMedProfileSection = 'profile' | 'centers' | 'schedule' | 'insurance' | 'appearance'

export const KAWMED_SHELL_TABS: readonly { id: KawMedShellTab; label: string; icon: string }[] = [
  { id: 'home', label: 'Inicio', icon: '⌂' },
  { id: 'profile', label: 'Perfil', icon: '◉' },
  { id: 'agenda', label: 'Agenda', icon: '▦' },
  { id: 'more', label: 'Más', icon: '☷' },
]

export const KAWMED_PROFILE_SECTIONS: readonly { id: KawMedProfileSection; title: string; detail: string }[] = [
  { id: 'profile', title: 'Identidad y especialidades', detail: 'Fotografía, presentación y contacto' },
  { id: 'centers', title: 'Centros de atención', detail: 'Direcciones, teléfonos y ubicación' },
  { id: 'schedule', title: 'Horarios por centro', detail: 'Horarios públicos de atención' },
  { id: 'insurance', title: 'Seguros y excepciones', detail: 'Coberturas aceptadas y excepciones' },
  { id: 'appearance', title: 'Apariencia', detail: 'Plantilla y paleta del perfil' },
]

type Request = { mode: string; hostname: string; pathname: string; search: string; scope: string; delegated: boolean }
export function isKawMedShellRequest(context: Request): boolean {
  return context.mode === 'preview'
    && context.hostname === 'app.preview.intaprd.com'
    && context.pathname === '/admin/medical'
    && new URLSearchParams(context.search).get('kawvo_med_shell') === '1'
    && context.scope === 'doctor'
    && !context.delegated
}

export function canUseKawMedShell(context: Request & { profileId: unknown; guestEditor: unknown }): boolean {
  return isKawMedShellRequest(context)
    && typeof context.profileId === 'string' && context.profileId.trim().length > 0
    && !context.guestEditor
}

/** These states describe the existing load result; they never grant access. */
export function kawMedLoadPresentation(error: string): { title: string; message: string } {
  if (!error) return { title: 'Perfil médico no disponible', message: 'No hay un perfil médico autorizado disponible para esta sesión.' }
  if (error === 'Unauthorized' || /cuenta activa|pestaña|permiso|autorizad/i.test(error)) {
    return { title: 'No se pudo verificar el acceso', message: error === 'Unauthorized' ? 'Inicia sesión con la cuenta médica correspondiente.' : error }
  }
  if (/perfil médico no encontrado/i.test(error)) return { title: 'Perfil médico no encontrado', message: error }
  return { title: 'No se pudo cargar Kawmed', message: error }
}

/** Compare drafts without writing or discarding anything. Existing save handlers remain authoritative. */
export function hasPendingKawMedEdits({ profile, form, acceptedText, excludedText, secondaryDraft, newCenter, editingCenter, newSchedule, editingSchedule, selectedDays, scheduleDaysBaseline }: {
  profile: Record<string, any>; form: Record<string, any>; acceptedText: string; excludedText: string; secondaryDraft: string
  newCenter: Record<string, any>; editingCenter: unknown; newSchedule: Record<string, any>; editingSchedule: unknown
  selectedDays: readonly number[]; scheduleDaysBaseline: readonly number[]
}): boolean {
  const fields = ['slug', 'name', 'professional_prefix', 'specialty', 'subspecialty', 'bio', 'phone', 'whatsapp', 'email', 'city', 'province', 'country', 'organization']
  if (fields.some(key => String(form[key] ?? '') !== String(profile[key] ?? ''))) return true
  const insuranceText = (rows: any[]) => rows.map(row => row.insurance_name || row).join('\n')
  return acceptedText !== insuranceText(profile.insurance_policy?.accepted || [])
    || excludedText !== insuranceText(profile.insurance_policy?.excluded || [])
    || Boolean(secondaryDraft.trim() || editingCenter || editingSchedule)
    || Object.values(newCenter).some(value => Boolean(String(value || '').trim()))
    || Boolean(newSchedule.center_id || newSchedule.shift || newSchedule.notes)
    || newSchedule.start_time !== '08:00' || newSchedule.end_time !== '12:00'
    || selectedDays.length !== scheduleDaysBaseline.length
    || selectedDays.some(day => !scheduleDaysBaseline.includes(day))
}
