import {
  FREE_PROFILE_LIMITS,
  type FreeProfileAppearanceColors,
  type FreeProfileData,
} from './IntapLinkGratis.types'

export const DEMO_APPEARANCE_COLORS: FreeProfileAppearanceColors = {
  primary: '#071f5f',
  secondary: '#0b61c9',
  accent: '#07966a',
  button: '#10b981',
  background: '#eaf0f7',
  surface: '#ffffff',
  text: '#11213d',
  heroGradient: '#071f5f',
}

export const DEMO_PROFILE: FreeProfileData = {
  id: 'demo-maria-perez',
  slug: 'maria-perez',
  name: 'María Pérez',
  role: 'Asesora Inmobiliaria',
  personalBadge: 'Marca personal',
  aboutTitle: 'Hagamos que tu próximo paso sea más sencillo.',
  bio:
    'Ayudo a personas y familias a encontrar propiedades que se adapten a sus planes, necesidades y presupuesto.',
  phone: '18095550199',
  whatsappGreetingName: 'María',
  whatsappCtaLabel: 'Escríbeme por WhatsApp',
  instagram: 'https://instagram.com/',
  location: 'https://maps.google.com/',
  portrait: '/assets/free-demo/portrait-maria.svg',
  hero: '/assets/free-demo/hero-impacto.svg',
  vcardFileName: 'maria-perez.vcf',

  services: [
    {
      id: 'compra-venta',
      title: 'Compra y venta',
      description: 'Orientación para comprar o vender propiedades.',
      image: '',
      iconKey: 'home',
    },
    {
      id: 'alquileres',
      title: 'Alquileres',
      description: 'Opciones residenciales y comerciales.',
      image: '',
      iconKey: 'key',
    },
    {
      id: 'inversion',
      title: 'Inversión',
      description: 'Alternativas con potencial de crecimiento.',
      image: '',
      iconKey: 'chart-line',
    },
    {
      id: 'asesoria',
      title: 'Asesoría',
      description: 'Acompañamiento durante todo el proceso.',
      image: '',
      iconKey: 'handshake',
    },
  ],

  portfolio: Array.from(
    {
      length: FREE_PROFILE_LIMITS.maxPortfolioImages,
    },
    (_, index) => ({
      id: `portfolio-${index + 1}`,
      title: [
        'Residencial moderno',
        'Apartamento urbano',
        'Proyecto familiar',
        'Inversión premium',
        'Vivienda contemporánea',
      ][index],
      image:
        `/assets/free-demo/portfolio/portfolio-${String(
          index + 1,
        ).padStart(2, '0')}.svg`,
    }),
  ),

  customLinks: [
    {
      id: 'catalogo',
      label: 'Ver catálogo de propiedades',
      url: 'https://example.com/catalogo',
    },
    {
      id: 'agenda',
      label: 'Agenda una consulta',
      url: 'https://example.com/agenda',
    },
    {
      id: 'proyectos',
      label: 'Proyectos disponibles',
      url: 'https://example.com/proyectos',
    },
  ],
}
