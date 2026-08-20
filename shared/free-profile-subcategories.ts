export const FREE_PROFILE_SUBCATEGORIES: Record<string, readonly string[]> = {
  'Moda y accesorios': ['Ropa', 'Calzado', 'Carteras', 'Joyería', 'Bisutería', 'Accesorios', 'Ropa deportiva', 'Moda infantil', 'Moda masculina', 'Moda femenina'],
  'Belleza y estética': ['Salón de belleza', 'Barbería', 'Uñas', 'Maquillaje', 'Pestañas', 'Cejas', 'Spa', 'Cuidado facial', 'Peluquería', 'Estética corporal'],
  'Salud y bienestar': ['Consultorio médico', 'Odontología', 'Psicología', 'Nutrición', 'Fisioterapia', 'Masajes', 'Terapias alternativas', 'Bienestar integral'],
  'Gastronomía y alimentos': ['Restaurante', 'Cafetería', 'Repostería', 'Postres', 'Pastelería', 'Panadería', 'Catering', 'Comida rápida', 'Comida criolla', 'Productos alimenticios'],
  'Tecnología y electrónica': ['Reparación de celulares', 'Computadoras', 'Accesorios tecnológicos', 'Soporte técnico', 'Redes', 'Programación', 'Desarrollo web', 'Electrónica'],
  'Marketing y comunicación digital': ['Community manager', 'Redes sociales', 'Publicidad digital', 'Creación de contenido', 'SEO', 'Branding', 'Relaciones públicas'],
  'Arte, diseño y creatividad': ['Diseñador gráfico', 'Identidad visual', 'Ilustración', 'Fotografía', 'Video', 'Impresión', 'Diseño editorial', 'Diseño web', 'Arte digital'],
  'Educación y formación': ['Tutorías', 'Cursos', 'Idiomas', 'Música', 'Capacitación empresarial', 'Formación técnica', 'Educación artística', 'Clases particulares'],
  'Construcción e ingeniería': ['Constructora', 'Ingeniería civil', 'Arquitectura', 'Contratista', 'Supervisión de obras', 'Remodelación', 'Impermeabilización', 'Pintura', 'Plomería'],
  'Hogar, decoración y mobiliario': ['Decorador', 'Diseño de interiores', 'Decoración de eventos', 'Muebles', 'Cortinas', 'Tapicería', 'Organización de espacios', 'Paisajismo'],
  'Mantenimiento e instalaciones técnicas': ['Multiservicios técnicos', 'Electricidad', 'Refrigeración', 'Aire acondicionado', 'Plomería', 'Mantenimiento industrial', 'Ascensores', 'Plantas eléctricas', 'Paneles solares'],
  'Inmobiliaria y propiedades': ['Inmobiliaria', 'Venta de propiedades', 'Alquileres', 'Administración de inmuebles', 'Tasación', 'Proyectos inmobiliarios', 'Apartamentos', 'Solares', 'Locales comerciales'],
  'Automotriz y mecánica': ['Mecánico', 'Taller automotriz', 'Electricidad automotriz', 'Diagnóstico', 'Cambio de aceite', 'Gomas', 'Alineación y balanceo', 'Pintura', 'Detailing', 'Repuestos'],
  'Comercio, retail y tiendas virtuales': ['Tienda física', 'Tienda virtual', 'Ventas online', 'Supermercado', 'Boutique', 'Ferretería', 'Librería', 'Tienda de regalos', 'Productos especializados'],
  'Servicios profesionales': ['Contabilidad', 'Abogados', 'Consultoría', 'Recursos humanos', 'Seguros', 'Asesoría empresarial', 'Servicios fiscales', 'Traducción', 'Servicios administrativos'],
  'Turismo, viajes y hospitalidad': ['Hotel', 'Apartamento turístico', 'Airbnb', 'Agencia de viajes', 'Excursiones', 'Guía turístico', 'Transporte turístico', 'Experiencias locales'],
  'Deportes y fitness': ['Gimnasio', 'Entrenador personal', 'Yoga', 'Pilates', 'Crossfit', 'Deportes', 'Nutrición deportiva', 'Entrenamiento funcional', 'Actividades recreativas'],
  'Agropecuario y jardinería': ['Agricultura', 'Vivero', 'Jardinería', 'Paisajismo', 'Productos agrícolas', 'Ganadería', 'Floristería', 'Mantenimiento de áreas verdes'],
  'Logística, mensajería y entregas': ['Mensajero', 'Delivery', 'Última milla', 'Transporte de mercancías', 'Paquetería', 'Mudanzas', 'Courier', 'Distribución', 'Encomiendas'],
  'Eventos y entretenimiento': ['Organización de eventos', 'Decoración de fiestas', 'Alquiler de mobiliario', 'DJ', 'Fotografía de eventos', 'Animación', 'Sonido', 'Bodas y celebraciones'],
  'Artesanía y productos hechos a mano': ['Bisutería artesanal', 'Velas', 'Jabones artesanales', 'Tejidos', 'Madera', 'Cuero', 'Cerámica', 'Manualidades', 'Regalos personalizados'],
  'Mascotas y animales': ['Veterinaria', 'Peluquería canina', 'Entrenamiento', 'Cuidado de mascotas', 'Paseo de perros', 'Accesorios y alimentos'],
  'Servicios generales': ['Limpieza', 'Fumigación', 'Seguridad', 'Conserjería', 'Reparación general', 'Lavandería', 'Cuidado de personas', 'Asistencia doméstica'],
  'Otros': ['Actividad personalizada'],
}

export function resolveFreeSubcategories(category?: string | null): readonly string[] {
  return FREE_PROFILE_SUBCATEGORIES[String(category || '').trim()] || FREE_PROFILE_SUBCATEGORIES.Otros
}
