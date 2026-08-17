import type {
  FreeProfileAppearanceColors,
} from './IntapLinkGratis.types'
import { FREE_PROFILE_STARTER_CONTENT, resolveFreeStarterContent, type FreeStarterContentPack } from '../../../../shared/free-profile-starter-content'

export type FreePaletteId =
  | 'intap'
  | 'oceano'
  | 'esmeralda'
  | 'violeta'
  | 'coral'
  | 'grafito'
  | 'arena'
  | 'personalizada'

export type FreeProfileStarterPack = {
  category: string
  role: string
  bio: string
  heroLabel: string
  servicesTitle: string
  servicesDescription: string
  recommendedPalette: FreePaletteId
  services: Array<{
    title: string
    description: string
  }>
  portfolio: Array<{
    title: string
    description: string
  }>
}

export type FreePalette = {
  id: FreePaletteId
  name: string
  colors: FreeProfileAppearanceColors
}

export const FREE_PALETTES: FreePalette[] = [
  {
    id: 'intap',
    name: 'INTAP',
    colors: {
      primary: '#071F5F',
      secondary: '#0B61C9',
      accent: '#07966A',
      button: '#10B981',
      background: '#EAF0F7',
      surface: '#FFFFFF',
      text: '#11213D',
      heroGradient: '#071F5F',
    },
  },
  {
    id: 'oceano',
    name: 'Océano',
    colors: {
      primary: '#0C4A6E',
      secondary: '#0284C7',
      accent: '#0891B2',
      button: '#0284C7',
      background: '#F0F9FF',
      surface: '#FFFFFF',
      text: '#0C2233',
      heroGradient: '#075985',
    },
  },
  {
    id: 'esmeralda',
    name: 'Esmeralda',
    colors: {
      primary: '#064E3B',
      secondary: '#047857',
      accent: '#10B981',
      button: '#059669',
      background: '#ECFDF5',
      surface: '#FFFFFF',
      text: '#12352B',
      heroGradient: '#065F46',
    },
  },
  {
    id: 'violeta',
    name: 'Violeta',
    colors: {
      primary: '#4C1D95',
      secondary: '#7C3AED',
      accent: '#A855F7',
      button: '#7C3AED',
      background: '#FAF5FF',
      surface: '#FFFFFF',
      text: '#2E1A47',
      heroGradient: '#5B21B6',
    },
  },
  {
    id: 'coral',
    name: 'Coral',
    colors: {
      primary: '#9F1239',
      secondary: '#E11D48',
      accent: '#FB7185',
      button: '#E11D48',
      background: '#FFF1F2',
      surface: '#FFFFFF',
      text: '#481824',
      heroGradient: '#BE123C',
    },
  },
  {
    id: 'grafito',
    name: 'Grafito',
    colors: {
      primary: '#111827',
      secondary: '#374151',
      accent: '#64748B',
      button: '#1F2937',
      background: '#F3F4F6',
      surface: '#FFFFFF',
      text: '#111827',
      heroGradient: '#111827',
    },
  },
  {
    id: 'arena',
    name: 'Arena',
    colors: {
      primary: '#5C4033',
      secondary: '#8B6F47',
      accent: '#B08968',
      button: '#7C5E3C',
      background: '#FAF7F2',
      surface: '#FFFFFF',
      text: '#3B2F29',
      heroGradient: '#6B4F3A',
    },
  },
]

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function hexToRgb(hex: string) {
  const clean = hex.replace('#', '')
  const value = parseInt(clean, 16)

  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  }
}

function rgbToHex(r: number, g: number, b: number) {
  const part = (value: number) =>
    clamp(Math.round(value), 0, 255)
      .toString(16)
      .padStart(2, '0')

  return `#${part(r)}${part(g)}${part(b)}`.toUpperCase()
}

function mix(hex: string, target: '#FFFFFF' | '#000000', amount: number) {
  const source = hexToRgb(hex)
  const destination = hexToRgb(target)

  return rgbToHex(
    source.r + (destination.r - source.r) * amount,
    source.g + (destination.g - source.g) * amount,
    source.b + (destination.b - source.b) * amount,
  )
}

export function buildCustomPalette(
  brandColor: string,
): FreeProfileAppearanceColors {
  const primary =
    /^#[0-9a-f]{6}$/i.test(brandColor)
      ? brandColor.toUpperCase()
      : '#071F5F'

  return {
    primary,
    secondary: mix(primary, '#FFFFFF', 0.18),
    accent: mix(primary, '#FFFFFF', 0.32),
    button: primary,
    background: mix(primary, '#FFFFFF', 0.92),
    surface: '#FFFFFF',
    text: mix(primary, '#000000', 0.55),
    heroGradient: mix(primary, '#000000', 0.14),
  }
}

export function resolvePalette(
  paletteId: string,
  brandColor?: string | null,
): FreeProfileAppearanceColors {
  if (
    paletteId === 'personalizada' &&
    brandColor
  ) {
    return buildCustomPalette(brandColor)
  }

  return (
    FREE_PALETTES.find(
      (palette) => palette.id === paletteId,
    )?.colors ||
    FREE_PALETTES[0].colors
  )
}

function toFreeProfileStarterPack(pack: FreeStarterContentPack): FreeProfileStarterPack {
  return {
    category: pack.category,
    role: pack.role,
    bio: pack.bio,
    heroLabel: pack.heroLabel,
    servicesTitle: pack.servicesTitle,
    servicesDescription: pack.servicesDescription,
    recommendedPalette: pack.recommendedPalette,
    services: pack.services.map(({ title, description }) => ({ title, description })),
    portfolio: [],
  }
}

export const FREE_STARTER_PACKS: Record<string, FreeProfileStarterPack> = Object.fromEntries(
  Object.entries(FREE_PROFILE_STARTER_CONTENT).map(([category, pack]) => [category, toFreeProfileStarterPack(pack)]),
)

export function resolveStarterPack(
  category?: string | null,
): FreeProfileStarterPack {
  return toFreeProfileStarterPack(resolveFreeStarterContent(category))
}
