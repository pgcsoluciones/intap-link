import { lazy, Suspense, type ComponentType, type ReactNode } from 'react'

import type { IntapProfileV2Profile } from './IntapProfileV2'

export const PROFILE_TEMPLATE_IDS = {
  novi: 'real_estate_novi_v4',
  jason: 'automotive_jason_v3',
  oneAEventos: 'events_1a_v1',
  rentaoRd: 'car_rental_rentao_v1',
  aycDominicana: 'industrial_aycdom_v1',
  adonisg: 'personal_brand_adonisg_v1',
} as const

export type RegisteredProfileTemplateId = (typeof PROFILE_TEMPLATE_IDS)[keyof typeof PROFILE_TEMPLATE_IDS]

type ProfileTemplateComponent = ComponentType<{ profile: IntapProfileV2Profile }>

const NoviTemplate = lazy(() => import('./IntapProfileNoviV4').then((module) => ({ default: module.default as ProfileTemplateComponent })))
const JasonTemplate = lazy(() => import('./IntapProfileJasonV3').then((module) => ({ default: module.default as ProfileTemplateComponent })))
const RentaoTemplate = lazy(() => import('./IntapProfileRentaoRd').then((module) => ({ default: module.default as ProfileTemplateComponent })))
const AyCTemplate = lazy(() => import('./IntapProfileAyCDominicanaV1').then((module) => ({ default: module.default as ProfileTemplateComponent })))
const AdonisgTemplate = lazy(() => import('./IntapProfileAdonisgV1').then((module) => ({ default: module.default as ProfileTemplateComponent })))
const OneAEventosTemplate = lazy(() => import('./IntapProfile1AEventos'))

function LoadingTemplate() {
  return <div style={{ minHeight: '100vh', background: '#ffffff' }} />
}

export function renderRegisteredProfileTemplate(templateId: string | null | undefined, profile: IntapProfileV2Profile): ReactNode | null {
  if (!templateId) return null
  let content: ReactNode = null
  switch (templateId as RegisteredProfileTemplateId) {
    case PROFILE_TEMPLATE_IDS.novi: content = <NoviTemplate profile={profile} />; break
    case PROFILE_TEMPLATE_IDS.jason: content = <JasonTemplate profile={profile} />; break
    case PROFILE_TEMPLATE_IDS.oneAEventos: content = <OneAEventosTemplate />; break
    case PROFILE_TEMPLATE_IDS.rentaoRd: content = <RentaoTemplate profile={profile} />; break
    case PROFILE_TEMPLATE_IDS.aycDominicana: content = <AyCTemplate profile={profile} />; break
    case PROFILE_TEMPLATE_IDS.adonisg: content = <AdonisgTemplate profile={profile} />; break
    default: return null
  }
  return <Suspense fallback={<LoadingTemplate />}>{content}</Suspense>
}

export function isRegisteredProfileTemplate(templateId: string | null | undefined): templateId is RegisteredProfileTemplateId {
  return Boolean(templateId && Object.values(PROFILE_TEMPLATE_IDS).includes(templateId as RegisteredProfileTemplateId))
}
