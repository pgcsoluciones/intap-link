import { useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'

type HelpEntry = { title: string; intro: string; points: string[] }

const HELP: Array<{ match: (path: string) => boolean; entry: HelpEntry }> = [
  { match: (p) => p === '/admin/free/identifier', entry: { title: 'Tu identificador', intro: 'Es la parte corta y única de tu enlace público.', points: ['Elige algo corto y fácil de recordar.', 'Evita espacios y caracteres difíciles.', 'Cuando lo reserves, compártelo como tu dirección digital.'] } },
  { match: (p) => p === '/admin/free/style', entry: { title: 'Plantilla y estilo', intro: 'Aquí decides cómo se presenta tu perfil.', points: ['Impacto usa una portada visual.', 'Personal da más protagonismo a tu imagen.', 'Esencial es más limpio y directo.', 'Los colores cambian la apariencia, no tu contenido.'] } },
  { match: (p) => p.includes('/onboarding/identity'), entry: { title: 'Tu información principal', intro: 'Es lo primero que una persona debe entender de ti.', points: ['Usa tu nombre o el nombre real de tu negocio.', 'Reemplaza la imagen starter por una imagen tuya.', 'Describe en pocas palabras qué haces y para quién.'] } },
  { match: (p) => p.includes('/onboarding/contact'), entry: { title: 'Datos de contacto', intro: 'Define cómo quieres que las personas te contacten.', points: ['Cambia los datos de ejemplo por los reales.', 'WhatsApp o teléfono son suficientes para comenzar.', 'El correo es opcional si no lo usas con clientes.'] } },
  { match: (p) => p === '/admin/free/quick-actions', entry: { title: 'Botones rápidos', intro: 'Son accesos de un toque que aparecen cerca de la parte superior.', points: ['Elige hasta 3.', 'Prioriza las acciones que realmente quieres recibir.', 'Llamar, Instagram y Ubicación suelen funcionar bien para negocios locales.'] } },
  { match: (p) => p === '/admin/free/location', entry: { title: 'Ubicación', intro: 'Ayuda a que tus clientes sepan dónde encontrarte.', points: ['Escribe una dirección clara.', 'Configura el mapa si tienes un local o punto de atención.', 'Si trabajas de forma remota puedes omitirla.'] } },
  { match: (p) => p === '/admin/free/links', entry: { title: 'Enlaces importantes', intro: 'Añade destinos que complementen tu perfil.', points: ['Puedes usar catálogo, formulario, página web u otra red.', 'Pon nombres fáciles de entender.', 'No repitas enlaces que ya están como botón rápido.'] } },
  { match: (p) => p === '/admin/free/portfolio', entry: { title: 'Mis trabajos', intro: 'Esta sección muestra visualmente lo que haces.', points: ['Reemplaza las imágenes starter por trabajos reales.', 'Usa fotos claras y relacionadas con tu actividad.', 'Puedes ajustar el encuadre de cada imagen.'] } },
  { match: (p) => p === '/admin/free/services', entry: { title: 'Servicios', intro: 'Explica las principales cosas que vendes o realizas.', points: ['Usa un título sencillo.', 'Describe el beneficio o lo que incluye.', 'Agrega una imagen real de cada servicio antes de publicar.'] } },
  { match: (p) => p === '/admin/artifacts', entry: { title: 'Productos Kawvo', intro: 'Aquí ves los productos físicos NFC/QR relacionados con tu cuenta.', points: ['Un producto activado puede apuntar a tu perfil.', 'No compartas tu código de activación.', 'Si necesitas ayuda con un producto, usa Soporte Kawvo en tu panel.'] } },
  { match: (p) => p === '/admin/free', entry: { title: 'Tu panel', intro: 'Desde aquí completas tu perfil paso a paso.', points: ['Empieza por reservar tu identificador.', 'Los signos ? explican cada sección.', 'Tu perfil seguirá como borrador hasta completar los datos mínimos.'] } },
]

export default function FreeContextHelp() {
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const help = useMemo(() => HELP.find((item) => item.match(location.pathname))?.entry || null, [location.pathname])

  if (!help || !location.pathname.startsWith('/admin/')) return null

  return (
    <div className="fixed bottom-5 right-5 z-[90] font-['Inter']">
      {open && (
        <section className="mb-3 w-[min(320px,calc(100vw-40px))] rounded-[22px] border border-slate-200 bg-white p-4 shadow-2xl" role="dialog" aria-label={`Ayuda: ${help.title}`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-600">Ayuda rápida</p>
              <h2 className="mt-1 text-base font-black text-slate-950">{help.title}</h2>
            </div>
            <button type="button" onClick={() => setOpen(false)} className="rounded-full bg-slate-100 px-2.5 py-1.5 text-xs font-black text-slate-500">×</button>
          </div>
          <p className="mt-2 text-xs leading-5 text-slate-600">{help.intro}</p>
          <ul className="mt-3 space-y-2 text-xs leading-5 text-slate-600">
            {help.points.map((point) => <li key={point} className="flex gap-2"><span className="font-black text-cyan-600">✓</span><span>{point}</span></li>)}
          </ul>
        </section>
      )}
      <button type="button" onClick={() => setOpen((current) => !current)} className="ml-auto flex h-12 items-center gap-2 rounded-full bg-slate-950 px-4 text-sm font-black text-white shadow-xl" aria-expanded={open}>
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-cyan-500">?</span>
        <span>Ayuda</span>
      </button>
    </div>
  )
}
