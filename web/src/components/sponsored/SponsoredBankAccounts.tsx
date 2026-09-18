import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'

type HolderIdType='cedula'|'rnc'
type Bank={id:string;bank_code:string|null;bank_name:string;account_type:'savings'|'checking';currency:'DOP'|'USD';holder_name:string;holder_id_type:HolderIdType|null;display_mode:'masked'|'visible';display_number:string;copy_value:string}

const BANK_LOGO_FILES:Record<string,string>={vimenca:'banco-vimenca.webp',promerica:'banco-promerica.webp',popular:'banco-popular.webp',bdi:'banco-bdi.webp','santa-cruz':'banco-santa-cruz.webp','bhd-leon':'banco-bhd-leon.webp',ademi:'banco-ademi.webp',banesco:'banesco.webp',scotiabank:'scotiabank.webp','la-nacional':'la-nacional.webp',banreservas:'banreservas.webp',citi:'citi.webp',caribe:'banco-caribe.webp','lopez-de-haro':'banco-lopez-de-haro.webp',bellbank:'bellbank.webp','activo-dominicana':'banco-activo-dominicana.webp',lafise:'banco-lafise.webp','asociacion-cibao':'asociacion-cibao.webp'}
function bankInitials(name:string){return name.split(/\s+/).filter(Boolean).slice(0,2).map(p=>p[0]?.toUpperCase()).join('')||'B'}
function bankLogoUrl(code:string|null){if(!code)return null;const file=BANK_LOGO_FILES[code];return file?`/bank-logos/${file}`:null}

export default function SponsoredBankAccounts(){
  const{username=''}=useParams();const[enabled,setEnabled]=useState(false);const[items,setItems]=useState<Bank[]>([]);const[copied,setCopied]=useState('')
  useEffect(()=>{let alive=true;fetch(`/api/v1/public/sponsored/${encodeURIComponent(username)}/bank-accounts`).then(r=>r.json()).then((j:any)=>{if(!alive||!j?.ok)return;setEnabled(Boolean(j.data?.enabled));setItems(Array.isArray(j.data?.items)?j.data.items:[])}).catch(()=>undefined);return()=>{alive=false}},[username])
  async function copy(value:string,id:string){try{await navigator.clipboard.writeText(value)}catch{const t=document.createElement('textarea');t.value=value;t.style.position='fixed';t.style.opacity='0';document.body.appendChild(t);t.select();document.execCommand('copy');t.remove()}setCopied(id);window.setTimeout(()=>setCopied(current=>current===id?'':current),1800)}
  async function copyHolderId(item:Bank){try{const r=await fetch(`/api/v1/public/sponsored/${encodeURIComponent(username)}/bank-accounts/${encodeURIComponent(item.id)}/holder-id`);const j:any=await r.json();if(!j?.ok||!j.data?.copy_value)return;await copy(String(j.data.copy_value),`id:${item.id}`)}catch{/* dato protegido */}}
  function bankSectionUrl(){return `${window.location.origin}/p/${encodeURIComponent(username)}?share=bancos&card=3#bancos`}
  function shareBankSectionWhatsApp(){window.open(`https://wa.me/?text=${encodeURIComponent(`Te comparto mis datos bancarios para transferencias: ${bankSectionUrl()}`)}`,'_blank','noopener,noreferrer')}
  async function copyBankSectionLink(){await copy(bankSectionUrl(),'bank-link')}
  if(!enabled||items.length===0)return null
  return <section style={{width:'100%',maxWidth:520,margin:'0 auto',background:'#fff',padding:'30px 22px 34px',boxSizing:'border-box',fontFamily:'Inter,system-ui,sans-serif'}}>
    <div style={{height:1,background:'#dce7f6',marginBottom:26}}/>
    <p style={{margin:0,fontSize:10,fontWeight:900,textTransform:'uppercase',letterSpacing:1.5,color:'#0f6fa8'}}>Datos para transferencias</p>
    <h2 style={{margin:'5px 0 0',fontSize:23,lineHeight:1.15,fontWeight:850,color:'#0f2d63'}}>Cuentas bancarias</h2>
    <p style={{margin:'6px 0 0',fontSize:13,color:'#64748b'}}>Elige una cuenta y copia los datos que necesitas para transferir.</p>
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginTop:12}}><button type="button" onClick={shareBankSectionWhatsApp} style={{border:'1px solid #dce7f6',borderRadius:10,background:'#eef6ff',padding:'10px 8px',fontSize:11,fontWeight:850,color:'#0f6fa8',cursor:'pointer'}}>Enviar por WhatsApp</button><button type="button" onClick={()=>void copyBankSectionLink()} style={{border:'1px solid #dce7f6',borderRadius:10,background:'#fff',padding:'10px 8px',fontSize:11,fontWeight:850,color:'#334155',cursor:'pointer'}}>{copied==='bank-link'?'✓ Enlace copiado':'Copiar enlace'}</button></div>
    <div style={{display:'grid',gap:12,marginTop:16}}>{items.map(item=>{const logo=bankLogoUrl(item.bank_code);return <article key={item.id} style={{border:'1px solid #dce7f6',borderRadius:18,padding:'15px 16px',background:'#f8fbff'}}>
      <div style={{display:'flex',gap:14,alignItems:'flex-start'}}>
        <div style={{width:72,height:72,flex:'0 0 72px',display:'grid',placeItems:'center',overflow:'hidden',border:'1px solid #dce7f6',borderRadius:16,background:'#fff',padding:4}}>{logo?<img src={logo} alt={`Logo de ${item.bank_name}`} style={{width:'100%',height:'100%',objectFit:'contain'}} loading="lazy"/>:<span style={{fontSize:13,fontWeight:900,color:'#475569'}}>{bankInitials(item.bank_name)}</span>}</div>
        <div style={{minWidth:0,flex:1}}><strong style={{display:'block',fontSize:15,color:'#0f2d63'}}>{item.bank_name}</strong><span style={{display:'block',marginTop:4,fontSize:12,color:'#64748b'}}>{item.account_type==='checking'?'Cuenta corriente':'Cuenta de ahorros'} · {item.currency}</span><div style={{marginTop:10,fontSize:13,fontWeight:800,color:'#172033'}}>{item.holder_name}</div><div style={{marginTop:5,fontFamily:'monospace',fontSize:15,fontWeight:850,letterSpacing:.5,color:'#475569'}}>{item.display_number}</div>{item.holder_id_type&&<div style={{marginTop:6,fontSize:11,fontWeight:700,color:'#64748b'}}>{item.holder_id_type==='rnc'?'RNC':'Cédula'} protegido · se copia sin mostrarse</div>}</div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginTop:14}}><button type="button" onClick={()=>void copy(item.copy_value,`account:${item.id}`)} style={{border:0,borderRadius:10,background:copied===`account:${item.id}`?'#D1FAE5':'#0f2d63',padding:'11px 10px',fontSize:12,fontWeight:850,color:copied===`account:${item.id}`?'#065F46':'#fff',cursor:'pointer'}}>{copied===`account:${item.id}`?'✓ Cuenta copiada':'Copiar cuenta'}</button><button type="button" disabled={!item.holder_id_type} onClick={()=>void copyHolderId(item)} style={{border:'1px solid #cbd5e1',borderRadius:10,background:copied===`id:${item.id}`?'#D1FAE5':'#fff',padding:'11px 10px',fontSize:12,fontWeight:850,color:copied===`id:${item.id}`?'#065F46':'#334155',cursor:item.holder_id_type?'pointer':'default',opacity:item.holder_id_type?1:.45}}>{copied===`id:${item.id}`?`✓ ${item.holder_id_type==='rnc'?'RNC':'Cédula'} copiado`:`Copiar ${item.holder_id_type==='rnc'?'RNC':'cédula'}`}</button></div>
    </article>})}</div>
    <p style={{margin:'12px 0 0',textAlign:'center',fontSize:11,fontWeight:700,color:'#64748b'}}>Tus datos de identificación no se muestran públicamente.</p>
  </section>
}
