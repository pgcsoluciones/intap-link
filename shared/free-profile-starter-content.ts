export type FreeStarterService = {
  title: string
  description: string
  imageAssetKey: string
}

export type FreeStarterContentPack = {
  category: string
  role: string
  bio: string
  heroLabel: string
  servicesTitle: string
  servicesDescription: string
  recommendedPalette: 'intap' | 'oceano' | 'esmeralda' | 'violeta' | 'coral' | 'grafito' | 'arena'
  services: [FreeStarterService, FreeStarterService, FreeStarterService]
}

export const FREE_PROFILE_CATEGORIES = [
  'Moda y accesorios',
  'Belleza y estética',
  'Salud y bienestar',
  'Gastronomía y alimentos',
  'Tecnología y electrónica',
  'Marketing y comunicación digital',
  'Arte, diseño y creatividad',
  'Educación y formación',
  'Construcción e ingeniería',
  'Hogar, decoración y mobiliario',
  'Mantenimiento e instalaciones técnicas',
  'Inmobiliaria y propiedades',
  'Automotriz y mecánica',
  'Comercio, retail y tiendas virtuales',
  'Servicios profesionales',
  'Turismo, viajes y hospitalidad',
  'Deportes y fitness',
  'Agropecuario y jardinería',
  'Logística, mensajería y entregas',
  'Eventos y entretenimiento',
  'Artesanía y productos hechos a mano',
  'Mascotas y animales',
  'Servicios generales',
  'Otros',
] as const

export type FreeProfileCategory = (typeof FREE_PROFILE_CATEGORIES)[number]

export const FREE_PROFILE_STARTER_CONTENT: Record<FreeProfileCategory, FreeStarterContentPack> = {
  'Moda y accesorios': {
    category: 'Moda y accesorios', role: 'Moda y accesorios', heroLabel: 'Moda, estilo y accesorios', recommendedPalette: 'coral',
    bio: 'Creamos y seleccionamos piezas para complementar tu estilo con opciones de moda, accesorios y detalles para cada ocasión.',
    servicesTitle: 'Nuestros servicios',
    servicesDescription: 'Encuentra opciones pensadas para vestir, combinar y expresar tu estilo, con atención personalizada y variedad para diferentes gustos y necesidades.',
    services: [
      { title: 'Moda y colecciones', description: 'Descubre prendas, calzado y accesorios seleccionados para diferentes estilos y ocasiones.', imageAssetKey: 'moda-01' },
      { title: 'Accesorios y complementos', description: 'Encuentra carteras, joyería, bisutería y detalles para completar tu look.', imageAssetKey: 'moda-02' },
      { title: 'Pedidos y atención', description: 'Consulta disponibilidad, tallas, colores y opciones para elegir la pieza ideal.', imageAssetKey: 'moda-03' },
    ],
  },
  'Belleza y estética': {
    category: 'Belleza y estética', role: 'Belleza y estética', heroLabel: 'Belleza y cuidado personal', recommendedPalette: 'violeta',
    bio: 'Ofrecemos servicios de belleza y cuidado personal en un ambiente profesional, cercano y pensado para que te sientas y luzcas bien.',
    servicesTitle: 'Belleza y cuidado',
    servicesDescription: 'Realzamos tu imagen con servicios de belleza, estética y cuidado personal adaptados a tu estilo, ocasión y necesidades.',
    services: [
      { title: 'Belleza y estilo', description: 'Servicios de cabello, barbería, maquillaje y cuidado para renovar tu imagen.', imageAssetKey: 'belleza-01' },
      { title: 'Uñas, cejas y pestañas', description: 'Detalles de belleza para complementar tu estilo con acabados cuidados y personalizados.', imageAssetKey: 'belleza-02' },
      { title: 'Cuidado y bienestar', description: 'Opciones de spa, cuidado facial y estética corporal para consentirte y verte mejor.', imageAssetKey: 'belleza-03' },
    ],
  },
  'Salud y bienestar': {
    category: 'Salud y bienestar', role: 'Salud y bienestar', heroLabel: 'Bienestar y cuidado', recommendedPalette: 'esmeralda',
    bio: 'Brindamos atención profesional enfocada en orientar, cuidar y acompañar a cada persona de acuerdo con sus necesidades de salud y bienestar.',
    servicesTitle: 'Cuidado y bienestar',
    servicesDescription: 'Servicios de atención y bienestar con orientación profesional, trato cercano y soluciones adaptadas a las necesidades de cada persona.',
    services: [
      { title: 'Consulta y orientación', description: 'Atención inicial para conocer tus necesidades y orientarte sobre el servicio adecuado.', imageAssetKey: 'salud-01' },
      { title: 'Cuidado y recuperación', description: 'Opciones de fisioterapia, masajes y apoyo profesional para tu bienestar y recuperación.', imageAssetKey: 'salud-02' },
      { title: 'Bienestar integral', description: 'Servicios de nutrición, psicología y terapias orientados a mejorar tu calidad de vida.', imageAssetKey: 'salud-03' },
    ],
  },
  'Gastronomía y alimentos': {
    category: 'Gastronomía y alimentos', role: 'Gastronomía y alimentos', heroLabel: 'Sabores para disfrutar', recommendedPalette: 'coral',
    bio: 'Preparamos sabores y productos para disfrutar, compartir y convertir cada pedido en una experiencia agradable y bien cuidada.',
    servicesTitle: 'Sabores y opciones',
    servicesDescription: 'Descubre nuestras opciones de alimentos, bebidas y preparaciones para pedidos diarios, celebraciones, reuniones y ocasiones especiales.',
    services: [
      { title: 'Menú y especialidades', description: 'Conoce nuestras preparaciones, bebidas, postres y opciones disponibles para disfrutar.', imageAssetKey: 'gastronomia-01' },
      { title: 'Pedidos y entregas', description: 'Realiza tu pedido y consulta disponibilidad, presentaciones y opciones de entrega.', imageAssetKey: 'gastronomia-02' },
      { title: 'Catering y celebraciones', description: 'Opciones de alimentos y postres para reuniones, actividades y ocasiones especiales.', imageAssetKey: 'gastronomia-03' },
    ],
  },
  'Tecnología y electrónica': {
    category: 'Tecnología y electrónica', role: 'Tecnología y electrónica', heroLabel: 'Tecnología para avanzar', recommendedPalette: 'oceano',
    bio: 'Ofrecemos soluciones tecnológicas para equipos, conectividad y proyectos digitales, con atención clara y soporte para cada necesidad.',
    servicesTitle: 'Soluciones tecnológicas',
    servicesDescription: 'Soluciones para equipos, redes y proyectos digitales, desde soporte y reparación hasta implementación de herramientas tecnológicas.',
    services: [
      { title: 'Soporte y reparación', description: 'Diagnóstico, mantenimiento y soporte para celulares, computadoras y equipos electrónicos.', imageAssetKey: 'tecnologia-01' },
      { title: 'Redes y configuración', description: 'Instalación y configuración de redes, dispositivos y soluciones de conectividad.', imageAssetKey: 'tecnologia-02' },
      { title: 'Desarrollo digital', description: 'Programación, desarrollo web y soluciones tecnológicas adaptadas a cada proyecto.', imageAssetKey: 'tecnologia-03' },
    ],
  },
  'Marketing y comunicación digital': {
    category: 'Marketing y comunicación digital', role: 'Marketing y comunicación digital', heroLabel: 'Comunicación que conecta', recommendedPalette: 'oceano',
    bio: 'Ayudamos a marcas y negocios a comunicar mejor, ganar presencia y conectar con su público mediante estrategias y contenidos digitales.',
    servicesTitle: 'Marketing y comunicación',
    servicesDescription: 'Estrategias de comunicación y marketing para fortalecer tu marca, mejorar tu presencia digital y conectar con las personas correctas.',
    services: [
      { title: 'Redes sociales', description: 'Gestión de redes, planificación de contenido y comunicación para mantener presencia activa.', imageAssetKey: 'marketing-01' },
      { title: 'Contenido y branding', description: 'Creación de contenido e identidad de marca para comunicar con coherencia y personalidad.', imageAssetKey: 'marketing-02' },
      { title: 'Publicidad y visibilidad', description: 'Campañas digitales, SEO y acciones orientadas a aumentar alcance y oportunidades.', imageAssetKey: 'marketing-03' },
    ],
  },
  'Arte, diseño y creatividad': {
    category: 'Arte, diseño y creatividad', role: 'Arte, diseño y creatividad', heroLabel: 'Creatividad que comunica', recommendedPalette: 'violeta',
    bio: 'Transformamos ideas en soluciones visuales y creativas que ayudan a comunicar, presentar y dar personalidad a marcas y proyectos.',
    servicesTitle: 'Soluciones creativas',
    servicesDescription: 'Servicios creativos para desarrollar identidad, contenido y piezas visuales con una presentación coherente, funcional y atractiva.',
    services: [
      { title: 'Diseño e identidad', description: 'Diseño gráfico, identidad visual y piezas que ayudan a construir una imagen reconocible.', imageAssetKey: 'arte-diseno-01' },
      { title: 'Foto, video e ilustración', description: 'Contenido visual para comunicar ideas, productos, servicios y proyectos de forma atractiva.', imageAssetKey: 'arte-diseno-02' },
      { title: 'Producción creativa', description: 'Impresión, diseño editorial, arte digital y soluciones visuales listas para utilizar.', imageAssetKey: 'arte-diseno-03' },
    ],
  },
  'Educación y formación': {
    category: 'Educación y formación', role: 'Educación y formación', heroLabel: 'Aprender para avanzar', recommendedPalette: 'oceano',
    bio: 'Acompañamos procesos de aprendizaje con formación práctica, orientación y contenidos adaptados al ritmo y objetivos de cada estudiante.',
    servicesTitle: 'Aprendizaje y formación',
    servicesDescription: 'Opciones de aprendizaje y capacitación para desarrollar conocimientos, habilidades y competencias de forma clara, práctica y cercana.',
    services: [
      { title: 'Cursos y clases', description: 'Formación en distintas áreas con contenidos organizados y acompañamiento durante el aprendizaje.', imageAssetKey: 'educacion-01' },
      { title: 'Tutorías y apoyo', description: 'Clases particulares y orientación para reforzar conocimientos y avanzar con seguridad.', imageAssetKey: 'educacion-02' },
      { title: 'Capacitación especializada', description: 'Programas técnicos, empresariales, artísticos o de idiomas adaptados a cada necesidad.', imageAssetKey: 'educacion-03' },
    ],
  },
  'Construcción e ingeniería': {
    category: 'Construcción e ingeniería', role: 'Construcción e ingeniería', heroLabel: 'Construimos soluciones', recommendedPalette: 'arena',
    bio: 'Desarrollamos soluciones para construcción, remodelación y mantenimiento de obras con planificación, seguimiento y atención a cada detalle.',
    servicesTitle: 'Construcción y proyectos',
    servicesDescription: 'Servicios para ejecutar, mejorar y supervisar proyectos de construcción, desde trabajos técnicos hasta remodelaciones y terminaciones.',
    services: [
      { title: 'Construcción y remodelación', description: 'Ejecución de obras, adecuaciones y remodelaciones para espacios residenciales y comerciales.', imageAssetKey: 'construccion-01' },
      { title: 'Supervisión y proyectos', description: 'Apoyo técnico, arquitectura y supervisión para organizar y dar seguimiento a cada etapa.', imageAssetKey: 'construccion-02' },
      { title: 'Instalaciones y acabados', description: 'Pintura, plomería, impermeabilización y terminaciones para completar tu obra.', imageAssetKey: 'construccion-03' },
    ],
  },
  'Hogar, decoración y mobiliario': {
    category: 'Hogar, decoración y mobiliario', role: 'Hogar, decoración y mobiliario', heroLabel: 'Espacios con personalidad', recommendedPalette: 'arena',
    bio: 'Creamos espacios más funcionales, cómodos y atractivos mediante soluciones de decoración, mobiliario y organización adaptadas a cada ambiente.',
    servicesTitle: 'Diseño para tus espacios',
    servicesDescription: 'Soluciones para transformar y personalizar tus espacios con diseño, decoración, mobiliario y detalles que reflejan tu estilo.',
    services: [
      { title: 'Diseño y decoración', description: 'Conceptos de interiores y ambientación para aprovechar mejor cada espacio y darle personalidad.', imageAssetKey: 'hogar-01' },
      { title: 'Mobiliario y textiles', description: 'Opciones de muebles, cortinas y tapicería para complementar funcionalidad y estilo.', imageAssetKey: 'hogar-02' },
      { title: 'Organización y paisajismo', description: 'Soluciones para ordenar, renovar y mejorar espacios interiores, exteriores y áreas verdes.', imageAssetKey: 'hogar-03' },
    ],
  },
  'Mantenimiento e instalaciones técnicas': {
    category: 'Mantenimiento e instalaciones técnicas', role: 'Mantenimiento e instalaciones técnicas', heroLabel: 'Soluciones técnicas confiables', recommendedPalette: 'grafito',
    bio: 'Brindamos soporte técnico para mantener equipos e instalaciones funcionando de forma segura, eficiente y adecuada a cada espacio.',
    servicesTitle: 'Servicios técnicos',
    servicesDescription: 'Servicios técnicos para instalar, revisar, mantener y reparar sistemas esenciales en hogares, comercios, edificios e industrias.',
    services: [
      { title: 'Mantenimiento técnico', description: 'Revisión y mantenimiento de equipos e instalaciones para conservar su buen funcionamiento.', imageAssetKey: 'mantenimiento-01' },
      { title: 'Instalaciones especializadas', description: 'Electricidad, plomería, refrigeración, aire acondicionado y otras soluciones técnicas.', imageAssetKey: 'mantenimiento-02' },
      { title: 'Diagnóstico y reparación', description: 'Evaluación de fallas y trabajos correctivos para restablecer equipos y sistemas.', imageAssetKey: 'mantenimiento-03' },
    ],
  },
  'Inmobiliaria y propiedades': {
    category: 'Inmobiliaria y propiedades', role: 'Inmobiliaria y propiedades', heroLabel: 'Encuentra tu próximo espacio', recommendedPalette: 'oceano',
    bio: 'Te acompañamos en la búsqueda, promoción y gestión de propiedades con información clara y atención durante cada etapa del proceso.',
    servicesTitle: 'Soluciones inmobiliarias',
    servicesDescription: 'Servicios inmobiliarios para comprar, vender, alquilar y administrar propiedades con orientación y seguimiento personalizado.',
    services: [
      { title: 'Venta y alquiler', description: 'Opciones de apartamentos, casas, solares y locales según tus necesidades y presupuesto.', imageAssetKey: 'inmobiliaria-01' },
      { title: 'Asesoría inmobiliaria', description: 'Acompañamiento para evaluar alternativas y avanzar con claridad en cada operación.', imageAssetKey: 'inmobiliaria-02' },
      { title: 'Gestión de propiedades', description: 'Apoyo en administración, promoción, tasación y seguimiento de inmuebles y proyectos.', imageAssetKey: 'inmobiliaria-03' },
    ],
  },
  'Automotriz y mecánica': {
    category: 'Automotriz y mecánica', role: 'Automotriz y mecánica', heroLabel: 'Cuidado para tu vehículo', recommendedPalette: 'grafito',
    bio: 'Cuidamos tu vehículo con servicios de mantenimiento, diagnóstico y atención automotriz orientados a conservar su funcionamiento y apariencia.',
    servicesTitle: 'Servicios automotrices',
    servicesDescription: 'Soluciones para mantenimiento, reparación y cuidado del vehículo, con servicios para mecánica, diagnóstico, estética y componentes.',
    services: [
      { title: 'Diagnóstico y mecánica', description: 'Revisión y reparación de sistemas mecánicos y eléctricos para detectar y corregir fallas.', imageAssetKey: 'automotriz-01' },
      { title: 'Mantenimiento preventivo', description: 'Cambio de aceite, gomas, alineación, balanceo y servicios para mantener tu vehículo al día.', imageAssetKey: 'automotriz-02' },
      { title: 'Estética y detalles', description: 'Pintura, detailing y cuidado exterior e interior para conservar una buena presentación.', imageAssetKey: 'automotriz-03' },
    ],
  },
  'Comercio, retail y tiendas virtuales': {
    category: 'Comercio, retail y tiendas virtuales', role: 'Comercio, retail y tiendas virtuales', heroLabel: 'Productos y novedades', recommendedPalette: 'intap',
    bio: 'Ofrecemos productos y atención directa para facilitar tus compras, consultas y pedidos tanto en tienda física como por canales digitales.',
    servicesTitle: 'Compra y atención',
    servicesDescription: 'Compra productos de forma práctica, consulta disponibilidad y recibe atención para encontrar la opción adecuada para tus necesidades.',
    services: [
      { title: 'Productos y novedades', description: 'Explora artículos, categorías y novedades disponibles para compra en tienda o en línea.', imageAssetKey: 'retail-01' },
      { title: 'Pedidos y compras online', description: 'Consulta precios, disponibilidad y opciones para realizar tu pedido de forma sencilla.', imageAssetKey: 'retail-02' },
      { title: 'Atención al cliente', description: 'Recibe orientación sobre productos, características, disponibilidad y formas de compra.', imageAssetKey: 'retail-03' },
    ],
  },
  'Servicios profesionales': {
    category: 'Servicios profesionales', role: 'Servicios profesionales', heroLabel: 'Experiencia a tu servicio', recommendedPalette: 'grafito',
    bio: 'Brindamos asesoría y servicios especializados para apoyar decisiones, procesos y gestiones profesionales con atención clara y organizada.',
    servicesTitle: 'Servicios especializados',
    servicesDescription: 'Soluciones profesionales para personas y empresas que necesitan orientación, gestión y acompañamiento especializado en sus procesos.',
    services: [
      { title: 'Asesoría especializada', description: 'Orientación profesional para analizar necesidades, tomar decisiones y definir próximos pasos.', imageAssetKey: 'profesionales-01' },
      { title: 'Gestión y documentación', description: 'Apoyo en procesos administrativos, fiscales, legales, contables o empresariales.', imageAssetKey: 'profesionales-02' },
      { title: 'Consultoría y seguimiento', description: 'Acompañamiento para organizar proyectos, resolver necesidades y dar continuidad a cada gestión.', imageAssetKey: 'profesionales-03' },
    ],
  },
  'Turismo, viajes y hospitalidad': {
    category: 'Turismo, viajes y hospitalidad', role: 'Turismo, viajes y hospitalidad', heroLabel: 'Descubre tu próxima experiencia', recommendedPalette: 'oceano',
    bio: 'Creamos y coordinamos experiencias para viajar, hospedarse y descubrir destinos con información, atención y opciones para cada tipo de viajero.',
    servicesTitle: 'Viajes y experiencias',
    servicesDescription: 'Opciones de alojamiento, viajes y experiencias para planificar mejor tu estadía, recorrido o próxima aventura.',
    services: [
      { title: 'Alojamiento y reservas', description: 'Consulta hoteles, apartamentos turísticos y opciones de hospedaje según tus fechas.', imageAssetKey: 'turismo-01' },
      { title: 'Excursiones y experiencias', description: 'Descubre actividades, recorridos y experiencias locales para aprovechar mejor tu destino.', imageAssetKey: 'turismo-02' },
      { title: 'Planificación y transporte', description: 'Apoyo con viajes, traslados y organización de servicios para facilitar tu experiencia.', imageAssetKey: 'turismo-03' },
    ],
  },
  'Deportes y fitness': {
    category: 'Deportes y fitness', role: 'Deportes y fitness', heroLabel: 'Movimiento y resultados', recommendedPalette: 'esmeralda',
    bio: 'Te ayudamos a mantenerte activo y avanzar hacia tus objetivos con entrenamiento, movimiento y acompañamiento adaptado a tu nivel.',
    servicesTitle: 'Entrenamiento y bienestar',
    servicesDescription: 'Programas y actividades para mejorar condición física, movilidad y bienestar mediante entrenamiento y seguimiento personalizado.',
    services: [
      { title: 'Entrenamiento personalizado', description: 'Sesiones adaptadas a tus objetivos, condición actual y ritmo de progreso.', imageAssetKey: 'fitness-01' },
      { title: 'Clases y programas', description: 'Yoga, pilates, crossfit, entrenamiento funcional y otras modalidades para mantenerte activo.', imageAssetKey: 'fitness-02' },
      { title: 'Seguimiento deportivo', description: 'Orientación y acompañamiento para organizar tu rutina y mantener constancia.', imageAssetKey: 'fitness-03' },
    ],
  },
  'Agropecuario y jardinería': {
    category: 'Agropecuario y jardinería', role: 'Agropecuario y jardinería', heroLabel: 'Soluciones para crecer', recommendedPalette: 'esmeralda',
    bio: 'Ofrecemos productos y servicios para cultivos, jardines y áreas verdes, con soluciones prácticas para cuidar y mejorar cada espacio.',
    servicesTitle: 'Campo y áreas verdes',
    servicesDescription: 'Soluciones para agricultura, jardinería y paisajismo, desde productos y plantas hasta mantenimiento y cuidado de áreas verdes.',
    services: [
      { title: 'Jardinería y paisajismo', description: 'Diseño, cuidado y mantenimiento de jardines, patios y áreas verdes.', imageAssetKey: 'agro-01' },
      { title: 'Plantas y productos', description: 'Opciones de vivero, flores, insumos y productos para cultivos y espacios verdes.', imageAssetKey: 'agro-02' },
      { title: 'Servicios agropecuarios', description: 'Apoyo para actividades agrícolas, ganaderas y mantenimiento de espacios productivos.', imageAssetKey: 'agro-03' },
    ],
  },
  'Logística, mensajería y entregas': {
    category: 'Logística, mensajería y entregas', role: 'Logística, mensajería y entregas', heroLabel: 'Movemos lo que necesitas', recommendedPalette: 'oceano',
    bio: 'Movemos paquetes, pedidos y mercancías con soluciones de entrega y transporte pensadas para conectar personas, negocios y destinos.',
    servicesTitle: 'Entregas y logística',
    servicesDescription: 'Servicios de mensajería, transporte y distribución para entregar paquetes, mercancías y pertenencias de forma organizada.',
    services: [
      { title: 'Mensajería y delivery', description: 'Recogida y entrega de documentos, pedidos y paquetes para personas y negocios.', imageAssetKey: 'logistica-01' },
      { title: 'Transporte y distribución', description: 'Movimiento de mercancías y apoyo logístico para rutas, comercios y operaciones.', imageAssetKey: 'logistica-02' },
      { title: 'Courier y mudanzas', description: 'Opciones para encomiendas, paquetería, traslados y movimientos de pertenencias.', imageAssetKey: 'logistica-03' },
    ],
  },
  'Eventos y entretenimiento': {
    category: 'Eventos y entretenimiento', role: 'Eventos y entretenimiento', heroLabel: 'Momentos para recordar', recommendedPalette: 'violeta',
    bio: 'Creamos y coordinamos experiencias para celebraciones y eventos, cuidando la ambientación, producción y detalles que hacen especial cada ocasión.',
    servicesTitle: 'Eventos y experiencias',
    servicesDescription: 'Soluciones para planificar y producir eventos con decoración, mobiliario, entretenimiento y servicios complementarios.',
    services: [
      { title: 'Organización de eventos', description: 'Planificación y coordinación de bodas, fiestas, actividades corporativas y celebraciones.', imageAssetKey: 'eventos-01' },
      { title: 'Decoración y mobiliario', description: 'Ambientación, montaje y alquiler de mobiliario para transformar cada espacio.', imageAssetKey: 'eventos-02' },
      { title: 'Producción y entretenimiento', description: 'DJ, sonido, fotografía, video y animación para completar la experiencia de tu evento.', imageAssetKey: 'eventos-03' },
    ],
  },
  'Artesanía y productos hechos a mano': {
    category: 'Artesanía y productos hechos a mano', role: 'Artesanía y productos hechos a mano', heroLabel: 'Hecho a mano con detalle', recommendedPalette: 'arena',
    bio: 'Creamos piezas hechas a mano con atención a los detalles, combinando creatividad, materiales y acabados para regalos y uso personal.',
    servicesTitle: 'Creaciones artesanales',
    servicesDescription: 'Productos artesanales y personalizados elaborados en pequeñas series o por pedido para regalar, decorar o complementar tu estilo.',
    services: [
      { title: 'Bisutería y accesorios', description: 'Aretes, collares, pulseras y piezas artesanales para complementar diferentes estilos.', imageAssetKey: 'artesania-01' },
      { title: 'Velas y jabones artesanales', description: 'Productos hechos a mano con presentaciones cuidadas para uso personal y regalos.', imageAssetKey: 'artesania-02' },
      { title: 'Regalos personalizados', description: 'Piezas en madera, cuero, tejidos, cerámica y otros materiales para cada ocasión.', imageAssetKey: 'artesania-03' },
    ],
  },
  'Mascotas y animales': {
    category: 'Mascotas y animales', role: 'Mascotas y animales', heroLabel: 'Cuidado para tus mascotas', recommendedPalette: 'esmeralda',
    bio: 'Brindamos servicios y cuidados para acompañar el bienestar, higiene y rutina de tus mascotas con atención responsable y cercana.',
    servicesTitle: 'Cuidado de mascotas',
    servicesDescription: 'Opciones para cuidar, atender y consentir a tus mascotas, desde servicios de bienestar hasta higiene, paseo y accesorios.',
    services: [
      { title: 'Cuidado y atención', description: 'Servicios de apoyo para el bienestar y cuidado cotidiano de tus mascotas.', imageAssetKey: 'mascotas-01' },
      { title: 'Higiene y peluquería', description: 'Baño, grooming y cuidado estético para mantener a tu mascota limpia y bien atendida.', imageAssetKey: 'mascotas-02' },
      { title: 'Paseo y entrenamiento', description: 'Paseos, orientación y actividades para apoyar hábitos, ejercicio y convivencia.', imageAssetKey: 'mascotas-03' },
    ],
  },
  'Servicios generales': {
    category: 'Servicios generales', role: 'Servicios generales', heroLabel: 'Soluciones para tu día a día', recommendedPalette: 'intap',
    bio: 'Resolvemos necesidades cotidianas de hogares, oficinas y negocios con servicios prácticos, responsables y adaptados a cada espacio.',
    servicesTitle: 'Soluciones prácticas',
    servicesDescription: 'Servicios de apoyo y mantenimiento para mantener espacios limpios, seguros, funcionales y bien atendidos.',
    services: [
      { title: 'Limpieza y mantenimiento', description: 'Limpieza, reparación general y apoyo para conservar tus espacios en buen estado.', imageAssetKey: 'generales-01' },
      { title: 'Fumigación y seguridad', description: 'Servicios para prevención, protección y control de condiciones que afectan tus espacios.', imageAssetKey: 'generales-02' },
      { title: 'Asistencia y cuidado', description: 'Conserjería, lavandería, asistencia doméstica y apoyo para el cuidado de personas.', imageAssetKey: 'generales-03' },
    ],
  },
  'Otros': {
    category: 'Otros', role: 'Negocio y servicios', heroLabel: 'Conoce lo que hacemos', recommendedPalette: 'intap',
    bio: 'Ofrecemos productos o servicios adaptados a necesidades específicas, con atención directa y soluciones pensadas para cada cliente.',
    servicesTitle: 'Lo que ofrecemos',
    servicesDescription: 'Conoce nuestras principales soluciones y consulta cómo podemos ayudarte de acuerdo con tu actividad, proyecto o necesidad.',
    services: [
      { title: 'Servicio principal', description: 'Conoce la solución o actividad principal que ofrecemos y cómo puede adaptarse a tu necesidad.', imageAssetKey: 'otros-01' },
      { title: 'Atención personalizada', description: 'Recibe orientación directa para evaluar opciones, disponibilidad y próximos pasos.', imageAssetKey: 'otros-02' },
      { title: 'Cotizaciones y consultas', description: 'Solicita información, precios o detalles para avanzar con tu requerimiento.', imageAssetKey: 'otros-03' },
    ],
  },
}

export const FREE_PROFILE_CATEGORY_ALIASES: Record<string, FreeProfileCategory> = {
  Gastronomía: 'Gastronomía y alimentos',
  Tecnología: 'Tecnología y electrónica',
  Educación: 'Educación y formación',
  'Arte y diseño': 'Arte, diseño y creatividad',
  'Turismo y viajes': 'Turismo, viajes y hospitalidad',
  'Construcción y hogar': 'Construcción e ingeniería',
  Automotriz: 'Automotriz y mecánica',
  Agropecuario: 'Agropecuario y jardinería',
  Retail: 'Comercio, retail y tiendas virtuales',
}

export function resolveFreeStarterContent(category?: string | null): FreeStarterContentPack {
  const requested = String(category || '').trim()
  const canonical = (FREE_PROFILE_CATEGORIES as readonly string[]).includes(requested)
    ? requested as FreeProfileCategory
    : FREE_PROFILE_CATEGORY_ALIASES[requested] || 'Otros'
  return FREE_PROFILE_STARTER_CONTENT[canonical]
}
