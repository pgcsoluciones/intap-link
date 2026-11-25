import ReviewSection from './ReviewSection'

export default function GoogleReviewSection({url,onImpression,onClick,accent}:{url:string;onImpression?:()=>void;onClick?:()=>void;accent?:string}) {
  return <ReviewSection accent={accent} onImpression={onImpression} action={
    <a href={url} target="_blank" rel="noopener noreferrer" onClick={onClick} style={{display:'flex',alignItems:'center',justifyContent:'center',flexWrap:'wrap',gap:10,minHeight:44,padding:'10px 14px',boxSizing:'border-box',border:'1px solid #cbd5e1',borderRadius:10,color:'inherit',fontWeight:700,fontSize:15,textDecoration:'none'}}>
      <svg width="23" height="23" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
        <path fill="#4285F4" d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11a9.4 9.4 0 0 1-4.1 6.2v5h6.6c3.9-3.6 6.1-8.8 6.1-14.9z"/>
        <path fill="#34A853" d="M24 44c5.5 0 10.1-1.8 13.5-4.9l-6.6-5A12.3 12.3 0 0 1 12.6 27H5.8v5.2A20 20 0 0 0 24 44z"/>
        <path fill="#FBBC05" d="M12.6 27a12 12 0 0 1 0-6V15.8H5.8a20 20 0 0 0 0 16.4z"/>
        <path fill="#EA4335" d="M24 12c3 0 5.7 1 7.8 3.1l5.8-5.8A19 19 0 0 0 24 4 20 20 0 0 0 5.8 15.8l6.8 5.2A12 12 0 0 1 24 12z"/>
      </svg>
      Deja tu reseña en Google
    </a>
  }/>
}
