import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiGet } from '../../../lib/api'

export default function TeamPermissionGuard({ permission, children }: { permission: string | string[]; children: React.ReactNode }) {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [allowed, setAllowed] = useState(true)
  const [masterName, setMasterName] = useState('')

  useEffect(() => {
    apiGet('/me/team/context').then((json: any) => {
      if (!json?.ok || json.data?.role !== 'member') { setAllowed(true); return }
      const permissions: string[] = json.data?.member?.permissions || []
      const required = Array.isArray(permission) ? permission : [permission]
      setAllowed(required.some((key) => permissions.includes(key)))
      setMasterName(String(json.data?.member?.master_name || 'perfil master'))
    }).catch(() => setAllowed(true)).finally(() => setLoading(false))
  }, [permission])

  if (loading) return <main className="min-h-screen bg-[#f7f9fc] flex items-center justify-center"><div className="loading-spinner" /></main>
  if (allowed) return <>{children}</>

  return <main className="min-h-screen bg-[#f7f9fc] px-5 py-8 font-['Inter'] text-slate-950"><section className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-[430px] flex-col justify-center"><div className="rounded-[28px] border border-slate-200 bg-slate-100 p-6 text-center"><div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-slate-200 text-xl">🔒</div><h1 className="mt-4 text-xl font-black">Opción administrada por el Team</h1><p className="mt-2 text-sm leading-6 text-slate-500">{masterName} administra esta sección. No está habilitada para edición en tu perfil.</p><button type="button" onClick={() => navigate('/admin/free')} className="mt-5 w-full rounded-2xl bg-slate-950 px-4 py-4 text-sm font-black text-white">Volver a mi perfil</button></div></section></main>
}
