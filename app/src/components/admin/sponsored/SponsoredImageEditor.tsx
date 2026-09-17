import { useEffect, useMemo, useRef, useState } from 'react'

type Props={
  file:File|null
  title:string
  aspect:number
  outputWidth:number
  outputHeight:number
  recommended:string
  onCancel:()=>void
  onConfirm:(file:File,previewUrl:string)=>void|Promise<void>
}

function clamp(v:number,min:number,max:number){return Math.max(min,Math.min(max,v))}

export default function SponsoredImageEditor({file,title,aspect,outputWidth,outputHeight,recommended,onCancel,onConfirm}:Props){
  const canvasRef=useRef<HTMLCanvasElement|null>(null)
  const[img,setImg]=useState<HTMLImageElement|null>(null)
  const[zoom,setZoom]=useState(1)
  const[offsetX,setOffsetX]=useState(0)
  const[offsetY,setOffsetY]=useState(0)
  const[saving,setSaving]=useState(false)
  const sourceUrl=useMemo(()=>file?URL.createObjectURL(file):'',[file])

  useEffect(()=>()=>{if(sourceUrl)URL.revokeObjectURL(sourceUrl)},[sourceUrl])
  useEffect(()=>{
    if(!sourceUrl){setImg(null);return}
    const image=new Image();image.onload=()=>setImg(image);image.src=sourceUrl
  },[sourceUrl])

  function cropGeometry(){
    if(!img)return null
    const iw=img.naturalWidth,ih=img.naturalHeight
    let cropW=iw,cropH=iw/aspect
    if(cropH>ih){cropH=ih;cropW=ih*aspect}
    cropW/=zoom;cropH/=zoom
    const maxX=(iw-cropW)/2,maxY=(ih-cropH)/2
    const cx=iw/2+(offsetX/100)*maxX,cy=ih/2+(offsetY/100)*maxY
    return {sx:clamp(cx-cropW/2,0,iw-cropW),sy:clamp(cy-cropH/2,0,ih-cropH),sw:cropW,sh:cropH}
  }

  useEffect(()=>{
    const canvas=canvasRef.current;if(!canvas||!img)return
    const g=cropGeometry();if(!g)return
    const cssW=Math.min(760,Math.max(280,outputWidth/2));const cssH=cssW/aspect
    canvas.width=Math.round(cssW*2);canvas.height=Math.round(cssH*2)
    canvas.style.aspectRatio=String(aspect)
    const ctx=canvas.getContext('2d');if(!ctx)return
    ctx.clearRect(0,0,canvas.width,canvas.height)
    ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high'
    ctx.drawImage(img,g.sx,g.sy,g.sw,g.sh,0,0,canvas.width,canvas.height)
  },[img,zoom,offsetX,offsetY,aspect,outputWidth])

  async function confirm(){
    if(!img)return
    setSaving(true)
    try{
      const g=cropGeometry();if(!g)return
      const out=document.createElement('canvas');out.width=outputWidth;out.height=outputHeight
      const ctx=out.getContext('2d');if(!ctx)throw new Error('No se pudo preparar la imagen.')
      ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.drawImage(img,g.sx,g.sy,g.sw,g.sh,0,0,out.width,out.height)
      const blob=await new Promise<Blob>((resolve,reject)=>out.toBlob(b=>b?resolve(b):reject(new Error('No se pudo optimizar la imagen.')),'image/webp',0.86))
      const base=(file?.name||'imagen').replace(/\.[^.]+$/,'').replace(/[^a-z0-9-_]+/gi,'-')||'imagen'
      const optimized=new File([blob],`${base}-optimizada.webp`,{type:'image/webp',lastModified:Date.now()})
      const preview=URL.createObjectURL(blob)
      await onConfirm(optimized,preview)
    }finally{setSaving(false)}
  }

  if(!file)return null
  return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 p-4" role="dialog" aria-modal="true">
    <div className="max-h-[92vh] w-full max-w-3xl overflow-auto rounded-[28px] bg-white p-5 shadow-2xl sm:p-6">
      <div className="flex items-start justify-between gap-4"><div><p className="text-[11px] font-black uppercase tracking-[.14em] text-cyan-600">Vista previa antes de subir</p><h2 className="mt-1 text-2xl font-black text-slate-950">{title}</h2><p className="mt-1 text-sm text-slate-500">{recommended}</p></div><button type="button" onClick={onCancel} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-black">Cerrar</button></div>
      <div className="mt-5 overflow-hidden rounded-2xl bg-slate-100"><canvas ref={canvasRef} className="block w-full"/></div>
      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        <label className="text-xs font-black uppercase tracking-[.08em] text-slate-500">Zoom<input className="mt-2 w-full" type="range" min="1" max="3" step="0.01" value={zoom} onChange={e=>setZoom(Number(e.target.value))}/></label>
        <label className="text-xs font-black uppercase tracking-[.08em] text-slate-500">Mover horizontal<input className="mt-2 w-full" type="range" min="-100" max="100" step="1" value={offsetX} onChange={e=>setOffsetX(Number(e.target.value))}/></label>
        <label className="text-xs font-black uppercase tracking-[.08em] text-slate-500">Mover vertical<input className="mt-2 w-full" type="range" min="-100" max="100" step="1" value={offsetY} onChange={e=>setOffsetY(Number(e.target.value))}/></label>
      </div>
      <div className="mt-4 rounded-2xl bg-emerald-50 p-4 text-sm leading-6 text-emerald-900"><strong>Optimización automática:</strong> se recorta al formato final, se redimensiona y se convierte a WEBP con compresión para reducir peso antes de enviarla al servidor. El archivo original no se sube.</div>
      <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><button type="button" onClick={onCancel} className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-black">Cancelar</button><button type="button" disabled={!img||saving} onClick={()=>void confirm()} className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white disabled:opacity-40">{saving?'Optimizando…':'Usar imagen optimizada'}</button></div>
    </div>
  </div>
}
