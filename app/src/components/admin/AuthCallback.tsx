import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

const API_BASE = `${import.meta.env.VITE_API_URL ?? ''}/api/v1`

export default function AuthCallback() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [error, setError] = useState('')

  useEffect(() => {
    const token = searchParams.get('token')
    if (!token) {
      setError('Enlace inválido: falta el token')
      return
    }

    fetch(`${API_BASE}/auth/magic-link/verify?token=${encodeURIComponent(token)}`, {
      credentials: 'include',
    })
      .then((res) => res.json())
      .then((json: any) => {
        if (json.ok) {
          navigate('/admin', { replace: true })
        } else {
          setError(json.error || 'Enlace inválido o expirado')
        }
      })
      .catch(() => setError('Error de conexión. Inténtalo de nuevo.'))
  }, [navigate, searchParams])

  if (error) {
    return (
      <div className="min-h-screen bg-intap-dark flex items-center justify-center px-4 font-['Inter']">
        <div className="w-full max-w-sm text-center">
          <div className="text-5xl mb-4">❌</div>
          <h1 className="text-xl font-black mb-2">Enlace inválido</h1>
          <p className="text-sm text-slate-400 mb-6">{error}</p>
          <a
            href="/admin/login"
            className="inline-block bg-gradient-to-r from-intap-blue to-purple-600 text-white font-bold py-2.5 px-6 rounded-xl text-sm"
          >
            Solicitar nuevo enlace
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-intap-dark flex items-center justify-center">
      <div className="loading-spinner" />
    </div>
  )
}
