import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import IntapLinkGratisProfile from '../free-profile/IntapLinkGratisProfile'
import type { FreeProfileData, FreeProfileLayoutId, FreeProfileQuickActionType } from '../free-profile/IntapLinkGratis.types'
import { resolvePalette, FREE_PALETTES } from '../free-profile/IntapLinkGratis.experience'
import './FreeDemoEditor.css'

type ApiState={
  id:string;status:string;template_label:string;published_at?:string|null
  profile:any;contact:any;quick_actions:any[];portfolio:any[];links:any[]
  experience:any;limits:{portfolio:number;quick_actions:number;links:number;services:number}
}

function appOrigin(){
  const host=window.location.hostname.toLowerCase()
  return host==='preview.intaprd.com'||host.includes('preview')||host.endsWith('.pages.dev')
    ?'https://app.preview.intaprd.com':'https://app.intaprd.com'
}
async function api(path:string,init?:RequestInit){
  const res=await fetch(appOrigin()+'/api/v1'+path,{credentials:'include',headers:init?.body instanceof FormData?undefined:{'Content-Type':'application/json'},...init})
  const json:any=await res.json().catch(()=>({ok:false,error:'Respuesta inválida del servidor.'}))
  if(!res.ok||!json?.ok)throw new Error(json?.error||'No se pudo completar la operación.')
  return json
}
function quickLabel(type:string){return type==='call'?'Llamar':type==='instagram'?'Instagram':type==='location'?'Ubicación':type==='email'?'Email':'TikTok'}
function normalizePhone(value:string){let digits=String(value||'').replace(/\D/g,'');if(digits.length===10&&/^(809|829|849)/.test(digits))digits='1'+digits;return digits}
function scheduleFrom(data:ApiState){
  const raw=Array.isArray(data.profile?.template_data?.free_schedule)?data.profile.template_data.free_schedule:[]
  return raw.map((x:any)=>({day:String(x.day||''),hours:String(x.hours||'')}))
}

export default function FreeDemoEditor(){
  const{id=''}=useParams()
  const[data,setData]=useState<ApiState|null>(null)
  const[error,setError]=useState('')
  const[saving,setSaving]=useState(false)
  const[notice,setNotice]=useState('')
  const[publishOpen,setPublishOpen]=useState(false)
  const[finalName,setFinalName]=useState('')
  const[finalSlug,setFinalSlug]=useState('')

  const load=async()=>{try{const j=await api('/superadmin/free-demo-v2/'+encodeURIComponent(id)+'/editor');setData(j.data);setError('')}catch(e){setError(e instanceof Error?e.message:'No pudimos cargar la Demo.')}}
  useEffect(()=>{void load()},[id])

  const updateProfile=(key:string,value:any)=>setData(current=>current?{...current,profile:{...current.profile,[key]:value}}:current)
  const updateContact=(key:string,value:any)=>setData(current=>current?{...current,contact:{...current.contact,[key]:value}}:current)
  const updateTemplate=(key:string,value:any)=>setData(current=>current?{...current,profile:{...current.profile,template_data:{...(current.profile.template_data||{}),[key]:value}}}:current)

  const live=useMemo(()=>{
    if(!data)return null
    const p=data.profile||{},c=data.contact||{},td=p.template_data||{}
    const whatsapp=normalizePhone(c.whatsapp||c.phone||'')
    const quick=data.quick_actions.slice(0,3).map((item:any)=>({type:item.type as FreeProfileQuickActionType,label:quickLabel(item.type),url:String(item.url||'')}))
    const profile:FreeProfileData={
      id:p.id,slug:p.slug||'borrador',name:p.name||'Tu nombre o negocio',role:String(td.role||p.subcategory||''),
      personalBadge:'Demo Free',aboutTitle:'Sobre mí',portfolioTitle:String(td.portfolio_title||'Mis trabajos'),
      servicesTitle:'',servicesDescription:'',bio:p.bio||'',phone:String(c.phone||''),whatsapp,email:String(c.email||''),
      whatsappGreetingName:p.name||'Hola',whatsappCtaLabel:'Hablar por WhatsApp',instagram:'',
      location:String(c.address||''),portrait:p.avatar_url||'',hero:p.hero_url||'',heroPositionX:Number(p.hero_position_x||50),
      heroPositionY:Number(p.hero_position_y||50),heroZoom:Number(p.hero_zoom||1),category:p.category||'',
      vcardFileName:'kawvo-demo.vcf',quickActions:quick,services:[],
      portfolio:data.portfolio.slice(0,10).map((item:any,index:number)=>({id:String(item.id||index),title:String(item.title||'Trabajo '+(index+1)),description:String(item.description||''),image:String(item.image_key||'')})),
      customLinks:data.links.slice(0,3).map((item:any,index:number)=>({id:String(item.id||index),label:String(item.label||''),url:String(item.url||'')})),
      experience:{
        schedule:scheduleFrom(data),
        scheduleVisible:td.free_schedule_visible!==false,
        quoteButtonVisible:td.free_quote_button_visible!==false,
        appointmentEnabled:Boolean(data.experience?.appointment_enabled),
        quoteEmail:String(c.email||''),
      },
    }
    return{profile,layout:(p.layout_id||'impacto') as FreeProfileLayoutId,colors:resolvePalette(p.free_palette_id||'intap',p.free_brand_color||null)}
  },[data])

  const save=async()=>{
    if(!data)return
    setSaving(true);setNotice('')
    try{
      const p=data.profile,td=p.template_data||{}
      await api('/superadmin/free-demo-v2/'+encodeURIComponent(id)+'/profile',{method:'PATCH',body:JSON.stringify({
        name:p.name,bio:p.bio,role:td.role,portfolio_title:td.portfolio_title,layout_id:p.layout_id,free_palette_id:p.free_palette_id,free_brand_color:p.free_brand_color,
        schedule_visible:td.free_schedule_visible,quote_button_visible:td.free_quote_button_visible,contact:data.contact,
      })})
      await api('/superadmin/free-demo-v2/'+encodeURIComponent(id)+'/quick-actions',{method:'PUT',body:JSON.stringify({items:data.quick_actions.slice(0,3)})})
      await api('/superadmin/free-demo-v2/'+encodeURIComponent(id)+'/links',{method:'PUT',body:JSON.stringify({items:data.links.slice(0,3)})})
      await api('/superadmin/free-demo-v2/'+encodeURIComponent(id)+'/portfolio',{method:'PUT',body:JSON.stringify({items:data.portfolio.slice(0,10)})})
      await api('/superadmin/free-demo-v2/'+encodeURIComponent(id)+'/experience',{method:'PUT',body:JSON.stringify({
        appointment_enabled:Boolean(data.experience.appointment_enabled),schedule_visible:td.free_schedule_visible!==false,quote_button_visible:td.free_quote_button_visible!==false,
        slot_minutes:data.experience.slot_minutes,min_notice_minutes:data.experience.min_notice_minutes,horizon_days:data.experience.horizon_days,timezone:data.experience.timezone,
        availability:data.experience.availability,
      })})
      setNotice('Borrador guardado.')
      await load()
    }catch(e){setError(e instanceof Error?e.message:'No pudimos guardar.')}finally{setSaving(false)}
  }

  const upload=async(kind:'avatar'|'hero'|'portfolio',file?:File,index?:number)=>{
    if(!file||!data)return
    const fd=new FormData();fd.append('file',file,file.name)
    setSaving(true)
    try{
      const j=await api('/superadmin/free-demo-v2/'+encodeURIComponent(id)+'/media?kind='+kind,{method:'POST',body:fd})
      if(kind==='avatar')updateProfile('avatar_url',j.data.url)
      else if(kind==='hero')updateProfile('hero_url',j.data.url)
      else if(index!==undefined)setData(current=>current?{...current,portfolio:current.portfolio.map((item,i)=>i===index?{...item,image_key:j.data.url}:item)}:current)
      setNotice('Imagen cargada. Guarda el borrador para conservar los cambios de contenido.')
    }catch(e){setError(e instanceof Error?e.message:'No pudimos subir la imagen.')}finally{setSaving(false)}
  }

  const publish=async()=>{
    if(!data)return
    setSaving(true)
    try{
      await save()
      const j=await api('/superadmin/free-demo-v2/'+encodeURIComponent(id)+'/publish',{method:'POST',body:JSON.stringify({name:finalName,slug:finalSlug})})
      setPublishOpen(false);setNotice('Presentación publicada: '+j.data.public_url);await load()
    }catch(e){setError(e instanceof Error?e.message:'No pudimos publicar.')}finally{setSaving(false)}
  }

  if(error&&!data)return <main className="fd2-error"><h1>No pudimos abrir esta Demo Free</h1><p>{error}</p><a href={appOrigin()+'/superadmin/free-demos'}>Volver a SuperAdmin</a></main>
  if(!data||!live)return <main className="fd2-loading">Cargando plantilla Demo…</main>

  const p=data.profile,td=p.template_data||{}
  return <main className="fd2-page">
    <header className="fd2-top">
      <div><strong>KAWVO LINK · DEMO FREE</strong><span>{data.template_label} · {data.status}</span></div>
      <div className="fd2-top-actions"><a href={appOrigin()+'/superadmin/free-demos'}>Volver a SuperAdmin</a><button onClick={()=>void save()} disabled={saving}>Guardar borrador</button><button className="primary" onClick={()=>{setFinalName(p.name==='Tu nombre o negocio'?'':p.name);setFinalSlug(data.published_at?p.slug:''),setPublishOpen(true)}} disabled={saving}>Finalizar y publicar</button></div>
    </header>

    {notice&&<div className="fd2-notice">{notice}</div>}
    {error&&<div className="fd2-error-inline">{error}<button onClick={()=>setError('')}>×</button></div>}

    <div className="fd2-grid">
      <section className="fd2-editor">
        <h1>Editar borrador</h1><p>Esta copia es un perfil Free real en borrador. No modifica la plantilla base.</p>
        <fieldset><legend>Identidad</legend>
          <label>Nombre<input value={p.name||''} onChange={e=>updateProfile('name',e.target.value)}/></label>
          <label>Especialidad / qué hago<input value={td.role||''} onChange={e=>updateTemplate('role',e.target.value)}/></label>
          <label>Sobre mí<textarea rows={4} value={p.bio||''} onChange={e=>updateProfile('bio',e.target.value)}/></label>
          <div className="fd2-row"><label>Portada<input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>void upload('hero',e.target.files?.[0])}/></label><label>Avatar<input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>void upload('avatar',e.target.files?.[0])}/></label></div>
        </fieldset>

        <fieldset><legend>Contacto</legend>
          <div className="fd2-row"><label>WhatsApp<input value={data.contact.whatsapp||''} onChange={e=>updateContact('whatsapp',e.target.value)}/></label><label>Teléfono<input value={data.contact.phone||''} onChange={e=>updateContact('phone',e.target.value)}/></label></div>
          <label>Correo<input value={data.contact.email||''} onChange={e=>updateContact('email',e.target.value)}/></label>
          <label>Dirección<input value={data.contact.address||''} onChange={e=>updateContact('address',e.target.value)}/></label>
          <label>Enlace de mapa<input value={data.contact.map_url||''} onChange={e=>updateContact('map_url',e.target.value)}/></label>
        </fieldset>

        <fieldset><legend>Diseño</legend>
          <div className="fd2-row"><label>Plantilla<select value={p.layout_id||'impacto'} onChange={e=>updateProfile('layout_id',e.target.value)}><option value="impacto">Impacto</option><option value="personal">Personal</option><option value="esencial">Esencial</option></select></label>
          <label>Paleta<select value={p.free_palette_id||'intap'} onChange={e=>updateProfile('free_palette_id',e.target.value)}>{FREE_PALETTES.filter(x=>x.id!=='personalizada').map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label></div>
        </fieldset>

        <fieldset><legend>Botones rápidos · {data.quick_actions.length}/3</legend>
          {data.quick_actions.map((item:any,index:number)=><div className="fd2-action" key={index}><select value={item.type} onChange={e=>setData(current=>current?{...current,quick_actions:current.quick_actions.map((x,i)=>i===index?{...x,type:e.target.value}:x)}:current)}><option value="call">Llamar</option><option value="instagram">Instagram</option><option value="location">Ubicación</option><option value="email">Email</option><option value="tiktok">TikTok</option></select><input value={item.url||''} onChange={e=>setData(current=>current?{...current,quick_actions:current.quick_actions.map((x,i)=>i===index?{...x,url:e.target.value}:x)}:current)}/><button onClick={()=>setData(current=>current?{...current,quick_actions:current.quick_actions.filter((_,i)=>i!==index)}:current)}>Quitar</button></div>)}
          {data.quick_actions.length<3&&<button onClick={()=>setData(current=>current?{...current,quick_actions:[...current.quick_actions,{type:'call',url:''}]}:current)}>+ Agregar botón</button>}
        </fieldset>

        <fieldset><legend>Enlaces · {data.links.length}/3</legend>
          {data.links.map((item:any,index:number)=><div className="fd2-action" key={index}><input placeholder="Etiqueta" value={item.label||''} onChange={e=>setData(current=>current?{...current,links:current.links.map((x,i)=>i===index?{...x,label:e.target.value}:x)}:current)}/><input placeholder="https://..." value={item.url||''} onChange={e=>setData(current=>current?{...current,links:current.links.map((x,i)=>i===index?{...x,url:e.target.value}:x)}:current)}/><button onClick={()=>setData(current=>current?{...current,links:current.links.filter((_,i)=>i!==index)}:current)}>Quitar</button></div>)}
          {data.links.length<3&&<button onClick={()=>setData(current=>current?{...current,links:[...current.links,{label:'',url:''}]}:current)}>+ Agregar enlace</button>}
        </fieldset>

        <fieldset><legend>Portafolio · {data.portfolio.length}/10</legend>
          <label>Título de sección<input value={td.portfolio_title||'Mis trabajos'} onChange={e=>updateTemplate('portfolio_title',e.target.value)}/></label>
          <div className="fd2-portfolio">{data.portfolio.map((item:any,index:number)=><article key={index}>{item.image_key&&<img src={item.image_key} alt=""/>}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>void upload('portfolio',e.target.files?.[0],index)}/><input value={item.title||''} onChange={e=>setData(current=>current?{...current,portfolio:current.portfolio.map((x,i)=>i===index?{...x,title:e.target.value}:x)}:current)}/><textarea rows={2} value={item.description||''} onChange={e=>setData(current=>current?{...current,portfolio:current.portfolio.map((x,i)=>i===index?{...x,description:e.target.value}:x)}:current)}/><button onClick={()=>setData(current=>current?{...current,portfolio:current.portfolio.filter((_,i)=>i!==index)}:current)}>Eliminar</button></article>)}</div>
          {data.portfolio.length<10&&<button onClick={()=>setData(current=>current?{...current,portfolio:[...current.portfolio,{image_key:'',title:'Trabajo '+(current.portfolio.length+1),description:''}]}:current)}>+ Agregar espacio</button>}
        </fieldset>

        <fieldset><legend>Horario, Cotizar y Agenda</legend>
          <label className="fd2-check"><input type="checkbox" checked={td.free_schedule_visible!==false} onChange={e=>updateTemplate('free_schedule_visible',e.target.checked)}/> Mostrar horario</label>
          <label className="fd2-check"><input type="checkbox" checked={td.free_quote_button_visible!==false} onChange={e=>updateTemplate('free_quote_button_visible',e.target.checked)}/> Mostrar Cotizar / información</label>
          <label className="fd2-check"><input type="checkbox" checked={Boolean(data.experience.appointment_enabled)} onChange={e=>setData(current=>current?{...current,experience:{...current.experience,appointment_enabled:e.target.checked}}:current)}/> Activar Agenda</label>
          <div className="fd2-hours">{data.experience.availability.map((item:any,index:number)=><div key={item.id||index}><span>{['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'][Number(item.weekday)]}</span><input type="time" value={String(item.start_time||'').slice(0,5)} onChange={e=>setData(current=>current?{...current,experience:{...current.experience,availability:current.experience.availability.map((x:any,i:number)=>i===index?{...x,start_time:e.target.value}:x)}}:current)}/><input type="time" value={String(item.end_time||'').slice(0,5)} onChange={e=>setData(current=>current?{...current,experience:{...current.experience,availability:current.experience.availability.map((x:any,i:number)=>i===index?{...x,end_time:e.target.value}:x)}}:current)}/></div>)}</div>
        </fieldset>

        <div className="fd2-save"><button onClick={()=>void save()} disabled={saving}>{saving?'Guardando…':'Guardar borrador'}</button></div>
      </section>

      <aside className="fd2-preview"><div className="fd2-preview-label">Vista previa Free real</div><IntapLinkGratisProfile profile={live.profile} layout={live.layout} colors={live.colors}/></aside>
    </div>

    {publishOpen&&<div className="fd2-modal" onMouseDown={e=>{if(e.target===e.currentTarget)setPublishOpen(false)}}><section><h2>Finalizar y publicar</h2><p>El borrador conservará todos sus datos. El slug queda fijo después de la primera publicación.</p><label>Nombre final<input value={finalName} onChange={e=>setFinalName(e.target.value)}/></label><label>Slug final<div className="fd2-slug"><span>intaprd.com/</span><input value={finalSlug} disabled={Boolean(data.published_at)} onChange={e=>setFinalSlug(e.target.value)}/></div></label><div><button onClick={()=>setPublishOpen(false)}>Cancelar</button><button className="primary" disabled={saving||!finalName.trim()||!finalSlug.trim()} onClick={()=>void publish()}>Publicar presentación</button></div></section></div>}
  </main>
}
