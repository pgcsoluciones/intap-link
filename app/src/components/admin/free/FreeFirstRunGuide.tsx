import { useNavigate } from 'react-router-dom'
export type FreePublicationReadiness={ready:boolean;missing:string[];steps:{identifier:boolean;identity:boolean;photo:boolean;hero:boolean;contact:boolean;quick_actions:boolean;portfolio:boolean;services:boolean};counts?:{quick_actions?:number;portfolio?:number;services?:number}}
const STEPS=[
  {key:'identifier' as const,title:'Usuario',text:'Elige la dirección pública de tu perfil.',to:'/admin/free/onboarding/identity?from=panel'},
  {key:'identity' as const,title:'Nombre y cargo',text:'Confirma cómo apareces y a qué te dedicas.',to:'/admin/free/onboarding/identity?from=panel'},
  {key:'photo' as const,title:'Foto de perfil',text:'Usa una foto real que te identifique.',to:'/admin/free/onboarding/identity?from=panel'},
  {key:'hero' as const,title:'Portada',text:'Personaliza la imagen principal de tu presentación.',to:'/admin/free/onboarding/identity?from=panel'},
]
export default function FreeFirstRunGuide({readiness}:{readiness:FreePublicationReadiness}){
 const navigate=useNavigate(); const complete=STEPS.filter(x=>readiness.steps[x.key]).length; const pct=Math.round(complete/STEPS.length*100)
 return <section className={`rounded-[26px] border p-5 shadow-sm ${readiness.ready?'border-emerald-200 bg-emerald-50':'border-slate-200 bg-white'}`}><p className="text-[11px] font-black uppercase tracking-[0.16em] text-cyan-700">Requisitos para publicar</p><h2 className="mt-1 text-lg font-black">{readiness.ready?'Ya puedes publicar tu perfil':`Completa lo indispensable · ${pct}%`}</h2><div className="mt-4 grid gap-2">{STEPS.map(x=><button key={x.key} type="button" onClick={()=>navigate(x.to)} className={`flex w-full items-center gap-3 rounded-2xl border p-3.5 text-left ${readiness.steps[x.key]?'border-emerald-200 bg-emerald-50':'border-amber-200 bg-amber-50'}`}><span>{readiness.steps[x.key]?'✓':'○'}</span><span><strong className="block text-sm">{x.title}</strong><small className="text-slate-500">{x.text}</small></span></button>)}</div><p className="mt-4 text-xs leading-5 text-slate-500">Descripción, contacto adicional, botones, servicios, portafolio, ubicación y enlaces pueden editarse después y no bloquean la publicación.</p></section>
}
