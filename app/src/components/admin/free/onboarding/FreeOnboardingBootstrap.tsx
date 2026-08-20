import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiGet, apiPost } from '../../../../lib/api'

function buildTemporarySlug() {
  const random = Math.random().toString(36).slice(2, 8)
  const stamp = Date.now().toString(36).slice(-6)
  return `kawvo-${stamp}-${random}`.slice(0, 32)
}

export default function FreeOnboardingBootstrap() {
  const navigate = useNavigate()
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    const prepare = async () => {
      const me: any = await apiGet('/me').catch(() => ({ ok: false }))
      if (cancelled) return
      if (!me.ok) {
        navigate('/admin/login', { replace: true })
        return
      }
      if (me.data?.profile_id) {
        navigate('/admin/artifacts/activate', { replace: true })
        return
      }

      const slug = buildTemporarySlug()
      const result: any = await apiPost('/me/profile/claim', { slug }).catch(() => ({ ok: false, error: 'No pudimos preparar tu perfil.' }))
      if (cancelled) return
      if (!result.ok) {
        setError(result.error || 'No pudimos preparar tu perfil. Intenta nuevamente.')
        return
      }

      sessionStorage.setItem('kawvo_free_shell_slug', slug)
      navigate('/admin/artifacts/activate', { replace: true })
    }

    void prepare()
    return () => { cancelled = true }
  }, [navigate])

  return (
    <main className="min-h-screen bg-[#f7f9fc] px-5 py-8 font-['Inter'] text-slate-950">
      <section className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-[430px] flex-col items-center justify-center text-center">
        <div className="w-full rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_18px_55px_rgba(15,23,42,0.08)]">
          {error ? (
            <>
              <p className="text-lg font-black">No pudimos preparar tu espacio</p>
              <p className="mt-2 text-sm leading-6 text-slate-500">{error}</p>
              <button type="button" onClick={() => window.location.reload()} className="mt-5 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-extrabold text-white">Intentar de nuevo</button>
            </>
          ) : (
            <>
              <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-cyan-500" />
              <p className="mt-5 text-lg font-black">Preparando tu espacio…</p>
              <p className="mt-2 text-sm leading-6 text-slate-500">Estamos creando un borrador técnico para vincular tu producto. Todavía no estamos construyendo tu perfil base.</p>
            </>
          )}
        </div>
      </section>
    </main>
  )
}
