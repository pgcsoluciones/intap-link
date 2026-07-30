import { useState } from 'react'
import {
  Link,
  useParams,
} from 'react-router-dom'
import { FaPalette } from 'react-icons/fa'
import './IntapLinkGratisDemo.css'
import {
  DEMO_APPEARANCE_COLORS,
  DEMO_PROFILE,
} from './IntapLinkGratis.demo-data'
import IntapLinkGratisProfile from './IntapLinkGratisProfile'
import type {
  FreeProfileAppearanceColors,
  FreeProfileLayoutId,
} from './IntapLinkGratis.types'

type LayoutDefinition = {
  id: FreeProfileLayoutId
  name: string
  description: string
  recommendedFor: string
}

const LAYOUTS: LayoutDefinition[] = [
  {
    id: 'impacto',
    name: 'Impacto',
    description:
      'Portada hero con presencia visual y fotografía principal.',
    recommendedFor:
      'Empresas, negocios y marcas',
  },
  {
    id: 'personal',
    name: 'Personal',
    description:
      'Retrato protagonista con degradado para marca personal.',
    recommendedFor:
      'Asesores, vendedores y marca personal',
  },
  {
    id: 'esencial',
    name: 'Esencial',
    description:
      'Composición limpia sin fotografía de portada.',
    recommendedFor:
      'Perfiles rápidos y profesionales',
  },
]

const PALETTES: Array<{
  name: string
  colors: FreeProfileAppearanceColors
}> = [
  {
    name: 'INTAP',
    colors: DEMO_APPEARANCE_COLORS,
  },
  {
    name: 'Elegante',
    colors: {
      primary: '#171717',
      secondary: '#3f3f46',
      accent: '#b18a45',
      button: '#18181b',
      background: '#f1efe9',
      surface: '#ffffff',
      text: '#18181b',
      heroGradient: '#09090b',
    },
  },
  {
    name: 'Creativa',
    colors: {
      primary: '#4c1d95',
      secondary: '#7c3aed',
      accent: '#db2777',
      button: '#7c3aed',
      background: '#f5f0ff',
      surface: '#ffffff',
      text: '#2e1065',
      heroGradient: '#3b0764',
    },
  },
  {
    name: 'Natural',
    colors: {
      primary: '#12372a',
      secondary: '#436850',
      accent: '#adbc9f',
      button: '#436850',
      background: '#eef2e8',
      surface: '#ffffff',
      text: '#12372a',
      heroGradient: '#12372a',
    },
  },
]

const COLOR_FIELDS: Array<{
  key: keyof FreeProfileAppearanceColors
  label: string
}> = [
  {
    key: 'primary',
    label: 'Color principal',
  },
  {
    key: 'secondary',
    label: 'Color secundario',
  },
  {
    key: 'accent',
    label: 'Color de resaltado',
  },
  {
    key: 'button',
    label: 'Botón principal',
  },
  {
    key: 'background',
    label: 'Fondo general',
  },
  {
    key: 'surface',
    label: 'Fondo de cards',
  },
  {
    key: 'text',
    label: 'Texto principal',
  },
  {
    key: 'heroGradient',
    label: 'Degradado de imagen',
  },
]

function isLayoutId(
  value?: string,
): value is FreeProfileLayoutId {
  return (
    value === 'impacto' ||
    value === 'personal' ||
    value === 'esencial'
  )
}

function DemoGallery() {
  return (
    <main className="il-free-gallery">
      <header className="il-free-gallery__header">
        <p className="il-free-eyebrow">
          INTAP LINK GRATIS
        </p>

        <h1>Tres estilos. Un solo perfil.</h1>

        <p>
          Los mismos datos se organizan de tres maneras
          distintas. El usuario podrá cambiar de plantilla
          y colores sin volver a completar su información.
        </p>
      </header>

      <section className="il-free-gallery__grid">
        {LAYOUTS.map((layout) => (
          <Link
            key={layout.id}
            to={`/demo/intap-link-gratis/${layout.id}`}
            className={
              `il-free-preview-card ` +
              `il-free-preview-card--${layout.id}`
            }
          >
            <div className="il-free-preview-card__screen">
              <div className="il-free-preview-card__brand">
                INTAP LINK GRATIS
              </div>

              {layout.id === 'impacto' && (
                <>
                  <div className="il-free-preview-card__hero" />
                  <div className="il-free-preview-card__avatar" />
                </>
              )}

              {layout.id === 'personal' && (
                <div className="il-free-preview-card__portrait" />
              )}

              {layout.id === 'esencial' && (
                <div className="il-free-preview-card__minimal-avatar" />
              )}

              <div className="il-free-preview-card__lines">
                <span />
                <span />
                <span />
              </div>

              <div className="il-free-preview-card__button" />

              <div className="il-free-preview-card__actions">
                <i />
                <i />
                <i />
              </div>
            </div>

            <div className="il-free-preview-card__content">
              <span className="il-free-preview-card__tag">
                {layout.recommendedFor}
              </span>

              <h2>{layout.name}</h2>
              <p>{layout.description}</p>
              <strong>Ver plantilla →</strong>
            </div>
          </Link>
        ))}
      </section>

      <aside className="il-free-gallery__note">
        <strong>
          Esta fase es solamente visual.
        </strong>

        <span>
          No modifica perfiles reales, planes, D1,
          registro ni Premium.
        </span>
      </aside>
    </main>
  )
}

export default function IntapLinkGratisDemo() {
  const { layoutId } =
    useParams<{ layoutId?: string }>()

  const [appearanceOpen, setAppearanceOpen] =
    useState(false)

  const [colors, setColors] =
    useState<FreeProfileAppearanceColors>(
      DEMO_APPEARANCE_COLORS,
    )

  if (!isLayoutId(layoutId)) {
    return <DemoGallery />
  }

  const demoControls = (
    <>
      <nav
        className="il-free-demo-nav"
        aria-label="Plantillas de demostración"
      >
        <Link to="/demo/intap-link-gratis">
          ← Plantillas
        </Link>

        <div className="il-free-demo-nav__layouts">
          {LAYOUTS.map((item) => (
            <Link
              key={item.id}
              to={`/demo/intap-link-gratis/${item.id}`}
              aria-current={
                item.id === layoutId
                  ? 'page'
                  : undefined
              }
            >
              {item.name}
            </Link>
          ))}
        </div>

        <button
          type="button"
          className="il-free-appearance-trigger"
          onClick={() =>
            setAppearanceOpen(
              (current) => !current,
            )
          }
          aria-expanded={appearanceOpen}
        >
          <FaPalette />
          <span>Personalizar</span>
        </button>
      </nav>

      {appearanceOpen && (
        <aside className="il-free-appearance-panel">
          <header>
            <div>
              <strong>
                Personalizar perfil
              </strong>

              <span>
                Personaliza los colores corporativos.
              </span>
            </div>

            <button
              type="button"
              onClick={() =>
                setAppearanceOpen(false)
              }
              aria-label="Cerrar configuración"
            >
              ×
            </button>
          </header>

          <div className="il-free-palette-presets">
            {PALETTES.map((palette) => (
              <button
                key={palette.name}
                type="button"
                onClick={() =>
                  setColors(palette.colors)
                }
              >
                <i
                  style={{
                    background:
                      `linear-gradient(135deg, ` +
                      `${palette.colors.primary}, ` +
                      `${palette.colors.accent})`,
                  }}
                />

                <span>{palette.name}</span>
              </button>
            ))}
          </div>

          <div className="il-free-color-fields">
            {COLOR_FIELDS.map((field) => (
              <label key={field.key}>
                <span>{field.label}</span>

                <input
                  type="color"
                  value={colors[field.key]}
                  onChange={(event) =>
                    setColors((current) => ({
                      ...current,
                      [field.key]:
                        event.target.value,
                    }))
                  }
                />
              </label>
            ))}
          </div>
        </aside>
      )}
    </>
  )

  return (
    <IntapLinkGratisProfile
      profile={DEMO_PROFILE}
      layout={layoutId}
      colors={colors}
      topContent={demoControls}
    />
  )
}
