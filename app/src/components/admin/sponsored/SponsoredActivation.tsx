import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { apiGet, apiPost } from '../../../lib/api'

const KEY='kawvo_sponsored_public_code'

export default function SponsoredActivation(){
  const navigate=useNavigate(); const [params]=useSearchParams()
  const [loading,setLoading]=useState(true); const [error,setError]=useState(''); const [sponsor,setSponsor]=useState<any>(null); const [label,setLabel]=useState('Llavero Kawvo')
  const code=String(params.get('public_code')||sessionStorage.getItem(KEY)||localStorage.getItem(KEY)||'').trim().toUpperCase()

  useEffect(()=>{if(!code){setError('No encontramos el código de este producto.');setLoading(false);return}sessionStorage.setItem(KEY,code);localStorage.setItem(KEY,code);let alive=true;(async()=>{try{const me:any=await apiGet('/me').catch(()=>({ok:false}));if(!me?.ok){window.location.assign(`/admin/login?activation=sponsored&public_code=${encodeURIComponent(code)}`);return}const status:any=await apiPost('/public/artifacts/scan/status',{public_code:code});if(!alive)return;if(!status?.ok){setError(status?.error||'No pudimos validar este producto.');return}setSponsor(status.sponsor||null);setLabel(status.artifact?.label||'Producto Kawvo');if(status.state==='activated'&&status.next_url){window.location.replace(status.next_url);return}if(status.state==='sponsored_draft_owner'&&status.next_url){navigate('/admin/sponsored',{replace:true});return}if(status.state!=='sponsored_pending_activation'){setError(status.message||'Este producto no está disponible para activación.')}}catch{if(alive)setError('No pudimos validar este producto.')}finally{if(alive)setLoading(false)}})();return()=>{alive=false}},[code,navigate])

  async function activate(){setLoading(true);setError('');try{const json:any=await apiPost('/me/sponsored-profile/claim',{public_code:code});if(!json?.ok){setError(json?.error||'No pudimos activar este producto.');return}sessionStorage.removeItem(KEY);localStorage.removeItem(KEY);navigate('/admin/sponsored',{replace:true})}catch{setError('No pudimos completar la activación.')}finally{setLoading(false)}}

  return <main className="min-h-screen bg-[#f7f9fc] px-5 py-8 font-['Inter'] text-slate-950"><section className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-[440px] flex-col justify-center"><div className="rounded-[30px] border border-slate-200 bg-white p-6 text-center shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
    {sponsor?.logo_url?<img src={sponsor.logo_url} alt={sponsor.name||'Patrocinador'} className="mx-auto mb-5 max-h-16 max-w-[180px] object-contain"/>:<p className="text-[11px] font-black uppercase tracking-[.22em] text-cyan-600">KAWVO LINK</p>}
    <h1 className="mt-3 text-[28px] font-black tracking-[-.04em]">Impulsamos tu crecimiento digital</h1>
    <p className="mt-3 text-[15px] leading-6 text-slate-500">{sponsor?.name?`${sponsor.name} te entrega esta herramienta para que presentes mejor tu trabajo.`:'Activa tu producto patrocinado y crea tu presentación profesional.'}</p>
    <div className="mt-6 rounded-2xl bg-slate-50 p-4 text-left"><p className="text-[11px] font-black uppercase tracking-[.12em] text-slate-400">Producto confirmado</p><p className="mt-1 font-black">{label}</p><p className="mt-1 text-xs text-slate-500">Código {code}</p></div>
    {error&&<p className="mt-4 rounded-xl bg-rose-50 px-3 py-3 text-sm font-semibold text-rose-600">{error}</p>}
    {!error&&<><button type="button" onClick={()=>void activate()} disabled={loading} className="mt-6 w-full rounded-2xl bg-slate-950 px-4 py-4 text-sm font-black text-white disabled:opacity-40">{loading?'Preparando…':'Activar ahora mi llavero'}</button><p className="mt-4 text-xs leading-5 text-slate-400">Tu presentación patrocinada es permanente y podrás personalizar tus datos.</p></>}
  </div></section></main>
}
