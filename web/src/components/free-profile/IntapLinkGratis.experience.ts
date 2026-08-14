import type {
  FreeProfileAppearanceColors,
} from './IntapLinkGratis.types'

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

export const FREE_STARTER_PACKS: Record<
  string,
  FreeProfileStarterPack
> = {
  'Moda y accesorios': {
    category: 'Moda y accesorios',
    role: 'Moda y accesorios',
    bio: 'Encuentra propuestas, piezas y detalles pensados para complementar tu estilo.',
    heroLabel: 'Moda, estilo y accesorios',
    recommendedPalette: 'coral',
    services: [
      { title: 'Colecciones', description: 'Conoce nuestras propuestas y novedades.' },
      { title: 'Pedidos', description: 'Consulta disponibilidad y opciones por WhatsApp.' },
      { title: 'Atención personalizada', description: 'Te ayudamos a elegir la opción ideal.' },
    ],
    portfolio: [
      { title: 'Productos destacados', description: 'Una muestra de nuestras piezas y colecciones.' },
      { title: 'Novedades', description: 'Conoce algunas de nuestras opciones más recientes.' },
    ],
  },

  'Salud y bienestar': {
    category: 'Salud y bienestar',
    role: 'Salud y bienestar',
    bio: 'Servicios orientados al cuidado, bienestar y atención de cada persona.',
    heroLabel: 'Bienestar y cuidado',
    recommendedPalette: 'esmeralda',
    services: [
      { title: 'Atención', description: 'Conoce nuestros principales servicios.' },
      { title: 'Orientación', description: 'Recibe información antes de tu visita.' },
      { title: 'Citas', description: 'Consulta disponibilidad por WhatsApp.' },
    ],
    portfolio: [],
  },

  'Belleza y estética': {
    category: 'Belleza y estética',
    role: 'Belleza y estética',
    bio: 'Servicios de belleza y cuidado personal pensados para resaltar tu mejor versión.',
    heroLabel: 'Belleza y cuidado personal',
    recommendedPalette: 'violeta',
    services: [
      { title: 'Tratamientos', description: 'Conoce nuestros servicios de cuidado y estética.' },
      { title: 'Belleza', description: 'Opciones adaptadas a tus necesidades.' },
      { title: 'Reservas', description: 'Agenda o solicita información por WhatsApp.' },
    ],
    portfolio: [
      { title: 'Nuestros trabajos', description: 'Una muestra de resultados y servicios realizados.' },
    ],
  },

  'Gastronomía': {
    category: 'Gastronomía',
    role: 'Gastronomía',
    bio: 'Sabores, propuestas y experiencias preparadas para disfrutar y compartir.',
    heroLabel: 'Sabores que conectan',
    recommendedPalette: 'coral',
    services: [
      { title: 'Menú', description: 'Conoce algunas de nuestras opciones.' },
      { title: 'Pedidos', description: 'Consulta disponibilidad y realiza tu pedido.' },
      { title: 'Eventos', description: 'Opciones para actividades y ocasiones especiales.' },
    ],
    portfolio: [
      { title: 'Especialidades', description: 'Descubre algunas de nuestras propuestas.' },
    ],
  },

  'Tecnología': {
    category: 'Tecnología',
    role: 'Tecnología',
    bio: 'Soluciones tecnológicas para conectar, optimizar y hacer avanzar tus proyectos.',
    heroLabel: 'Tecnología para avanzar',
    recommendedPalette: 'oceano',
    services: [
      { title: 'Soluciones', description: 'Tecnología adaptada a tus necesidades.' },
      { title: 'Implementación', description: 'Apoyo en configuración y puesta en marcha.' },
      { title: 'Soporte', description: 'Acompañamiento cuando lo necesites.' },
    ],
    portfolio: [],
  },

  'Educación': {
    category: 'Educación',
    role: 'Educación',
    bio: 'Aprendizaje, formación y acompañamiento para desarrollar nuevas capacidades.',
    heroLabel: 'Aprender para avanzar',
    recommendedPalette: 'oceano',
    services: [
      { title: 'Formación', description: 'Conoce nuestros programas y opciones educativas.' },
      { title: 'Orientación', description: 'Información para elegir la mejor alternativa.' },
      { title: 'Inscripción', description: 'Consulta disponibilidad y próximos grupos.' },
    ],
    portfolio: [],
  },

  'Arte y diseño': {
    category: 'Arte y diseño',
    role: 'Arte y diseño',
    bio: 'Ideas, creatividad y soluciones visuales desarrolladas para comunicar y destacar.',
    heroLabel: 'Creatividad que comunica',
    recommendedPalette: 'violeta',
    services: [
      { title: 'Diseño', description: 'Soluciones visuales para proyectos y marcas.' },
      { title: 'Creatividad', description: 'Propuestas adaptadas a cada necesidad.' },
      { title: 'Proyectos', description: 'Consulta tu idea y recibe más información.' },
    ],
    portfolio: [
      { title: 'Proyectos realizados', description: 'Una selección de trabajos y propuestas.' },
    ],
  },

  'Deportes y fitness': {
    category: 'Deportes y fitness',
    role: 'Deportes y fitness',
    bio: 'Entrenamiento, movimiento y bienestar para avanzar hacia tus objetivos.',
    heroLabel: 'Movimiento y resultados',
    recommendedPalette: 'esmeralda',
    services: [
      { title: 'Entrenamiento', description: 'Opciones adaptadas a tus objetivos.' },
      { title: 'Programas', description: 'Conoce nuestras modalidades disponibles.' },
      { title: 'Información', description: 'Consulta horarios y disponibilidad.' },
    ],
    portfolio: [],
  },

  'Turismo y viajes': {
    category: 'Turismo y viajes',
    role: 'Turismo y viajes',
    bio: 'Experiencias y servicios pensados para descubrir, disfrutar y viajar mejor.',
    heroLabel: 'Descubre tu próxima experiencia',
    recommendedPalette: 'oceano',
    services: [
      { title: 'Experiencias', description: 'Conoce opciones y destinos disponibles.' },
      { title: 'Reservas', description: 'Consulta fechas y disponibilidad.' },
      { title: 'Asistencia', description: 'Recibe orientación antes de tu viaje.' },
    ],
    portfolio: [],
  },

  'Servicios profesionales': {
    category: 'Servicios profesionales',
    role: 'Servicios profesionales',
    bio: 'Experiencia y soluciones profesionales enfocadas en tus necesidades y objetivos.',
    heroLabel: 'Experiencia a tu servicio',
    recommendedPalette: 'grafito',
    services: [
      { title: 'Asesoría', description: 'Orientación especializada según tu necesidad.' },
      { title: 'Servicios', description: 'Conoce cómo podemos ayudarte.' },
      { title: 'Consulta', description: 'Conversemos sobre tu caso o proyecto.' },
    ],
    portfolio: [],
  },

  'Construcción y hogar': {
    category: 'Construcción y hogar',
    role: 'Construcción y hogar',
    bio: 'Productos y servicios para construir, renovar y mejorar tus espacios.',
    heroLabel: 'Soluciones para tus proyectos',
    recommendedPalette: 'arena',
    services: [
      { title: 'Productos', description: 'Encuentra soluciones para tus proyectos.' },
      { title: 'Servicios', description: 'Conoce las opciones disponibles.' },
      { title: 'Cotizaciones', description: 'Solicita información y disponibilidad.' },
    ],
    portfolio: [
      { title: 'Proyectos y productos', description: 'Una muestra de soluciones para construcción y hogar.' },
    ],
  },

  'Automotriz': {
    category: 'Automotriz',
    role: 'Automotriz',
    bio: 'Servicios y soluciones para el cuidado, mantenimiento y desempeño de tu vehículo.',
    heroLabel: 'Soluciones para tu vehículo',
    recommendedPalette: 'grafito',
    services: [
      { title: 'Servicios', description: 'Conoce nuestras principales soluciones automotrices.' },
      { title: 'Mantenimiento', description: 'Opciones para cuidar tu vehículo.' },
      { title: 'Consulta', description: 'Solicita información o disponibilidad.' },
    ],
    portfolio: [],
  },

  'Agropecuario': {
    category: 'Agropecuario',
    role: 'Agropecuario',
    bio: 'Productos y soluciones para apoyar el trabajo y desarrollo del sector agropecuario.',
    heroLabel: 'Soluciones para el campo',
    recommendedPalette: 'esmeralda',
    services: [
      { title: 'Productos', description: 'Conoce nuestras soluciones disponibles.' },
      { title: 'Asesoría', description: 'Orientación para elegir la opción adecuada.' },
      { title: 'Cotización', description: 'Consulta disponibilidad por WhatsApp.' },
    ],
    portfolio: [],
  },

  'Retail': {
    category: 'Retail',
    role: 'Tienda y comercio',
    bio: 'Productos, novedades y atención directa para encontrar lo que necesitas.',
    heroLabel: 'Productos y novedades',
    recommendedPalette: 'intap',
    services: [
      { title: 'Productos', description: 'Descubre nuestras opciones disponibles.' },
      { title: 'Pedidos', description: 'Consulta precio y disponibilidad.' },
      { title: 'Atención', description: 'Escríbenos para recibir más información.' },
    ],
    portfolio: [
      { title: 'Productos destacados', description: 'Una selección de nuestros productos.' },
    ],
  },

  'Otros': {
    category: 'Otros',
    role: 'Negocio y servicios',
    bio: 'Conoce nuestros productos, servicios y formas de contacto.',
    heroLabel: 'Conoce lo que hacemos',
    recommendedPalette: 'intap',
    services: [
      { title: 'Servicios', description: 'Conoce nuestras principales opciones.' },
      { title: 'Información', description: 'Encuentra lo que necesitas saber.' },
      { title: 'Contacto', description: 'Escríbenos para recibir más información.' },
    ],
    portfolio: [],
  },
}

export function resolveStarterPack(
  category?: string | null,
): FreeProfileStarterPack {
  return (
    FREE_STARTER_PACKS[category || ''] ||
    FREE_STARTER_PACKS.Otros
  )
}
