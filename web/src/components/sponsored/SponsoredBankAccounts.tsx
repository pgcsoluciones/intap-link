import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'

type HolderIdType='cedula'|'rnc'
type Bank={id:string;bank_code:string|null;bank_name:string;account_type:'savings'|'checking';currency:'DOP'|'USD';holder_name:string;holder_id_type:HolderIdType|null;display_mode:'masked'|'visible';display_number:string;copy_value:string}
export type SponsoredBankPalette={accent:string;accentSoft:string;text:string}

const DEFAULT_PALETTE:SponsoredBankPalette={accent:'#174a9f',accentSoft:'#eef5ff',text:'#0f2d63'}
const BANK_LOGO_FILES:Record<string,string>={vimenca:'banco-vimenca.webp',promerica:'banco-promerica.webp',popular:'banco-popular.webp',bdi:'banco-bdi.webp','santa-cruz':'banco-santa-cruz.webp','bhd-leon':'banco-bhd-leon.webp',ademi:'banco-ademi.webp',banesco:'banesco.webp',scotiabank:'scotiabank.webp','la-nacional':'la-nacional.webp',banreservas:'banreservas.webp',citi:'citi.webp',caribe:'banco-caribe.webp','lopez-de-haro':'banco-lopez-de-haro.webp',bellbank:'bellbank.webp','activo-dominicana':'banco-activo-dominicana.webp',lafise:'banco-lafise.webp','asociacion-cibao':'asociacion-cibao.webp'}
function bankInitials(name:string){return name.split(/\s+/).filter(Boolean).slice(0,2).map(p=>p[0]?.toUpperCase()).join('')||'B'}
function bankLogoUrl(code:string|null){if(!code)return null;const file=BANK_LOGO_FILES[code];return file?`/bank-logos/${file}`:null}

export default function SponsoredBankAccounts({palette=DEFAULT_PALETTE}:{palette?:SponsoredBankPalette}){
  const{username=''}=useParams()
  const[enabled,setEnabled]=useState(false)
  const[items,setItems]=useState<Bank[]>([])
  const[expanded,setExpanded]=useState(false)
  const[copiedLink,setCopiedLink]=useState(false)
  const sectionRef=useRef<HTMLElement|null>(null)

  useEffect(()=>{let alive=true;fetch(`/api/v1/public/sponsored/${encodeURIComponent(username)}/bank-accounts`).then(r=>r.json()).then((j:any)=>{if(!alive||!j?.ok)return;setEnabled(Boolean(j.data?.enabled));setItems(Array.isArray(j.data?.items)?j.data.items:[])}).catch(()=>undefined);return()=>{alive=false}},[username])

  useEffect(()=>{
    if(!enabled||items.length===0||window.location.hash!=='#bancos')return
    setExpanded(true)
    window.setTimeout(()=>document.getElementById('bancos')?.scrollIntoView({behavior:'smooth',block:'start'}),160)
  },[enabled,items.length])

  useEffect(()=>{
    if(!expanded)return
    const closeOutside=(event:PointerEvent)=>{const target=event.target as Node|null;if(target&&!sectionRef.current?.contains(target))setExpanded(false)}
    document.addEventListener('pointerdown',closeOutside,true)
    let idleTimer=window.setTimeout(()=>setExpanded(false),8000)
    const resetIdle=()=>{window.clearTimeout(idleTimer);idleTimer=window.setTimeout(()=>setExpanded(false),8000)}
    const section=sectionRef.current
    section?.addEventListener('pointerdown',resetIdle)
    section?.addEventListener('keydown',resetIdle)
    return()=>{document.removeEventListener('pointerdown',closeOutside,true);section?.removeEventListener('pointerdown',resetIdle);section?.removeEventListener('keydown',resetIdle);window.clearTimeout(idleTimer)}
  },[expanded])

  async function writeClipboard(value:string){try{await navigator.clipboard.writeText(value)}catch{const t=document.createElement('textarea');t.value=value;t.style.position='fixed';t.style.opacity='0';document.body.appendChild(t);t.select();document.execCommand('copy');t.remove()}}
  async function copySensitive(value:string){await writeClipboard(value)}
  function holderIdValue(item:Bank){return fetch(`/api/v1/public/sponsored/${encodeURIComponent(username)}/bank-accounts/${encodeURIComponent(item.id)}/holder-id`).then(r=>r.json()).then((j:any)=>{const value=j?.ok&&j.data?.copy_value?String(j.data.copy_value):'';if(!value||value===item.copy_value)throw new Error('Identificación no disponible');return value})}
  async function copyHolderId(item:Bank){const valuePromise=holderIdValue(item);try{if(navigator.clipboard?.write&&typeof ClipboardItem!=='undefined'){const clipboardItem=new ClipboardItem({'text/plain':valuePromise.then(value=>new Blob([value],{type:'text/plain'}))});await navigator.clipboard.write([clipboardItem]);return}}catch{/* fallback compatible */}try{await writeClipboard(await valuePromise)}catch{/* dato protegido */}}
  function bankSectionUrl(){return `${window.location.origin}/p/${encodeURIComponent(username)}?share=bancos&card=3#bancos`}
  function shareBankSectionWhatsApp(){window.open(`https://wa.me/?text=${encodeURIComponent(`Te comparto mis datos bancarios para transferencias: ${bankSectionUrl()}`)}`,'_blank','noopener,noreferrer')}
  async function copyBankSectionLink(){await writeClipboard(bankSectionUrl());setCopiedLink(true);window.setTimeout(()=>setCopiedLink(false),1500)}

  if(!enabled||items.length===0)return null

  const border=`${palette.accent}2f`
  const softBorder=`${palette.accent}24`
  const secondaryText='#64748b'

  return <section ref={sectionRef} id="bancos" aria-labelledby="sponsored-bank-title" style={{padding:'18px 22px 0',marginTop:20,borderTop:`1px solid ${softBorder}`}}>
    <button
      type="button"
      onClick={()=>setExpanded(current=>!current)}
      aria-expanded={expanded}
      aria-controls="sponsored-bank-content"
      style={{width:'100%',display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,border:0,background:'transparent',padding:'2px 0',textAlign:'left',cursor:'pointer'}}
    >
      <span style={{display:'flex',alignItems:'center',gap:8}}>
<span aria-hidden="true" style={{width:32,height:32,flex:'0 0 32px',display:'grid',placeItems:'center',borderRadius:'999px',background:palette.accentSoft,color:palette.text}}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 3 3 7v2h18V7l-9-4Zm-7 8v6H3v2h18v-2h-2v-6h-2v6h-3v-6h-2v6H9v-6H7v6H5v-6Z"/></svg>
        </span>
        <h2 id="sponsored-bank-title" style={{margin:0,fontSize:21,lineHeight:1.2,fontWeight:900,color:palette.text}}>Cuentas</h2>
      </span>
      <span aria-hidden="true" style={{fontSize:21,fontWeight:900,color:secondaryText,transition:'transform .2s ease',transform:expanded?'rotate(180deg)':'rotate(0deg)'}}>⌄</span>
    </button>

    {expanded&&<div id="sponsored-bank-content">
      <div style={{display:'flex',flexWrap:'wrap',alignItems:'center',gap:'8px 16px',marginTop:13,fontSize:11,fontWeight:800}}>
        <button type="button" onClick={shareBankSectionWhatsApp} style={{border:0,background:'transparent',padding:0,fontSize:11,fontWeight:800,color:palette.accent,cursor:'pointer',textDecoration:'underline',textUnderlineOffset:3}}>Enviar cuentas por WhatsApp</button>
        <button type="button" onClick={()=>void copyBankSectionLink()} style={{border:0,background:'transparent',padding:0,fontSize:11,fontWeight:800,color:palette.text,cursor:'pointer',textDecoration:'underline',textUnderlineOffset:3}}>{copiedLink?'Enlace copiado':'Copiar enlace'}</button>
      </div>

      <div style={{display:'grid',gap:12,marginTop:16}}>{items.map(item=>{const logo=bankLogoUrl(item.bank_code);return <article key={item.id} style={{border:`1px solid ${border}`,borderRadius:20,padding:'15px 16px',background:palette.accentSoft}}>
        <div style={{display:'flex',gap:14,alignItems:'flex-start'}}>
          <div style={{width:72,height:72,flex:'0 0 72px',display:'grid',placeItems:'center',overflow:'hidden',border:`1px solid ${softBorder}`,borderRadius:16,background:'#fff',padding:4}}>{logo?<img src={logo} alt={`Logo de ${item.bank_name}`} style={{width:'100%',height:'100%',objectFit:'contain'}} loading="lazy"/>:<span style={{fontSize:13,fontWeight:900,color:palette.text}}>{bankInitials(item.bank_name)}</span>}</div>
          <div style={{minWidth:0,flex:1}}>
            <strong style={{display:'block',fontSize:15,color:palette.text}}>{item.bank_name}</strong>
            <span style={{display:'block',marginTop:4,fontSize:12,fontWeight:700,color:palette.accent}}>{item.account_type==='checking'?'Cuenta corriente':'Cuenta de ahorros'} · {item.currency}</span>
            <div style={{marginTop:10,fontSize:13,fontWeight:800,color:palette.text}}>{item.holder_name}</div>
            <div style={{marginTop:5,fontFamily:'monospace',fontSize:15,fontWeight:850,letterSpacing:.5,color:secondaryText}}>{item.display_number}</div>
          </div>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginTop:14}}>
          <button type="button" onClick={()=>void copySensitive(item.copy_value)} className="transition active:scale-[0.96]" style={{border:0,borderRadius:12,background:palette.accent,padding:'11px 10px',fontSize:12,fontWeight:850,color:'#fff',cursor:'pointer'}} aria-label="Cuenta">Cuenta</button>
          <button type="button" disabled={!item.holder_id_type} onClick={()=>void copyHolderId(item)} className="transition active:scale-[0.96]" style={{border:`1px solid ${border}`,borderRadius:12,background:'#fff',padding:'11px 10px',fontSize:12,fontWeight:850,color:palette.text,cursor:item.holder_id_type?'pointer':'default',opacity:item.holder_id_type?1:.45}} aria-label="RNC o cédula">RNC / CÉD.</button>
        </div>
      </article>})}</div>
    </div>}
  </section>
}
