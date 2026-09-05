import { useMemo, useState } from 'react'
import { FaChevronLeft, FaChevronRight, FaInstagram, FaPlay } from 'react-icons/fa'
import './InstagramLatestMedia.css'

export type InstagramMediaChild = {
  id?: string
  media_type?: string
  media_url?: string
  thumbnail_url?: string
}

export type InstagramMediaItem = InstagramMediaChild & {
  caption?: string
  permalink?: string
  timestamp?: string
  children?: InstagramMediaChild[]
}

function isVideo(type?: string) {
  return type === 'VIDEO' || type === 'REELS' || type === 'REEL'
}

function MediaPane({ item }: { item: InstagramMediaChild }) {
  const src = item.media_url || item.thumbnail_url || ''
  const poster = item.thumbnail_url || undefined
  if (!src) return <div className="adonis-ig-missing"><FaInstagram /></div>

  if (isVideo(item.media_type)) {
    return (
      <div className="adonis-ig-video-wrap">
        <video
          src={item.media_url}
          poster={poster}
          controls
          playsInline
          preload="metadata"
          className="adonis-ig-media"
        />
        <span className="adonis-ig-video-badge"><FaPlay /> Video</span>
      </div>
    )
  }

  return <img src={src} alt="Última publicación de Instagram" className="adonis-ig-media" />
}

export default function InstagramLatestMedia({ item }: { item: InstagramMediaItem }) {
  const slides = useMemo(() => {
    const children = Array.isArray(item.children) ? item.children.filter(child => child.media_url || child.thumbnail_url) : []
    if (item.media_type === 'CAROUSEL_ALBUM' && children.length) return children
    return [item]
  }, [item])
  const [index, setIndex] = useState(0)
  const active = slides[Math.min(index, slides.length - 1)] || item

  return (
    <article className="adonis-ig-latest" aria-label="Última publicación de Instagram">
      <div className="adonis-ig-stage">
        <MediaPane item={active} />
        {slides.length > 1 && <>
          <button
            type="button"
            className="adonis-ig-nav is-prev"
            onClick={() => setIndex(v => (v - 1 + slides.length) % slides.length)}
            aria-label="Anterior"
          ><FaChevronLeft /></button>
          <button
            type="button"
            className="adonis-ig-nav is-next"
            onClick={() => setIndex(v => (v + 1) % slides.length)}
            aria-label="Siguiente"
          ><FaChevronRight /></button>
          <div className="adonis-ig-counter">{index + 1}/{slides.length}</div>
        </>}
      </div>
      {item.caption && <p className="adonis-ig-caption">{item.caption}</p>}
    </article>
  )
}
