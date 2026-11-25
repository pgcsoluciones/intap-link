import {useEffect,useRef,useState} from 'react'
import {FiStar,FiChevronRight,FiShare2,FiDownload} from 'react-icons/fi'
import KawMedModal from './KawMedModal'
import ProfileQrModal from '../shared/ProfileQrModal'
import {feedbackSectionLinks} from '../reviews/review-section-links'

/** R6 design preview only. No persistence, network requests or patient data. */
export default function KawMedEvaluationDesign({slug,profileName,origin}:{slug:string;profileName:string;origin:string}){
  const [qrOpen,setQrOpen]=useState(false)
  const section=useRef<HTMLElement>(null)
  const {qrUrl,shareText}=feedbackSectionLinks(origin,slug,'med',true)
  useEffect(()=>{const scroll=()=>{if(window.location.hash==='#evaluaciones')section.current?.scrollIntoView({block:'start'})};const timer=window.setTimeout(scroll,160);window.addEventListener('hashchange',scroll);return()=>{window.clearTimeout(timer);window.removeEventListener('hashchange',scroll)}},[])
  const [open,setOpen]=useState(false)
  const [value,setValue]=useState(0)
  const labels=['Muy insatisfecho','Insatisfecho','Aceptable','Satisfecho','Muy satisfecho']
  const close=()=>{setOpen(false);setValue(0)}
  return <section id="evaluaciones" ref={section} aria-label="Evaluaciones, vista de diseño" style={{scrollMarginTop:96,borderTop:'1px solid var(--kawmed-line)',borderBottom:'1px solid var(--kawmed-line)',padding:'12px 0'}}>
    <button type="button" className="kawmed-panel kawmed-panel--direct" onClick={()=>setOpen(true)} aria-label="Evaluaciones, vista de diseño">
      <span className="kawmed-panel__icon kawmed-panel__icon--teal"><FiStar/></span>
      <span className="kawmed-panel__title"><strong>Evaluaciones</strong><small>Evalúa tu experiencia de atención · Diseño</small></span>
      <span className="kawmed-panel__illustration" aria-hidden="true"><FiStar/></span><FiChevronRight className="kawmed-panel__chevron"/>
    </button>
    <div style={{display:'flex',flexWrap:'wrap',justifyContent:'center',gap:16,marginTop:8}}><button type="button" onClick={()=>window.open('https://wa.me/?text='+encodeURIComponent(shareText),'_blank','noopener,noreferrer')} style={{minHeight:44,background:'none',border:0,color:'var(--kawmed-ink)',textDecoration:'underline',fontSize:14}}><FiShare2/> Compartir evaluación</button><button type="button" onClick={()=>setQrOpen(true)} style={{minHeight:44,background:'none',border:0,color:'var(--kawmed-ink)',textDecoration:'underline',fontSize:14}}><FiDownload/> Descargar QR</button></div>
    {qrOpen&&<ProfileQrModal targetUrl={qrUrl} shareText={shareText} profileName={profileName} filename={slug+'-evaluaciones-qr.png'} subtitle="Escanea para abrir la vista de diseño de evaluaciones." kicker="KAWMED" accent="#087f8c" onClose={()=>setQrOpen(false)}/>}
    <KawMedModal open={open} title="Evalúa tu atención" onClose={close} footer={<button type="button" className="kawmed-modal__appointment-cta" onClick={close}>Cerrar vista de diseño</button>}>
      <p style={{fontSize:14,lineHeight:1.6,color:'var(--kawmed-muted)'}}>Vista de diseño. Esta evaluación no se envía ni se guarda.</p>
      <fieldset style={{border:0,padding:0,margin:'18px 0',minWidth:0}}>
        <legend style={{fontSize:16,fontWeight:700}}>¿Cómo fue tu experiencia de atención?</legend>
        <div style={{display:'flex',flexWrap:'wrap',gap:4,justifyContent:'center',marginTop:12}}>
          {labels.map((label,i)=><button key={label} type="button" aria-label={(i+1)+' de 5: '+label} aria-pressed={value===i+1} onClick={()=>setValue(i+1)} style={{minHeight:44,minWidth:44,border:'1px solid var(--kawmed-line)',borderRadius:12,background:'var(--kawmed-surface)',color:value>=i+1?'#b77906':'var(--kawmed-muted)',display:'grid',placeItems:'center',cursor:'pointer'}}><FiStar size={25} fill={value>=i+1?'#f5bd36':'none'}/></button>)}
        </div>
        <p role="status" style={{textAlign:'center',fontSize:14,marginTop:12,color:'var(--kawmed-ink)'}}>{value?labels[value-1]:'Selecciona una opción'}</p>
      </fieldset>
      <p style={{fontSize:13,lineHeight:1.5,color:'var(--kawmed-muted)'}}>Sin comentarios públicos ni datos clínicos. La habilitación de evaluaciones reales pertenece al módulo R6.</p>
    </KawMedModal>
  </section>
}
