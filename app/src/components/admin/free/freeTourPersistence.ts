import { apiGet, apiPatch } from '../../../lib/api'

let cachedDisabled: boolean | null = null

export async function isFreeTourAutoDisabled() {
  if (cachedDisabled !== null) return cachedDisabled
  try {
    const json: any = await apiGet('/me/free/experience')
    cachedDisabled = json?.ok === true && json.data?.tour_auto_disabled === true
  } catch {
    cachedDisabled = false
  }
  return cachedDisabled
}

export async function disableFreeTourAuto() {
  cachedDisabled = true
  try {
    const json: any = await apiPatch('/me/free/experience', { tour_auto_disabled: true })
    if (json?.ok !== true) throw new Error('No pudimos guardar la preferencia del recorrido.')
  } catch {
    // LocalStorage sigue actuando como respaldo inmediato; el próximo intento vuelve a persistir.
  }
}

export function resetFreeTourPersistenceCache() {
  cachedDisabled = null
}
