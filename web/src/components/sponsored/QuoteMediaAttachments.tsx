import { useRef } from 'react'
import QuoteAudioRecorder from './QuoteAudioRecorder'

type Props={
  files:File[]
  onChange:(files:File[])=>void
  onError:(message:string)=>void
}

type MediaMode='image'|'audio'|'document'
const limits:Record<MediaMode,number>={image:3,audio:1,document:2}

function modeOf(file:File):MediaMode|null{
  const type=String(file.type||'').toLowerCase().split(';',1)[0].trim()
  if(type.startsWith('image/'))return'image'
  if(type.startsWith('audio/'))return'audio'
  if(type==='application/pdf'||/\.pdf$/i.test(file.name))return'document'
  return null
}
function labelOf(mode:MediaMode,count:number){
  if(mode==='image')return count===1?'Imagen adjunta':`${count} imágenes adjuntas`
  if(mode==='audio')return'Audio adjunto'
  return count===1?'Archivo adjunto':`${count} archivos adjuntos`
}
function detailOf(file:File){
  const mb=(file.size/1024/1024).toFixed(1)
  return `${file.name} · ${mb} MB`
}

export default function QuoteMediaAttachments({files,onChange,onError}:Props){
  const fileRef=useRef<HTMLInputElement>(null)
  const cameraRef=useRef<HTMLInputElement>(null)
  const mode=files.length?modeOf(files[0]):null

  function add(incoming:File[]){
    if(!incoming.length)return
    const modes=incoming.map(modeOf)
    if(modes.some(item=>!item)){onError('Usa imágenes, PDF o audio.');return}
    const incomingMode=modes[0] as MediaMode
    if(modes.some(item=>item!==incomingMode)){onError('Adjunta un solo tipo de media por solicitud.');return}
    if(mode&&mode!==incomingMode){onError('Para esta solicitud usa solo un tipo de adjunto. Quita los actuales para cambiar.');return}
    const max=limits[incomingMode]
    const next=[...files,...incoming]
    if(next.length>max){
      onError(incomingMode==='image'?'Puedes adjuntar hasta 3 imágenes por solicitud.':incomingMode==='document'?'Puedes adjuntar hasta 2 archivos por solicitud.':'Puedes adjuntar un solo audio por solicitud.')
      return
    }
    for(const file of incoming){
      const maxOriginal=incomingMode==='image'?15:10
      if(file.size>maxOriginal*1024*1024){onError(incomingMode==='image'?'Cada imagen original debe pesar 15 MB o menos.':'Cada archivo debe pesar 10 MB o menos.');return}
    }
    onChange(next)
  }

  function remove(index:number){onChange(files.filter((_,i)=>i!==index))}
  function selectFiles(list:FileList|null){add(Array.from(list||[]))}
  function audioRecorded(file:File){add([file])}

  return <div style={{border:'1px solid #dbe4ef',borderRadius:16,padding:13,background:'#f8fafc'}}>
    <div style={{fontSize:12,fontWeight:900,color:'#334155'}}>Adjuntar media <span style={{fontWeight:600,color:'#94a3b8'}}>(opcional)</span></div>
    <div style={{display:'grid',gridTemplateColumns:'repeat(3,minmax(0,1fr))',gap:7,marginTop:10}}>
      <button type="button" onClick={()=>cameraRef.current?.click()} style={miniBtn}>Tomar foto</button>
      <button type="button" onClick={()=>fileRef.current?.click()} style={miniBtn}>Elegir archivo</button>
      <QuoteAudioRecorder onRecorded={audioRecorded} onError={onError}/>
    </div>
    <input ref={cameraRef} type="file" accept="image/*" capture="environment" style={{display:'none'}} onChange={e=>{selectFiles(e.target.files);e.target.value=''}}/>
    <input ref={fileRef} type="file" multiple accept="image/*,application/pdf,audio/*" style={{display:'none'}} onChange={e=>{selectFiles(e.target.files);e.target.value=''}}/>
    {files.length>0&&<div style={{marginTop:10,borderRadius:12,background:'#fff',padding:'10px 11px'}}>
      <strong style={{display:'block',fontSize:12,color:'#334155'}}>{labelOf(mode as MediaMode,files.length)}</strong>
      <span style={{display:'block',marginTop:3,fontSize:11,color:'#64748b'}}>Listo para enviar</span>
      <div style={{display:'grid',gap:7,marginTop:9}}>
        {files.map((file,index)=><div key={`${file.name}-${file.lastModified}-${index}`} style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:10,borderTop:index?'1px solid #eef2f7':'none',paddingTop:index?7:0}}>
          <span style={{minWidth:0,fontSize:10.5,color:'#94a3b8',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{detailOf(file)}</span>
          <button type="button" onClick={()=>remove(index)} style={{...miniBtn,padding:'7px 9px',flexShrink:0}}>Quitar</button>
        </div>)}
      </div>
    </div>}
    <p style={{margin:'9px 0 0',fontSize:11.5,lineHeight:1.45,color:'#64748b'}}>Por solicitud: hasta 3 imágenes, 1 audio o 2 archivos. No se mezclan tipos. Las imágenes se optimizan antes de subir.</p>
  </div>
}

const miniBtn:React.CSSProperties={border:'1px solid #dbe4ef',background:'#f8fafc',borderRadius:12,padding:'11px 8px',fontSize:12,fontWeight:750,color:'#334155',cursor:'pointer'}
