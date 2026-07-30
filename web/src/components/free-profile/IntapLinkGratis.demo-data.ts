import {
  adaptPublicProfileApiResponse,
} from './IntapLinkGratis.adapter'
import {
  FREE_PROFILE_LIMITS,
  type FreeProfileAppearanceColors,
} from './IntapLinkGratis.types'

export const DEMO_APPEARANCE_COLORS:
  FreeProfileAppearanceColors = {
    primary: '#071f5f',
    secondary: '#0b61c9',
    accent: '#07966a',
    button: '#10b981',
    background: '#eaf0f7',
    surface: '#ffffff',
    text: '#11213d',
    heroGradient: '#071f5f',
  }

const portfolioTitles = [
  'Residencial moderno',
  'Apartamento urbano',
  'Proyecto familiar',
  'Inversión premium',
  'Vivienda contemporánea',
]

const DEMO_PUBLIC_PROFILE_RESPONSE = {
  ok: true,

  data: {
    profileId: 'demo-maria-perez',
    slug: 'maria-perez',
    planId: 'free',
    themeId: 'intap',

    // Campo futuro independiente de templateId.
    layout_id: 'personal',

    name: 'María Pérez',

    bio:
      'Ayudo a personas y familias a encontrar propiedades que se adapten a sus planes, necesidades y presupuesto.',

    avatarUrl:
      '/assets/free-demo/portrait-maria.svg',

    whatsapp_number:
      '18095550199',

    templateData: {
      role:
        'Asesora Inmobiliaria',

      personal_badge:
        'Marca personal',

      about_title:
        'Hagamos que tu próximo paso sea más sencillo.',

      whatsapp_greeting_name:
        'María',

      whatsapp_cta_label:
        'Escríbeme por WhatsApp',

      hero_url:
        '/assets/free-demo/hero-impacto.svg',
    },

    social_links: [
      {
        id: 'instagram',
        type: 'instagram',
        url: 'https://instagram.com/',
        sort_order: 0,
      },
    ],

    links: [
      {
        id: 'catalogo',
        label: 'Ver catálogo de propiedades',
        url: 'https://example.com/catalogo',
        is_cta: 0,
      },
      {
        id: 'agenda',
        label: 'Agenda una consulta',
        url: 'https://example.com/agenda',
        is_cta: 0,
      },
      {
        id: 'proyectos',
        label: 'Proyectos disponibles',
        url: 'https://example.com/proyectos',
        is_cta: 0,
      },
    ],

    gallery: Array.from(
      {
        length:
          FREE_PROFILE_LIMITS
            .maxPortfolioImages,
      },
      (_, index) => ({
        id:
          `portfolio-${index + 1}`,

        title:
          portfolioTitles[index],

        image_key:
          `free-demo/portfolio-${
            index + 1
          }`,

        image_url:
          `/assets/free-demo/portfolio/portfolio-${String(
            index + 1,
          ).padStart(2, '0')}.svg`,
      }),
    ),

    products: [
      {
        id: 'compra-venta',
        title: 'Compra y venta',
        description:
          'Orientación para comprar o vender propiedades.',
        image_url: null,
      },
      {
        id: 'alquileres',
        title: 'Alquileres',
        description:
          'Opciones residenciales y comerciales.',
        image_url: null,
      },
      {
        id: 'inversion',
        title: 'Inversión',
        description:
          'Alternativas con potencial de crecimiento.',
        image_url: null,
      },
      {
        id: 'asesoria',
        title: 'Asesoría',
        description:
          'Acompañamiento durante todo el proceso.',
        image_url: null,
      },
    ],

    contact: {
      whatsapp: '18095550199',
      phone: '18095550199',
      map_url:
        'https://maps.google.com/',
    },
  },
}

const adaptedDemo =
  adaptPublicProfileApiResponse(
    DEMO_PUBLIC_PROFILE_RESPONSE,
  )

export const DEMO_PROFILE =
  adaptedDemo.profile
