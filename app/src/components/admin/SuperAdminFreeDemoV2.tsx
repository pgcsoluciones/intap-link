import { useEffect, useState } from 'react'
import { apiGet, apiPost } from '../../lib/api'
import SuperAdminLayout from './SuperAdminLayout'

type Template={key:string;label:string;hint:string;category:string;role:string;bio:string;palette:string;hero_url:string;avatar_url:string;portfolio:string[]}
type Demo={id:string;template_key:string;template_label:string;status:string;published_at?:string|null;claimed_at?:string|null;claimed_by_user_id?:string|null;claimed_owner_email?:string|null;name?:string;slug?:string;is_published?:number;hero_url?:string}

export default function SuperAdminFreeDemoV2(){
  const[templates,setTemplates]=useState<Template[]>([])
  const[demos,setDemos]=useState<Demo[]>([])
  const[busy,setBusy]=useState('')
  const[message,setMessage]=useState('')
  const[claim,setClaim]=useState<any>(null)

  const load=async()=>{
    const[t,d]=await Promise.all([apiGet('/superadmin/free-demo-v2/templates'),apiGet('/superadmin/free-demo-v2')])
    if(t?.ok)setTemplates(t.data||[])
    if(d?.ok)setDemos(d.data||[])
  }
  useEffect(()=>{void load()},[])

  const useBase=async(template:Template)=>{
    setBusy(template.key);setMessage('');setClaim(null)
    try{
      const j:any=await apiPost('/superadmin/free-demo-v2',{template_key:template.key})
      if(!j?.ok){setMessage(j?.error||'No se pudo crear el borrador.');return}
      await load()
      window.open(j.data.edit_url,'_blank','noopener,noreferrer')
      setMessage('Borrador creado. La plantilla base permanece intacta.')
    }finally{setBusy('')}
  }

  const claimCode=async(demo:Demo)=>{
    setBusy(demo.id);setMessage('');setClaim(null)
    try{
      const j:any=await apiPost('/superadmin/free-demo-v2/'+encodeURIComponent(demo.id)+'/claim-code',{})
      if(j?.ok)setClaim(j.data)
      else setMessage(j?.error||'No se pudo generar el código de reclamo.')
    }finally{setBusy('')}
  }

  const web=(import.meta.env.VITE_WEB_URL||'https://intaprd.com').replace(/\/$/,'')

  return <SuperAdminLayout currentSection="freeDemos" >
    <div style={{maxWidth:1180,margin:'0 auto',display:'grid',gap:28}}>
      <header>
        <div style={{fontSize:12,fontWeight:900,letterSpacing:1.5,color:'#0891b2'}}>KAWVO LINK</div>
        <h1 style={{fontSize:32,margin:'6px 0'}}>Demos Free · Plantillas base</h1>
        <p style={{maxWidth:820,color:'#64748b',lineHeight:1.6,margin:0}}>Selecciona una base preparada por rubro. <strong>Usar plantilla base</strong> crea un perfil Free real en borrador, independiente de la base, y entrega su URL de edición. No utiliza Trial ni Perfil Patrocinado.</p>
      </header>

      {message&&<div style={{padding:14,borderRadius:16,background:'#ecfeff',color:'#0e7490',fontWeight:800}}>{message}</div>}
      {claim&&<div style={{padding:20,borderRadius:20,background:'#ecfdf5',border:'1px solid #a7f3d0'}}>
        <div style={{fontSize:12,fontWeight:900,color:'#047857',letterSpacing:1}}>RECLAMO LISTO</div>
        <h2 style={{margin:'6px 0 12px'}}>Entrega estos tres datos</h2>
        <div style={{display:'grid',gap:5}}><span>Correo especial: <strong>{claim.special_email}</strong></span><span>Slug: <strong>/{claim.slug}</strong></span><span style={{fontFamily:'monospace',fontSize:24,fontWeight:900}}>{claim.claim_code}</span></div>
        <p style={{margin:'10px 0 0',fontSize:12,color:'#64748b'}}>Código de un solo uso · 30 días.</p>
      </div>}

      <section>
        <h2 style={{fontSize:22,margin:'0 0 5px'}}>Bases Demo listas para usar</h2>
        <p style={{margin:'0 0 16px',color:'#64748b'}}>Textos, imágenes, paleta y contenido inicial salen del mismo catálogo Free de la plataforma. La base nunca se modifica al crear una Demo.</p>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(290px,1fr))',gap:14}}>
          {templates.map(template=><article key={template.key} style={{overflow:'hidden',border:'1px solid #dbe4ef',borderRadius:20,background:'#fff',boxShadow:'0 4px 16px rgba(15,23,42,.04)'}}>
            <div style={{height:150,background:'#e2e8f0'}}>{template.hero_url&&<img src={template.hero_url} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>}</div>
            <div style={{padding:17}}>
              <h3 style={{margin:0,fontSize:18}}>{template.label}</h3>
              <p style={{margin:'7px 0',fontSize:13,color:'#64748b',lineHeight:1.5}}>{template.hint}</p>
              <div style={{fontSize:11,fontWeight:900,color:'#0891b2',textTransform:'uppercase'}}>{template.category}</div>
              <button disabled={busy===template.key} onClick={()=>void useBase(template)} style={{marginTop:14,border:0,borderRadius:12,padding:'11px 14px',background:'#071f5f',color:'#fff',fontWeight:900,cursor:'pointer'}}>{busy===template.key?'Creando borrador…':'Usar plantilla base'}</button>
            </div>
          </article>)}
        </div>
      </section>

      <section>
        <h2 style={{fontSize:22,margin:'0 0 5px'}}>Borradores y presentaciones</h2>
        <p style={{margin:'0 0 16px',color:'#64748b'}}>Cada registro es una copia independiente. Edita el borrador; al final define el slug y publica.</p>
        <div style={{display:'grid',gap:10}}>
          {demos.map(demo=><article key={demo.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:16,padding:16,border:'1px solid #dbe4ef',borderRadius:18,background:'#fff'}}>
            <div style={{display:'flex',gap:13,alignItems:'center',minWidth:0}}>
              {demo.hero_url&&<img src={demo.hero_url} alt="" style={{width:74,height:56,objectFit:'cover',borderRadius:12}}/>}
              <div style={{minWidth:0}}><strong style={{display:'block'}}>{demo.name||demo.template_label}</strong><span style={{fontSize:12,color:'#64748b'}}>{demo.template_label} · {demo.status}{demo.published_at?' · /'+demo.slug:''}</span>{demo.status==='claimed'&&<span style={{display:'block',marginTop:4,fontSize:12,color:'#047857',fontWeight:800}}>Reclamada por {demo.claimed_owner_email||'usuario verificado'}{demo.claimed_at?' · '+new Date(demo.claimed_at).toLocaleDateString():''}</span>}</div>
            </div>
            <div style={{display:'flex',gap:8,flexWrap:'wrap',justifyContent:'flex-end'}}>
              {demo.status!=='claimed'&&<a href={web+'/free-demo/edit/'+demo.id} target="_blank" rel="noreferrer" style={{padding:'9px 12px',border:'1px solid #cbd5e1',borderRadius:11,textDecoration:'none',color:'#0f172a',fontWeight:800,fontSize:13}}>Editar borrador</a>}
              {Boolean(demo.is_published)&&<a href={web+'/'+demo.slug} target="_blank" rel="noreferrer" style={{padding:'9px 12px',border:'1px solid #cbd5e1',borderRadius:11,textDecoration:'none',color:'#0f172a',fontWeight:800,fontSize:13}}>Ver presentación</a>}
              {Boolean(demo.is_published)&&demo.status!=='claimed'&&<button disabled={busy===demo.id} onClick={()=>void claimCode(demo)} style={{padding:'9px 12px',border:0,borderRadius:11,background:'#047857',color:'#fff',fontWeight:900,fontSize:13}}>Generar código de reclamo</button>}
            </div>
          </article>)}
          {!demos.length&&<div style={{padding:30,border:'1px dashed #cbd5e1',borderRadius:18,textAlign:'center',color:'#64748b'}}>Todavía no has creado borradores Demo Free.</div>}
        </div>
      </section>
    </div>
  </SuperAdminLayout>
}
