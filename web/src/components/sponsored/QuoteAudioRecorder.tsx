import { useEffect, useRef, useState } from 'react'
import { FaMicrophone, FaStop } from 'react-icons/fa'

type Props={
  onRecorded:(file:File)=>void
  onError?:(message:string)=>void
}

export default function QuoteAudioRecorder({onRecorded,onError}:Props){
  const[recording,setRecording]=useState(false)
  const[seconds,setSeconds]=useState(0)
  const recorderRef=useRef<MediaRecorder|null>(null)
  const streamRef=useRef<MediaStream|null>(null)
  const chunksRef=useRef<Blob[]>([])

  useEffect(()=>{
    if(!recording){setSeconds(0);return}
    const started=Date.now()
    const tick=()=>setSeconds(Math.floor((Date.now()-started)/1000))
    tick()
    const id=window.setInterval(tick,500)
    return()=>window.clearInterval(id)
  },[recording])

  useEffect(()=>()=>{streamRef.current?.getTracks().forEach(track=>track.stop())},[])

  async function start(){
    if(!navigator.mediaDevices?.getUserMedia||typeof MediaRecorder==='undefined'){
      onError?.('Este navegador no permite grabar audio aquí.')
      return
    }
    try{
      const stream=await navigator.mediaDevices.getUserMedia({audio:true})
      const preferred=['audio/mp4;codecs=mp4a.40.2','audio/mp4','audio/webm;codecs=opus','audio/webm'].find(type=>MediaRecorder.isTypeSupported(type))
      const recorder=new MediaRecorder(stream,preferred?{mimeType:preferred}:undefined)
      chunksRef.current=[]
      streamRef.current=stream
      recorderRef.current=recorder
      recorder.ondataavailable=event=>{if(event.data.size)chunksRef.current.push(event.data)}
      recorder.onstop=()=>{
        const type=recorder.mimeType||'audio/webm'
        const blob=new Blob(chunksRef.current,{type})
        const ext=type.includes('mp4')?'m4a':'webm'
        if(blob.size>10*1024*1024)onError?.('El audio supera 10 MB. Graba uno más corto.')
        else if(blob.size>0)onRecorded(new File([blob],`audio-cotizacion.${ext}`,{type,lastModified:Date.now()}))
        streamRef.current?.getTracks().forEach(track=>track.stop())
        streamRef.current=null
        recorderRef.current=null
        chunksRef.current=[]
        setRecording(false)
      }
      recorder.start()
      setRecording(true)
    }catch{
      onError?.('No pudimos acceder al micrófono.')
    }
  }

  const mm=String(Math.floor(seconds/60)).padStart(2,'0')
  const ss=String(seconds%60).padStart(2,'0')

  if(!recording)return <button type="button" onClick={()=>void start()} style={buttonStyle}><FaMicrophone/>Grabar audio</button>

  return <div style={recordingCard}>
    <style>{`@keyframes kawQuoteMicPulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.1);opacity:.72}}@keyframes kawQuoteWave{0%,100%{transform:scaleY(.3)}50%{transform:scaleY(1)}}`}</style>
    <div style={micCircle}><FaMicrophone/></div>
    <div style={{minWidth:0}}>
      <strong style={{display:'block',fontSize:12.5,color:'#991b1b'}}>Grabando · {mm}:{ss}</strong>
      <div aria-hidden="true" style={{display:'flex',alignItems:'center',gap:3,height:20,marginTop:4}}>
        {[0,1,2,3,4,5,6,7,8].map(i=><span key={i} style={{width:3,height:18,borderRadius:99,background:'#ef4444',transformOrigin:'center',animation:`kawQuoteWave .7s ease-in-out ${i*.06}s infinite`}}/>)}
      </div>
    </div>
    <button type="button" onClick={()=>recorderRef.current?.stop()} aria-label="Stop" title="Stop" style={stopButton}><FaStop/></button>
  </div>
}

const buttonStyle:React.CSSProperties={border:'1px solid #dbe4ef',background:'#f8fafc',borderRadius:12,padding:'11px 8px',fontSize:12,fontWeight:750,color:'#334155',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:6,width:'100%'}
const recordingCard:React.CSSProperties={gridColumn:'1 / -1',display:'grid',gridTemplateColumns:'46px minmax(0,1fr) 46px',alignItems:'center',gap:10,border:'1px solid #fecdd3',background:'#fff1f2',borderRadius:14,padding:'9px 10px'}
const micCircle:React.CSSProperties={width:42,height:42,borderRadius:'50%',display:'grid',placeItems:'center',background:'#dc2626',color:'#fff',fontSize:19,animation:'kawQuoteMicPulse 1.15s ease-in-out infinite'}
const stopButton:React.CSSProperties={width:42,height:42,border:'1px solid #fecdd3',borderRadius:'50%',background:'#fff',color:'#dc2626',display:'grid',placeItems:'center',fontSize:16,cursor:'pointer'}
