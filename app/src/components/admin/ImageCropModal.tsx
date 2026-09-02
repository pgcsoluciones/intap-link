import { useEffect, useMemo, useRef, useState } from 'react'

interface Props {
  file: File
  aspectRatio?: number
  outputWidth?: number
  maxInputDimension?: number
  onSave: (blob: Blob) => void | Promise<void>
  onCancel: () => void
}

const PREVIEW_W = 272
const JPEG_Q = 0.82

type WorkingImage = {
  src: string
  width: number
  height: number
}

type Frame = {
  zoom: number
  fx: number
  fy: number
}

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value))
}

function computeCover(
  imageWidth: number,
  imageHeight: number,
  frame: Frame,
  targetWidth: number,
  targetHeight: number,
) {
  const zoom = Math.max(1, frame.zoom)
  const fx = clamp01(frame.fx)
  const fy = clamp01(frame.fy)
  const targetAspect = targetWidth / targetHeight

  let baseWidth: number
  let baseHeight: number

  if (imageWidth / imageHeight > targetAspect) {
    baseHeight = imageHeight
    baseWidth = imageHeight * targetAspect
  } else {
    baseWidth = imageWidth
    baseHeight = imageWidth / targetAspect
  }

  const cropWidth = baseWidth / zoom
  const cropHeight = baseHeight / zoom
  const cropX = (imageWidth - cropWidth) * fx
  const cropY = (imageHeight - cropHeight) * fy

  return { cropX, cropY, cropWidth, cropHeight }
}

function prepareWorkingImage(img: HTMLImageElement, maxDimension: number): WorkingImage {
  const { naturalWidth, naturalHeight } = img
  if (naturalWidth <= maxDimension && naturalHeight <= maxDimension) {
    return { src: img.src, width: naturalWidth, height: naturalHeight }
  }

  const scale = maxDimension / Math.max(naturalWidth, naturalHeight)
  const width = Math.max(1, Math.round(naturalWidth * scale))
  const height = Math.max(1, Math.round(naturalHeight * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) return { src: img.src, width: naturalWidth, height: naturalHeight }
  context.drawImage(img, 0, 0, width, height)
  return { src: canvas.toDataURL('image/jpeg', 0.95), width, height }
}

export default function ImageCropModal({
  file,
  aspectRatio = 1,
  outputWidth = 400,
  maxInputDimension = 2000,
  onSave,
  onCancel,
}: Props) {
  const previewHeight = Math.round(PREVIEW_W / aspectRatio)
  const outputHeight = Math.round(outputWidth / aspectRatio)

  const imageRef = useRef<HTMLImageElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const pointerRef = useRef<{ x: number; y: number } | null>(null)

  const [working, setWorking] = useState<WorkingImage | null>(null)
  const [frame, setFrame] = useState<Frame>({ zoom: 1, fx: 0.5, fy: 0.5 })
  const [dragging, setDragging] = useState(false)
  const [saveStage, setSaveStage] = useState<'idle' | 'processing' | 'uploading'>('idle')

  const crop = useMemo(() => {
    if (!working) return null
    return computeCover(working.width, working.height, frame, PREVIEW_W, previewHeight)
  }, [working, frame, previewHeight])

  useEffect(() => {
    const objectUrl = URL.createObjectURL(file)
    const source = new Image()
    let objectUrlRevoked = false

    source.onload = () => {
      const prepared = prepareWorkingImage(source, maxInputDimension)
      if (prepared.src !== objectUrl) {
        URL.revokeObjectURL(objectUrl)
        objectUrlRevoked = true
      }

      const workingImage = new Image()
      workingImage.onload = () => {
        imageRef.current = workingImage
        setWorking(prepared)
        setFrame({ zoom: 1, fx: 0.5, fy: 0.5 })
      }
      workingImage.src = prepared.src
    }
    source.src = objectUrl

    return () => {
      imageRef.current = null
      if (!objectUrlRevoked) URL.revokeObjectURL(objectUrl)
    }
  }, [file, maxInputDimension])

  useEffect(() => {
    const canvas = canvasRef.current
    const image = imageRef.current
    if (!canvas || !image || !crop) return

    const pixelRatio = Math.max(1, Math.min(2, window.devicePixelRatio || 1))
    canvas.width = Math.round(PREVIEW_W * pixelRatio)
    canvas.height = Math.round(previewHeight * pixelRatio)
    canvas.style.width = `${PREVIEW_W}px`
    canvas.style.height = `${previewHeight}px`

    const context = canvas.getContext('2d')
    if (!context) return
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
    context.clearRect(0, 0, PREVIEW_W, previewHeight)
    context.drawImage(
      image,
      crop.cropX,
      crop.cropY,
      crop.cropWidth,
      crop.cropHeight,
      0,
      0,
      PREVIEW_W,
      previewHeight,
    )
  }, [crop, previewHeight])

  function changeZoom(nextZoom: number) {
    setFrame((current) => ({ ...current, zoom: nextZoom }))
  }

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId)
    pointerRef.current = { x: event.clientX, y: event.clientY }
    setDragging(true)
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!dragging || !pointerRef.current || !working || !crop) return

    const dx = event.clientX - pointerRef.current.x
    const dy = event.clientY - pointerRef.current.y
    pointerRef.current = { x: event.clientX, y: event.clientY }

    const availableX = Math.max(0, working.width - crop.cropWidth)
    const availableY = Math.max(0, working.height - crop.cropHeight)
    const sourceDx = -(dx / PREVIEW_W) * crop.cropWidth
    const sourceDy = -(dy / previewHeight) * crop.cropHeight

    setFrame((current) => ({
      ...current,
      fx: availableX > 0 ? clamp01(current.fx + sourceDx / availableX) : 0.5,
      fy: availableY > 0 ? clamp01(current.fy + sourceDy / availableY) : 0.5,
    }))
  }

  function onPointerUp(event?: React.PointerEvent<HTMLDivElement>) {
    if (event?.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    pointerRef.current = null
    setDragging(false)
  }

  function handleConfirm() {
    const image = imageRef.current
    if (!image || !crop || saveStage !== 'idle') return

    setSaveStage('processing')
    const canvas = document.createElement('canvas')
    canvas.width = outputWidth
    canvas.height = outputHeight
    const context = canvas.getContext('2d')
    if (!context) { setSaveStage('idle'); return }

    context.drawImage(
      image,
      crop.cropX,
      crop.cropY,
      crop.cropWidth,
      crop.cropHeight,
      0,
      0,
      outputWidth,
      outputHeight,
    )

    canvas.toBlob(async (blob) => {
      if (!blob) { setSaveStage('idle'); return }
      setSaveStage('uploading')
      try {
        await Promise.resolve(onSave(blob))
      } finally {
        setSaveStage('idle')
      }
    }, 'image/jpeg', JPEG_Q)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="flex w-full max-w-sm flex-col gap-5 rounded-2xl bg-[#111827] p-5 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-white">Encuadrar imagen</h2>
          <button type="button" onClick={onCancel} disabled={saveStage !== 'idle'} className="text-lg leading-none text-slate-400 hover:text-white disabled:cursor-not-allowed disabled:opacity-35">✕</button>
        </div>

        <div
          className="relative mx-auto overflow-hidden rounded-xl bg-black select-none"
          style={{ width: PREVIEW_W, height: previewHeight, cursor: dragging ? 'grabbing' : 'grab', touchAction: 'none' }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <canvas ref={canvasRef} className="block" />

          <svg className="pointer-events-none absolute inset-0" width={PREVIEW_W} height={previewHeight} style={{ opacity: 0.25 }}>
            <line x1={PREVIEW_W / 3} y1={0} x2={PREVIEW_W / 3} y2={previewHeight} stroke="white" strokeWidth="1" />
            <line x1={(PREVIEW_W * 2) / 3} y1={0} x2={(PREVIEW_W * 2) / 3} y2={previewHeight} stroke="white" strokeWidth="1" />
            <line x1={0} y1={previewHeight / 3} x2={PREVIEW_W} y2={previewHeight / 3} stroke="white" strokeWidth="1" />
            <line x1={0} y1={(previewHeight * 2) / 3} x2={PREVIEW_W} y2={(previewHeight * 2) / 3} stroke="white" strokeWidth="1" />
            <rect x={1} y={1} width={PREVIEW_W - 2} height={previewHeight - 2} fill="none" stroke="white" strokeWidth="1.5" />
          </svg>
        </div>

        <p className="-mt-2 text-center text-[11px] text-slate-400">
          Arrastra para encuadrar • Desliza para hacer zoom
        </p>

        <div className="flex items-center gap-3">
          <span className="w-5 text-center text-xs text-slate-400">🔍</span>
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={frame.zoom}
            onChange={(event) => changeZoom(Number(event.target.value))}
            className="flex-1 accent-[#3b82f6]"
          />
          <span className="w-8 text-right text-xs text-slate-400">{frame.zoom.toFixed(1)}×</span>
        </div>

        <div className="flex gap-3">
          <button type="button" onClick={onCancel} disabled={saveStage !== 'idle'} className="flex-1 rounded-xl border border-white/10 py-2.5 text-sm text-slate-300 transition-colors hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-35">
            Cancelar
          </button>
          <button type="button" onClick={handleConfirm} disabled={!working || saveStage !== 'idle'} className="flex-1 rounded-xl bg-gradient-to-r from-[#3b82f6] to-purple-600 py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40">
            {saveStage === 'processing' ? 'Procesando imagen…' : saveStage === 'uploading' ? 'Subiendo imagen…' : 'Usar imagen'}
          </button>
        </div>
      </div>
    </div>
  )
}
