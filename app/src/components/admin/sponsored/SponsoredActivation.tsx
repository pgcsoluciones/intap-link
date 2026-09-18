import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { apiGet, apiPost } from '../../../lib/api'

const KEY='kawvo_sponsored_public_code'
const PANEL_KEY='kawvo_sponsored_panel_resume'
const CONSENT_VERSION='sponsored-v1.1-2026-09-17'

export default function SponsoredActivation(){
  const navigate=useNavigate(); const [params]=useSearchParams()
  const [loading,setLoading]=useState(true); const [error,setError]=useState(''); const [sponsor,setSponsor]=useState<any>(null); const [label,setLabel]=useState('Llavero Kawvo'); const [accepted,setAccepted]=useState(false)
  const code=String(params.get('public_code')||sessionStorage.getItem(KEY)||localStorage.getItem(KEY)||'').trim().toUpperCase()

  function enterSponsoredPanel(nextUrl='/admin/sponsored'){
    sessionStorage.removeItem(KEY);localStorage.removeItem(KEY)
    sessionStorage.setItem(PANEL_KEY,'1');localStorage.setItem(PANEL_KEY,'1')
    navigate(nextUrl,{replace:true})
  }

  useEffect(()=>{if(!code){setError('No encontramos el código de este producto.');setLoading(false);return}sessionStorage.setItem(KEY,code);localStorage.setItem(KEY,code);let alive=true;(async()=>{try{const me:any=await apiGet('/me').catch(()=>({ok:false}));if(!me?.ok){window.location.assign(`/admin/login?activation=sponsored&public_code=${encodeURIComponent(code)}`);return}const status:any=await apiPost('/public/artifacts/scan/status',{public_code:code});if(!alive)return;if(!status?.ok){setError(status?.error||'No pudimos validar este producto.');return}setSponsor(status.sponsor||null);setLabel(status.artifact?.label||'Producto Kawvo');if(status.state==='activated'&&status.next_url){sessionStorage.removeItem(KEY);localStorage.removeItem(KEY);window.location.replace(status.next_url);return}if(status.state==='sponsored_draft_owner'&&status.next_url){enterSponsoredPanel();return}if(status.state!=='sponsored_pending_activation'){setError(status.message||'Este producto no está disponible para activación.')}}catch{if(alive)setError('No pudimos validar este producto.')}finally{if(alive)setLoading(false)}})();return()=>{alive=false}},[code,navigate])

  async function activate(){if(!accepted){setError('Confirma que estás de acuerdo para continuar.');return}setLoading(true);setError('');try{const json:any=await apiPost('/me/sponsored-profile/claim',{public_code:code,consent_accepted:true,consent_version:CONSENT_VERSION});if(!json?.ok){if(json?.code==='sponsored_account_already_linked'&&json?.data?.next_url){enterSponsoredPanel(String(json.data.next_url));return}setError(json?.error||'No pudimos activar este producto.');return}enterSponsoredPanel(String(json.data?.next_url||'/admin/sponsored'))}catch{setError('No pudimos completar la activación.')}finally{setLoading(false)}}

  const sponsorName=sponsor?.name||'tu patrocinador'
  return <main className="min-h-screen bg-[#f7f9fc] px-5 py-8 font-['Inter'] text-slate-950"><section className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-[460px] flex-col justify-center"><div className="rounded-[30px] border border-slate-200 bg-white p-6 text-center shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
    {sponsor?.logo_url?<img src={sponsor.logo_url} alt={sponsor.name||'Patrocinador'} className="mx-auto mb-5 max-h-16 max-w-[180px] object-contain"/>:<p className="text-[11px] font-black uppercase tracking-[.22em] text-cyan-600">KAWVO LINK</p>}
    <h1 className="mt-3 text-[28px] font-black tracking-[-.04em]">Impulsamos tu crecimiento digital</h1>
    <p className="mt-3 text-[15px] leading-6 text-slate-500">{sponsor?.name?`${sponsor.name} te entrega esta herramienta para ayudarte a presentar mejor tu trabajo y fortalecer tu presencia digital.`:'Activa tu producto patrocinado y crea tu presentación profesional.'}</p>
    <div className="mt-6 rounded-2xl bg-slate-50 p-4 text-left"><p className="text-[11px] font-black uppercase tracking-[.12em] text-slate-400">Producto confirmado</p><p className="mt-1 font-black">{label}</p><p className="mt-1 text-xs text-slate-500">Código {code}</p></div>

    {!error&&<div className="mt-5 rounded-[22px] border border-cyan-100 bg-cyan-50/60 p-4 text-left"><p className="text-sm font-black text-slate-800">Antes de activar, queremos que lo tengas claro</p><p className="mt-2 text-[13px] leading-6 text-slate-600">Esta presentación digital es impulsada por <strong>{sponsorName}</strong> como una contribución a la digitalización y modernización de sus clientes y aliados.</p><p className="mt-2 text-[13px] leading-6 text-slate-600">Como parte de este beneficio, al final de tu presentación aparecerá un <strong>cintillo discreto</strong> identificando a {sponsorName} como la marca que impulsa esta iniciativa. Su finalidad es acompañar y fortalecer tu presencia digital, no competir con tu negocio.</p><p className="mt-2 text-[13px] leading-6 text-slate-600"><strong>Tu presentación y tus datos son únicamente tuyos.</strong> Tú eres el único dueño y responsable de la información que publiques y decides qué mostrar en tu perfil. <strong>{sponsorName} no tendrá acceso a tu cuenta, tus credenciales ni a los datos que administres.</strong> El cintillo solo reconoce su aporte a esta iniciativa y no le otorga control sobre tu presentación.</p><label className="mt-4 flex cursor-pointer items-start gap-3 rounded-2xl bg-white p-3"><input type="checkbox" checked={accepted} onChange={e=>setAccepted(e.target.checked)} className="mt-1 h-4 w-4 shrink-0"/><span className="text-[13px] leading-5 text-slate-700"><strong>Estoy de acuerdo</strong> con estas condiciones de patrocinio y deseo activar mi presentación digital.</span></label></div>}

    {error&&<p className="mt-4 rounded-xl bg-rose-50 px-3 py-3 text-sm font-semibold text-rose-600">{error}</p>}
    {!error&&<><button type="button" onClick={()=>void activate()} disabled={loading||!accepted} className="mt-6 w-full rounded-2xl bg-slate-950 px-4 py-4 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-35">{loading?'Preparando…':'Aceptar y activar mi llavero'}</button><p className="mt-4 text-xs leading-5 text-slate-400">Tu presentación patrocinada será permanente y podrás personalizar tus datos cuando quieras.</p></>}
  </div></section></main>
}
