import { useEffect, useRef, type ReactNode } from 'react'

export type ReviewSectionProps = {
  action: ReactNode
  accent?: string
  onImpression?: () => void
  anchor?: string
  decorativeStars?: boolean
  sectionActions?: ReactNode
}

/** Shared presentation only. The product adapter supplies authorized content/actions. */
export default function ReviewSection({action, accent, onImpression, anchor='resenas',decorativeStars=true,sectionActions}: ReviewSectionProps) {
  const section = useRef<HTMLElement>(null)
  const outer = useRef<HTMLElement>(null)
  const impression = useRef(false)
  const callback = useRef(onImpression)
  callback.current = onImpression
  useEffect(() => {
    const node=section.current
    if(!node)return
    const scroll=()=>{if(window.location.hash==='#'+anchor)(outer.current||node).scrollIntoView({block:'start'})}
    const frame=requestAnimationFrame(scroll)
    const timer=window.setTimeout(scroll,160)
    window.addEventListener('hashchange',scroll)
    const clean=()=>{cancelAnimationFrame(frame);window.clearTimeout(timer);window.removeEventListener('hashchange',scroll)}
    if(typeof IntersectionObserver==='undefined')return clean
    const observer=new IntersectionObserver(entries=>{
      if(entries.some(entry=>entry.isIntersecting&&entry.intersectionRatio>=0.5)&&!impression.current){
        impression.current=true
        callback.current?.()
        observer.disconnect()
      }
    },{threshold:0.5})
    observer.observe(node)
    return()=>{observer.disconnect();clean()}
  },[anchor])
  const card=<section id={sectionActions?undefined:anchor} ref={section} aria-labelledby={anchor+'-title'} style={{scrollMarginTop:96,margin:sectionActions?'12px auto 4px':'20px auto',width:'100%',maxWidth:680,boxSizing:'border-box',border:'1px solid #e2e8f0',borderRadius:16,overflow:'hidden',background:'#fff',color:'#0f172a',textAlign:'center'}}>
    <div aria-hidden="true" style={{height:5,background:'linear-gradient(to right,#4285f4 0 25%,#34a853 25% 50%,#fbbc05 50% 75%,#ea4335 75% 100%)'}}/>
    <div style={{padding:'20px 16px'}}>
      {decorativeStars&&<div aria-hidden="true" style={{display:'flex',justifyContent:'center',gap:5,marginBottom:10}}>
        {Array.from({length:5},(_,i)=><svg key={i} width="24" height="24" viewBox="0 0 24 24" fill="#e5a400" focusable="false"><path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8-6.2-3.2-6.2 3.2 1.2-6.8-5-4.9 6.9-1z"/></svg>)}
      </div>}
      <h2 id={anchor+'-title'} style={{fontSize:20,fontWeight:700,lineHeight:1.3,margin:'0 0 8px'}}>Tu opinión es importante</h2>
      <p style={{fontSize:15,lineHeight:1.5,margin:'0 0 16px',color:'#475569'}}>Comparte tu experiencia con nosotros.</p>
      <div style={{color:accent||'#1d4ed8'}}>{action}</div>
    </div>
  </section>
  if(!sectionActions)return card
  return <section id={anchor} ref={outer} aria-labelledby={anchor+'-section-title'} style={{scrollMarginTop:96,borderTop:'1px solid var(--ilx-border,#e2e8f0)',borderBottom:'1px solid var(--ilx-border,#e2e8f0)',padding:'18px 0 12px',marginTop:22,minWidth:0,boxSizing:'border-box'}}>
    <h2 id={anchor+'-section-title'} className="text-xl font-black tracking-[-0.03em]" style={{color:'var(--ilx-text,#0f172a)',textAlign:'left',margin:0}}>Reseñas</h2>
    {card}
    {sectionActions}
  </section>
}
