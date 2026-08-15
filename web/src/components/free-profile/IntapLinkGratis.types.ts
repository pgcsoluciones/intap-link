export type FreeProfileLayoutId =
  | 'impacto'
  | 'personal'
  | 'esencial'

export type FreeProfileServiceIconKey =
  | 'home'
  | 'key'
  | 'chart-line'
  | 'handshake'

export type FreeProfileQuickActionType =
  | 'call'
  | 'instagram'
  | 'location'
  | 'email'
  | 'tiktok'

export type FreeProfileQuickAction = {
  type: FreeProfileQuickActionType
  label: string
  url: string
}

export type FreeProfileAppearanceColors = {
  primary: string
  secondary: string
  accent: string
  button: string
  background: string
  surface: string
  text: string
  heroGradient: string
}

export type FreeProfileService = {
  id: string
  title: string
  description: string
  image?: string
  iconKey: FreeProfileServiceIconKey
}

export type FreeProfilePortfolioItem = {
  id: string
  title: string
  description: string
  image: string
}

export type FreeProfileCustomLink = {
  id: string
  label: string
  url: string
}

export type FreeProfileData = {
  id: string
  slug: string
  name: string
  role: string
  personalBadge: string
  aboutTitle: string
  portfolioTitle: string
  servicesTitle: string
  bio: string
  phone: string
  whatsappGreetingName: string
  whatsappCtaLabel: string
  instagram: string
  location: string
  portrait: string
  hero: string
  heroPositionX: number
  heroPositionY: number
  heroZoom: number
  category: string
  vcardFileName: string
  quickActions: FreeProfileQuickAction[]
  services: FreeProfileService[]
  portfolio: FreeProfilePortfolioItem[]
  customLinks: FreeProfileCustomLink[]
}

export const FREE_PROFILE_LIMITS = {
  maxQuickActions: 3,
  maxCustomLinks: 3,
  maxPortfolioImages: 5,
  maxServices: 3,
} as const
