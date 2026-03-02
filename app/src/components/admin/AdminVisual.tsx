import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiGet, apiPatch } from '../../lib/api'

const PRESET_COLORS = [
  { label: 'Azul eléctrico', value: '#3B82F6' },
  { label: 'Cyan',           value: '#06B6D4' },
  { label: 'Verde menta',    value: '#10B981' },
  { label: 'Violeta',        value: '#8B5CF6' },
  { label: 'Fucsia',         value: '#EC4899' },
  { label: 'Naranja',        value: '#F97316' },
  { label: 'Rojo',           value: '#EF4444' },
  { label: 'Dorado',         value: '#EAB308' },
]

const BUTTON_STYLES = [
  { value: 'rounded', label: 'Redondeado',  preview: 'rounded-xl' },
  { value: 'pill',    label: 'Píldora',     preview: 'rounded-full' },
  { value: 'square',  label: 'Cuadrado',    preview: 'rounded-none' },
  { value: 'outline', label: 'Borde',       preview: 'rounded-xl' },
]

export default function AdminVisual() {
  const [accentColor, setAccentColor] = useState('#3B82F6')
  const [buttonStyle, setButtonStyle] = useState('rounded')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    apiGet('/me/').then((json: any) => {
      // Fetch visual settings from the public profile endpoint
      // We'll also expose them via /me endpoint (future) - for now use default
      setLoading(false)
    })
  }, [])

  const save = async () => {
    setSaving(true)
    const json: any = await apiPatch('/me/profile/visual', {
      accent_color: accentColor,
      button_style: buttonStyle,
    })
    if (json.ok) setSaved(true)
    setSaving(false)
  }

  if (loading) return (
    <div className="min-h-screen bg-intap-dark flex items-center justify-center">
      <div className="loading-spinner" />
    </div>
  )

  return (
    <div className="min-h-screen bg-intap-dark text-white font-['Inter'] flex flex-col items-center py-10 px-4">
      <div className="w-full max-w-lg">
        <header className="flex items-center gap-4 mb-8">
          <Link to="/admin" className="text-slate-400 hover:text-white transition-colors">←</Link>
          <h1 className="text-xl font-black">Configuración visual</h1>
        </header>

        {/* Color accent */}
        <div className="glass-card p-5 mb-5">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-4">Color principal</p>
          <div className="grid grid-cols-4 gap-3 mb-4">
            {PRESET_COLORS.map((c) => (
              <button
                key={c.value}
                onClick={() => { setAccentColor(c.value); setSaved(false) }}
                title={c.label}
                className="relative w-full aspect-square rounded-xl transition-transform hover:scale-105"
                style={{ backgroundColor: c.value }}
              >
                {accentColor === c.value && (
                  <span className="absolute inset-0 flex items-center justify-center text-white font-black text-lg">
                    ✓
                  </span>
                )}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <label className="text-xs text-slate-400">Color personalizado:</label>
            <input
              type="color"
              value={accentColor}
              onChange={(e) => { setAccentColor(e.target.value); setSaved(false) }}
              className="w-10 h-10 rounded-lg border border-white/20 bg-transparent cursor-pointer"
            />
            <span className="text-xs font-mono text-slate-300">{accentColor}</span>
          </div>
        </div>

        {/* Button style */}
        <div className="glass-card p-5 mb-8">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-4">Estilo de botones</p>
          <div className="grid grid-cols-2 gap-3">
            {BUTTON_STYLES.map((s) => (
              <button
                key={s.value}
                onClick={() => { setButtonStyle(s.value); setSaved(false) }}
                className={`p-4 border-2 transition-colors ${
                  buttonStyle === s.value
                    ? 'border-intap-blue bg-intap-blue/10'
                    : 'border-white/10 hover:border-white/30'
                }`}
                style={{ borderRadius: s.value === 'pill' ? '9999px' : s.value === 'square' ? '4px' : '12px' }}
              >
                <div
                  className="w-full py-2 text-xs font-bold text-center mb-2"
                  style={{
                    backgroundColor: accentColor + (s.value === 'outline' ? '20' : 'FF'),
                    color: s.value === 'outline' ? accentColor : '#fff',
                    border: s.value === 'outline' ? `2px solid ${accentColor}` : 'none',
                    borderRadius: s.value === 'pill' ? '9999px' : s.value === 'square' ? '2px' : '8px',
                  }}
                >
                  Mi link
                </div>
                <p className="text-xs text-slate-400">{s.label}</p>
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={save}
          disabled={saving}
          className="w-full bg-gradient-to-r from-intap-blue to-purple-600 text-white font-bold py-3 rounded-xl text-sm disabled:opacity-50"
        >
          {saving ? 'Guardando…' : saved ? '✓ Guardado' : 'Guardar configuración'}
        </button>
      </div>
    </div>
  )
}
