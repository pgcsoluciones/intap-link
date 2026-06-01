import { buildProfileSeo, type SeoPublicProfile, type ProfileSeoPayload } from './profileSeo'

const fallbackProfiles: Record<string, SeoPublicProfile> = {
  novi: {
    slug: 'novi',
    name: 'Noldys Vicente | NOVI HOME',
    bio: 'Asesora inmobiliaria en Santo Domingo. Propiedades listas, orientación clara y acompañamiento confiable para comprar, vender, alquilar o invertir con seguridad.',
    avatarUrl: '/assets/landing/perfil-novi-01.png',
    whatsapp_number: '18099666087',
    templateId: 'novi_v4',
    templateData: {
      seo_title: 'NOVI HOME | Noldys Vicente - Asesora inmobiliaria',
      seo_description: 'Perfil oficial de NOVI HOME y Noldys Vicente, asesora inmobiliaria en Santo Domingo. Compra, venta, alquiler e inversión inmobiliaria con orientación profesional.',
      og_image: '/assets/landing/hero-novi-01.png',
      schema_type: 'RealEstateAgent',
    },
    social_links: [
      {
        type: 'instagram',
        url: 'https://www.instagram.com/noldys.novihome/',
      },
    ],
    gallery: [
      {
        image_url: '/assets/landing/hero-novi-01.png',
      },
    ],
    faqs: [
      {
        question: '¿NOVI HOME ayuda a comprar propiedades?',
        answer: 'Sí. NOVI HOME ofrece orientación inmobiliaria para personas interesadas en comprar propiedades listas o invertir con mayor claridad.',
      },
      {
        question: '¿Puedo solicitar asesoría por WhatsApp?',
        answer: 'Sí. Puedes contactar a NOVI HOME por WhatsApp para recibir orientación personalizada.',
      },
    ],
    products: [
      {
        title: 'Compra de propiedades',
        description: 'Acompañamiento para encontrar propiedades listas y tomar decisiones de compra con mayor seguridad.',
        image_url: '/assets/landing/compra-novi.png',
      },
      {
        title: 'Venta de propiedades',
        description: 'Orientación para presentar, promover y conectar propiedades con compradores potenciales.',
        image_url: '/assets/landing/venta-novi.png',
      },
      {
        title: 'Alquiler e inversión inmobiliaria',
        description: 'Asesoría para alquileres, inversiones y oportunidades inmobiliarias en Santo Domingo.',
        image_url: '/assets/landing/inversion-novi.png',
      },
    ],
    contact: {
      whatsapp: '18099666087',
      email: 'noldysvicente@gmail.com',
      phone: '809-966-6087',
      hours: null,
      address: 'Av. Sarasota #45, Sector Bella Vista, Santo Domingo, Dominican Republic',
      map_url: 'https://www.google.com/maps/search/?api=1&query=Av.%20Sarasota%2045%20Bella%20Vista%20Santo%20Domingo',
    },
  },

  jason: {
    slug: 'jason',
    name: 'Comercial Jason S.R.L.',
    bio: 'Empresa en Santo Domingo especializada en venta de gomas nuevas y usadas, aros, reparación y mantenimiento de aros, con más de 25 años de experiencia.',
    avatarUrl: '/assets/landing/jason-logo-blanco-rojo.png',
    whatsapp_number: '18096848842',
    templateId: 'jason_v3',
    templateData: {
      seo_title: 'Comercial Jason S.R.L. | Gomas y aros en Santo Domingo',
      seo_description: 'Perfil oficial de Comercial Jason S.R.L. Venta de gomas nuevas y usadas, aros, reparación y mantenimiento de aros en Santo Domingo.',
      og_image: '/assets/landing/hero-jason-05.png',
      schema_type: 'AutoPartsStore',
    },
    social_links: [],
    gallery: [
      {
        image_url: '/assets/landing/hero-jason-05.png',
      },
    ],
    faqs: [
      {
        question: '¿Comercial Jason vende gomas nuevas y usadas?',
        answer: 'Sí. Comercial Jason ofrece gomas nuevas y usadas, además de aros y servicios especializados para aros.',
      },
      {
        question: '¿Dónde está ubicado Comercial Jason?',
        answer: 'Comercial Jason está ubicado en C. María Montez 213, Santo Domingo 10411, República Dominicana.',
      },
    ],
    products: [
      {
        title: 'Venta de gomas',
        description: 'Gomas nuevas y usadas para diferentes tipos de vehículos, con asesoría según necesidad y presupuesto.',
        image_url: '/assets/landing/goma-1.png',
      },
      {
        title: 'Venta de aros',
        description: 'Aros seleccionados para mejorar apariencia, seguridad y rendimiento del vehículo.',
        image_url: '/assets/landing/aro-1.png',
      },
      {
        title: 'Reparación y mantenimiento de aros',
        description: 'Servicios especializados para reparación y mantenimiento preventivo de aros.',
        image_url: '/assets/landing/reparacion-aro.png',
      },
    ],
    contact: {
      whatsapp: '18096848842',
      email: 'comercialjason@hotmail.com',
      phone: '(809) 684-8842',
      hours: null,
      address: 'C. María Montez 213, Santo Domingo 10411, República Dominicana',
      map_url: 'https://www.google.com/maps/search/?api=1&query=Comercial%20Jason%20Santo%20Domingo',
    },
  },

  rentaord: {
    slug: 'rentaord',
    name: 'Rentao RD',
    bio: 'Servicio de renta de vehículos modernos, seguros y listos para moverte sin complicaciones en Santo Domingo, República Dominicana.',
    avatarUrl: '/assets/rentaord/logo-rentao-rd.png',
    whatsapp_number: '18096000000',
    templateId: 'rentaord_v1',
    templateData: {
      seo_title: 'Rentao RD | Renta de vehículos en Santo Domingo',
      seo_description: 'Perfil oficial de Rentao RD. Renta vehículos modernos, seguros y listos para moverte sin complicaciones en Santo Domingo.',
      og_image: '/assets/rentaord/hero-rentao-rd.png',
      schema_type: 'AutoRental',
    },
    social_links: [],
    gallery: [
      {
        image_url: '/assets/rentaord/hero-rentao-rd.png',
      },
    ],
    faqs: [
      {
        question: '¿Rentao RD ofrece renta de vehículos en Santo Domingo?',
        answer: 'Sí. Rentao RD ofrece vehículos modernos, seguros y listos para movilidad personal, familiar o ejecutiva.',
      },
      {
        question: '¿Puedo consultar disponibilidad por WhatsApp?',
        answer: 'Sí. Puedes consultar disponibilidad y orientación directamente por WhatsApp.',
      },
    ],
    products: [
      {
        title: 'Renta de vehículos',
        description: 'Vehículos modernos y seguros para moverte con comodidad y sin complicaciones.',
        image_url: '/assets/rentaord/rentao-car-01.png',
      },
      {
        title: 'Servicio ejecutivo',
        description: 'Opciones de movilidad para necesidades ejecutivas, familiares o de viaje.',
        image_url: '/assets/rentaord/rentao-car-02.png',
      },
    ],
    contact: {
      whatsapp: '18096000000',
      email: null,
      phone: null,
      hours: null,
      address: 'C/2da no.61 Jardines del sur, Santo Domingo, Dominican Republic 11105',
      map_url: 'https://www.google.com/maps/search/?api=1&query=C%2F2da%20no.61%20Jardines%20del%20sur%20Santo%20Domingo',
    },
  },
}

export function getFallbackProfileSeo(slug?: string | null): ProfileSeoPayload | null {
  const key = String(slug || '').toLowerCase().trim()
  const profile = fallbackProfiles[key]

  if (!profile) return null

  return buildProfileSeo(profile)
}

export function getFallbackProfileData(slug?: string | null): SeoPublicProfile | null {
  const key = String(slug || '').toLowerCase().trim()
  return fallbackProfiles[key] || null
}
