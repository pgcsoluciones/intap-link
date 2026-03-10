import { useCallback, useEffect, useRef, useState } from 'react'

interface Props {
  file: File
  aspectRatio?: number   // width/height — default 1 (square)
  outputWidth?: number   // canvas output px — default 400
  /** Maximum dimension (px) of the internal working image. Larger photos are
   *  pre-downscaled to save memory and speed up the drag interaction.
   *  Default: 2000 */
  maxInputDimension?: number
  onSave: (blob: Blob) => void
  onCancel: () => void
}

const PREVIEW_W  = 272
const JPEG_Q     = 0.82   // output quality — good balance size vs sharpness

/** Downscale a loaded HTMLImageElement to a canvas if either dimension exceeds
 *  `maxDim`. Returns a data-URL (or the original object-URL unchanged). */
function preshrink(img: HTMLImageElement, maxDim: number): { src: string; w: number; h: number } {
  const { naturalWidth: nw, naturalHeight: nh } = img
  if (nw <= maxDim && nh <= maxDim) return { src: img.src, w: nw, h: nh }
  const scale = maxDim / Math.max(nw, nh)
  const tw = Math.round(nw * scale)
  const th = Math.round(nh * scale)
  const c = document.createElement('canvas')
  c.width = tw; c.height = th
  c.getContext('2d')!.drawImage(img, 0, 0, tw, th)
  return { src: c.toDataURL('image/jpeg', 0.95), w: tw, h: th }
}

export default function ImageCropModal({
  file,
  aspectRatio = 1,
  outputWidth = 400,
  maxInputDimension = 2000,
  onSave,
  onCancel,
}: Props) {
  const PREVIEW_H = Math.round(PREVIEW_W / aspectRatio)
  const outputHeight = Math.round(outputWidth / aspectRatio)

  const [imgSrc, setImgSrc] = useState('')
  const [naturalW, setNaturalW] = useState(1)
  const [naturalH, setNaturalH] = useState(1)
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)

  const imgRef = useRef<HTMLImageElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const lastPointerRef = useRef({ x: 0, y: 0 })

  // Load the file → pre-shrink if oversized → use as working image
  useEffect(() => {
    const objUrl = URL.createObjectURL(file)
    const tmp = new Image()
    tmp.onload = () => {
      const { src, w, h } = preshrink(tmp, maxInputDimension)
      // If preshrink returned a data-URL we no longer need the object URL
      if (src !== objUrl) URL.revokeObjectURL(objUrl)
      setImgSrc(src)
      setNaturalW(w)
      setNaturalH(h)
    }
    tmp.src = objUrl
    // Cleanup: only revoke the object URL if preshrink didn't already
    return () => { if (imgSrc !== objUrl) URL.revokeObjectURL(objUrl) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file])

  // Displayed image dimensions inside the preview box
  const displayW = PREVIEW_W * zoom
  const displayH = (naturalH / naturalW) * PREVIEW_W * zoom

  // Clamp offset so the image always covers the preview area
  const clamp = useCallback(
    (off: { x: number; y: number }) => {
      const minX = PREVIEW_W - displayW
      const minY = PREVIEW_H - displayH
      return {
        x: Math.min(0, Math.max(minX, off.x)),
        y: Math.min(0, Math.max(minY, off.y)),
      }
    },
    [displayW, displayH, PREVIEW_W, PREVIEW_H],
  )

  // Center image when it first renders (natural dims already set by preshrink)
  const handleImageLoad = () => {
    const img = imgRef.current
    if (!img) return
    const nw = img.naturalWidth  || naturalW
    const nh = img.naturalHeight || naturalH

    // Pick a default zoom so the image fills the preview frame
    const fitZoom = Math.max(PREVIEW_W / nw, PREVIEW_H / nh)
    const initZoom = Math.max(1, fitZoom)
    setZoom(initZoom)

    const dw = PREVIEW_W * initZoom
    const dh = (nh / nw) * PREVIEW_W * initZoom
    setOffset({ x: (PREVIEW_W - dw) / 2, y: (PREVIEW_H - dh) / 2 })
  }

  // Re-clamp when zoom changes
  useEffect(() => {
    setOffset((prev) => clamp(prev))
  }, [zoom, clamp])

  // Pointer drag handlers
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    lastPointerRef.current = { x: e.clientX, y: e.clientY }
    setDragging(true)
  }

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return
    const dx = e.clientX - lastPointerRef.current.x
    const dy = e.clientY - lastPointerRef.current.y
    lastPointerRef.current = { x: e.clientX, y: e.clientY }
    setOffset((prev) => clamp({ x: prev.x + dx, y: prev.y + dy }))
  }

  const onPointerUp = () => setDragging(false)

  // Export cropped image via Canvas
  const handleConfirm = () => {
    const img = imgRef.current
    if (!img) return

    const canvas = document.createElement('canvas')
    canvas.width = outputWidth
    canvas.height = outputHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Map preview-box coordinates back to natural image coordinates
    const scaleX = naturalW / displayW
    const scaleY = naturalH / displayH

    const srcX = -offset.x * scaleX
    const srcY = -offset.y * scaleY
    const srcW = PREVIEW_W * scaleX
    const srcH = PREVIEW_H * scaleY

    ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, outputWidth, outputHeight)
    canvas.toBlob(
      (blob) => { if (blob) onSave(blob) },
      'image/jpeg',
      JPEG_Q,
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="bg-[#111827] rounded-2xl w-full max-w-sm flex flex-col gap-5 p-5 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-white">Encuadrar imagen</h2>
          <button onClick={onCancel} className="text-slate-400 hover:text-white text-lg leading-none">✕</button>
        </div>

        {/* Preview / drag area */}
        <div
          ref={containerRef}
          className="relative overflow-hidden rounded-xl mx-auto select-none"
          style={{ width: PREVIEW_W, height: PREVIEW_H, cursor: dragging ? 'grabbing' : 'grab', background: '#000' }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {imgSrc && (
            <img
              ref={imgRef}
              src={imgSrc}
              alt=""
              draggable={false}
              onLoad={handleImageLoad}
              style={{
                position: 'absolute',
                left: offset.x,
                top: offset.y,
                width: displayW,
                height: displayH,
                userSelect: 'none',
                pointerEvents: 'none',
              }}
            />
          )}

          {/* Rule-of-thirds overlay */}
          <svg
            className="absolute inset-0 pointer-events-none"
            width={PREVIEW_W}
            height={PREVIEW_H}
            style={{ opacity: 0.25 }}
          >
            {/* Vertical thirds */}
            <line x1={PREVIEW_W / 3} y1={0} x2={PREVIEW_W / 3} y2={PREVIEW_H} stroke="white" strokeWidth="1" />
            <line x1={(PREVIEW_W * 2) / 3} y1={0} x2={(PREVIEW_W * 2) / 3} y2={PREVIEW_H} stroke="white" strokeWidth="1" />
            {/* Horizontal thirds */}
            <line x1={0} y1={PREVIEW_H / 3} x2={PREVIEW_W} y2={PREVIEW_H / 3} stroke="white" strokeWidth="1" />
            <line x1={0} y1={(PREVIEW_H * 2) / 3} x2={PREVIEW_W} y2={(PREVIEW_H * 2) / 3} stroke="white" strokeWidth="1" />
            {/* Border */}
            <rect x={1} y={1} width={PREVIEW_W - 2} height={PREVIEW_H - 2} fill="none" stroke="white" strokeWidth="1.5" />
          </svg>
        </div>

        <p className="text-[11px] text-slate-400 text-center -mt-2">
          Arrastra para encuadrar • Desliza para hacer zoom
        </p>

        {/* Zoom slider */}
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400 w-5 text-center">🔍</span>
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="flex-1 accent-[#3b82f6]"
          />
          <span className="text-xs text-slate-400 w-8 text-right">{zoom.toFixed(1)}×</span>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl border border-white/10 text-sm text-slate-300 hover:bg-white/5 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-[#3b82f6] to-purple-600 text-white text-sm font-bold transition-opacity hover:opacity-90"
          >
            Usar imagen
          </button>
        </div>
      </div>
    </div>
  )
}
