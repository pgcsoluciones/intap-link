export type AycLanguage = 'es' | 'en'

export const AYC_UI = {
  es: {
    languageButton: 'English',
    gallery: 'Galería principal de A&C Dominicana',
    selectImage: 'Seleccionar imagen principal',
    viewImage: 'Ver imagen',
    whatsapp: 'Hablar por WhatsApp',
    quickActions: 'Accesos directos',
    call: 'Llamar',
    email: 'Correo',
    location: 'Ubicación',
    saveContact: 'Guardar contacto',
    aboutEyebrow: '',
    aboutTitle: 'Sobre nosotros',

    servicesEyebrow: 'Nuestros servicios',
    servicesTitle: 'Soluciones industriales',
    servicesIntro:
      'Descubre soluciones industriales diseñadas para optimizar procesos, resolver necesidades técnicas y llevar cada proyecto desde la idea hasta una ejecución eficiente y precisa.',
    industrialService: 'Servicio industrial',
    viewDetails: 'Ver detalles',
    viewAllServices: 'Ver todos los servicios',

    portfolioEyebrow: 'Portafolio de soluciones',
    allServicesTitle: 'Todos nuestros servicios',
    allServicesIntro:
      'Selecciona una solución para conocer su alcance y los servicios incluidos.',
    closeCatalog: 'Cerrar catálogo',
    closeDetail: 'Cerrar detalle',
    includedServices: 'Servicios incluidos',
    consultWhatsapp: 'Consultar por WhatsApp',
    backToServices: 'Volver a todos los servicios',

    clientsEyebrow: 'Nuestros clientes',
    clientsTitle: 'Empresas que confían en nuestro trabajo',
    clientsIntro:
      'Relaciones construidas con experiencia, capacidad técnica y soluciones que responden a las necesidades reales de cada operación.',

    capabilities: 'Nuestras capacidades',
    slideHint: 'Deslice para explorar las soluciones',

    connectBanner: '¡Conecta con A&C Dominicana!',
    connectIntro:
      'Llámanos, escríbenos o síguenos en nuestras redes:',
    phone: 'Teléfono',
    corporateEmail: 'Correo corporativo',
    website: 'Web',

    usefulInfo: 'Información útil',
    faqTitle: 'Preguntas frecuentes',

    visitUs: 'Visítenos',
    ourLocation: 'Nuestra ubicación',
    mapTitle: 'Ubicación de A&C Dominicana',
    directions: 'Cómo llegar',

    projectEyebrow: 'Hablemos de su proyecto',
    projectTitle:
      '¿Tiene una necesidad industrial que debemos evaluar?',
    projectIntro:
      'Comparta la pieza, equipo, proceso o mejora que necesita.',
    requestQuote: 'Solicitar cotización',

    footerLocation: 'Santo Domingo, Rep. Dom.',
    footerCreated: 'Perfil empresarial creado con INTAP LINK',

    requestInformation: 'Solicitar información',
    close: 'Cerrar',
    copied: 'Enlace copiado',
    share: 'Compartir',

    representedBrand: 'Marca representada',
  },

  en: {
    languageButton: 'Español',
    gallery: 'A&C Dominicana main gallery',
    selectImage: 'Select main image',
    viewImage: 'View image',
    whatsapp: 'Chat on WhatsApp',
    quickActions: 'Quick actions',
    call: 'Call',
    email: 'Email',
    location: 'Location',
    saveContact: 'Save contact',
    aboutEyebrow: '',
    aboutTitle: 'About us',

    servicesEyebrow: 'Our services',
    servicesTitle: 'Industrial solutions',
    servicesIntro:
      'Discover industrial solutions designed to optimize processes, solve technical needs, and take each project from concept to precise and efficient execution.',
    industrialService: 'Industrial service',
    viewDetails: 'View details',
    viewAllServices: 'View all services',

    portfolioEyebrow: 'Solutions portfolio',
    allServicesTitle: 'All our services',
    allServicesIntro:
      'Select a solution to learn about its scope and included services.',
    closeCatalog: 'Close catalog',
    closeDetail: 'Close details',
    includedServices: 'Included services',
    consultWhatsapp: 'Contact us on WhatsApp',
    backToServices: 'Back to all services',

    clientsEyebrow: 'Our clients',
    clientsTitle: 'Companies that trust our work',
    clientsIntro:
      'Relationships built through experience, technical capability, and solutions that respond to the real needs of each operation.',

    capabilities: 'Our capabilities',
    slideHint: 'Swipe to explore our solutions',

    connectBanner: 'Connect with A&C Dominicana!',
    connectIntro:
      'Call us, message us, or follow us on social media:',
    phone: 'Phone',
    corporateEmail: 'Corporate email',
    website: 'Website',

    usefulInfo: 'Useful information',
    faqTitle: 'Frequently asked questions',

    visitUs: 'Visit us',
    ourLocation: 'Our location',
    mapTitle: 'A&C Dominicana location',
    directions: 'Get directions',

    projectEyebrow: "Let's discuss your project",
    projectTitle:
      'Do you have an industrial requirement we should evaluate?',
    projectIntro:
      'Share the part, equipment, process, or improvement you need.',
    requestQuote: 'Request a quote',

    footerLocation: 'Santo Domingo, Dominican Republic',
    footerCreated: 'Business profile created with INTAP LINK',

    requestInformation: 'Request information',
    close: 'Close',
    copied: 'Link copied',
    share: 'Share',

    representedBrand: 'Represented brand',
  },
} as const

export const AYC_CONTENT_EN = {
  heroTitle: 'Turnkey industrial solutions',

  heroCopy:
    'Design, manufacturing, and integration to optimize your industrial processes.',

  about:
    'With more than 30 years of experience in the industrial market, A&C Dominicana develops solutions for automation, process improvement, equipment and parts supply, and industrial projects. We integrate technical design, machining, welding, equipment manufacturing, automation, and installation into comprehensive solutions.',

  whatsappMessage:
    'Hello, I viewed your INTAP LINK profile and would like information about an industrial solution.',

  socialDescription:
    'Technical design, machining, welding, equipment manufacturing, automation, and installation integrated into industrial solutions.',
}

export const AYC_SERVICE_GROUPS_EN = [
  {
    title: 'Metalworking and CNC machining',
    summary:
      'Precision manufacturing and machining of industrial parts for technical and production applications.',
    image: '/assets/aycdom/services/metalmecanica.png',
    items: [
      'CNC milling',
      'CNC turning',
      'Grinding',
      'Molds and dies',
      'Heat treatments',
      'CAD design in SolidWorks',
    ],
  },
  {
    title: 'Industrial equipment design and manufacturing',
    summary:
      'Development and construction of industrial solutions adapted to each customer’s process.',
    image: '/assets/aycdom/services/equipos-industriales.png',
    items: [
      'Conveyors and belt systems',
      'Industrial machines',
      'Fixtures',
      'Custom industrial solutions',
    ],
  },
  {
    title: 'Automation and instrumentation',
    summary:
      'Integration of control, monitoring, and instrumentation systems to optimize industrial processes.',
    image: '/assets/aycdom/services/automatizacion.png',
    items: [
      'Industrial control projects',
      'Industrial instrumentation',
      'Industrial pneumatics',
      'Weighing systems',
    ],
  },
  {
    title: 'Cutting, forming, and welding',
    summary:
      'Material transformation and metal fabrication for industrial structures, parts, and assemblies.',
    image: '/assets/aycdom/services/soldadura.png',
    items: [
      'CNC laser cutting',
      'Sheet cutting and bending',
      'Specialized welding',
      'Metal structure fabrication',
      'Industrial furniture and assemblies',
    ],
  },
  {
    title: 'Industrial maintenance and repair',
    summary:
      'Technical support services to restore, maintain, and improve equipment performance.',
    image: '/assets/aycdom/services/ayc-mantenimiento.png',
    items: [
      'Industrial machine repair',
      'Mechanical maintenance',
      'Electrical maintenance',
    ],
  },
  {
    title: 'Dust and gas control',
    summary:
      'Environmental control and particle-management solutions for industrial and construction operations.',
    image: '/assets/aycdom/services/ayc-recolector-polvo.png',
    items: [
      'Dust collectors',
      'Mist cannons',
      'Road and ground dust control',
    ],
  },
  {
    title: 'Custom parts, equipment, and components',
    summary:
      'Supply and manufacturing of commercial or custom-made industrial components.',
    image: '/assets/aycdom/services/piezas.png',
    items: [
      'Commercial parts sales',
      'Industrial machine sales',
      'Custom plastic parts',
      'Custom metal parts',
    ],
  },
]

export const AYC_FAQS_EN = [
  {
    question: 'Do you provide custom industrial work?',
    answer:
      'Yes. Each project is evaluated according to the requirement, material, process, and operating conditions.',
  },
  {
    question: 'Can you manufacture a part from an existing sample?',
    answer:
      'It depends on the condition of the sample, required tolerances, and material. Our technical team must evaluate it before confirming production.',
  },
  {
    question: 'Do you only work on large projects?',
    answer:
      'No. A&C can handle anything from a single part or specific repair to a complete machine or production line.',
  },
  {
    question: 'Do you provide installation and commissioning?',
    answer:
      'Yes, when required by the project scope. Installation and commissioning are defined as part of the technical proposal.',
  },
]
