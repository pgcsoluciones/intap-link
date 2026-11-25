import {useState} from 'react'
import {FiStar,FiChevronRight} from 'react-icons/fi'
import KawMedModal from './KawMedModal'

/** R6 design preview only. No persistence, network requests or patient data. */
export default function KawMedEvaluationDesign(){
  const [open,setOpen]=useState(false)
  const [value,setValue]=useState(0)
  const labels=['Muy insatisfecho','Insatisfecho','Aceptable','Satisfecho','Muy satisfecho']
  const close=()=>{setOpen(false);setValue(0)}
  return <>
    <button type="button" className="kawmed-panel kawmed-panel--direct" onClick={()=>setOpen(true)} aria-label="Evaluaciones, vista de diseño">
      <span className="kawmed-panel__icon kawmed-panel__icon--teal"><FiStar/></span>
      <span className="kawmed-panel__title"><strong>Evaluaciones</strong><small>Evalúa tu experiencia de atención · Diseño</small></span>
      <span className="kawmed-panel__illustration" aria-hidden="true"><FiStar/></span><FiChevronRight className="kawmed-panel__chevron"/>
    </button>
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
  </>
}
