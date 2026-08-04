import type { ReactNode } from 'react'
import type { IntapProfileV2Profile } from './IntapProfileV2'

import IntapProfile1AEventos from './IntapProfile1AEventos'
import IntapProfileJasonV3 from './IntapProfileJasonV3'
import IntapProfileNoviV4 from './IntapProfileNoviV4'
import IntapProfileRentaoRd from './IntapProfileRentaoRd'

export const PROFILE_TEMPLATE_IDS = {
  novi: 'real_estate_novi_v4',
  jason: 'automotive_jason_v3',
  oneAEventos: 'events_1a_v1',
  rentaoRd: 'car_rental_rentao_v1',
} as const

export type RegisteredProfileTemplateId =
  (typeof PROFILE_TEMPLATE_IDS)[keyof typeof PROFILE_TEMPLATE_IDS]

type TemplateRenderer = (profile: IntapProfileV2Profile) => ReactNode

const PROFILE_TEMPLATE_REGISTRY: Record<
  RegisteredProfileTemplateId,
  TemplateRenderer
> = {
  [PROFILE_TEMPLATE_IDS.novi]: (profile) => (
    <IntapProfileNoviV4 profile={profile} />
  ),

  [PROFILE_TEMPLATE_IDS.jason]: (profile) => (
    <IntapProfileJasonV3 profile={profile} />
  ),

  [PROFILE_TEMPLATE_IDS.oneAEventos]: () => (
    <IntapProfile1AEventos />
  ),

  [PROFILE_TEMPLATE_IDS.rentaoRd]: (profile) => (
    <IntapProfileRentaoRd profile={profile} />
  ),
}

export function renderRegisteredProfileTemplate(
  templateId: string | null | undefined,
  profile: IntapProfileV2Profile,
): ReactNode | null {
  if (!templateId) return null

  const renderer =
    PROFILE_TEMPLATE_REGISTRY[
      templateId as RegisteredProfileTemplateId
    ]

  return renderer ? renderer(profile) : null
}

export function isRegisteredProfileTemplate(
  templateId: string | null | undefined,
): templateId is RegisteredProfileTemplateId {
  return Boolean(
    templateId &&
      Object.prototype.hasOwnProperty.call(
        PROFILE_TEMPLATE_REGISTRY,
        templateId,
      ),
  )
}
