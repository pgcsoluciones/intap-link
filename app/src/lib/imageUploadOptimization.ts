type OptimizeImageOptions = {
  maxDimension?: number
  quality?: number
  baseName?: string
}

function cleanBaseName(value: string) {
  return value.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9-_]+/g, '-').replace(/^-+|-+$/g, '') || 'image'
}

async function loadImageSource(blob: Blob) {
  let bitmap: ImageBitmap | null = null
  const objectUrl = URL.createObjectURL(blob)
  try {
    if (typeof createImageBitmap === 'function') {
      try {
        bitmap = await createImageBitmap(blob)
        return { source: bitmap as CanvasImageSource, width: bitmap.width, height: bitmap.height, cleanup: () => { bitmap?.close(); URL.revokeObjectURL(objectUrl) } }
      } catch { /* fallback to HTMLImageElement */ }
    }

    const image = new Image()
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = () => reject(new Error('No se pudo leer la imagen.'))
      image.src = objectUrl
    })
    return { source: image as CanvasImageSource, width: image.naturalWidth, height: image.naturalHeight, cleanup: () => URL.revokeObjectURL(objectUrl) }
  } catch (error) {
    bitmap?.close()
    URL.revokeObjectURL(objectUrl)
    throw error
  }
}

export async function optimizeImageBlobForUpload(input: Blob | File, options: OptimizeImageOptions = {}): Promise<File> {
  const maxDimension = Math.max(64, options.maxDimension ?? 1600)
  const quality = Math.min(0.95, Math.max(0.5, options.quality ?? 0.82))
  const originalName = input instanceof File ? input.name : options.baseName || 'image'
  const baseName = cleanBaseName(options.baseName || originalName)
  const loaded = await loadImageSource(input)

  try {
    const scale = Math.min(1, maxDimension / Math.max(loaded.width, loaded.height))
    const width = Math.max(1, Math.round(loaded.width * scale))
    const height = Math.max(1, Math.round(loaded.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('No se pudo preparar la imagen.')
    context.drawImage(loaded.source, 0, 0, width, height)

    const preserveAlpha = input.type === 'image/png' || input.type === 'image/webp'
    const encode = (type: string, encodeQuality?: number) => new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, encodeQuality))
    let output = await encode('image/webp', quality)
    let extension = 'webp'
    if (!output || output.type !== 'image/webp') {
      output = preserveAlpha ? await encode('image/png') : await encode('image/jpeg', quality)
      extension = preserveAlpha ? 'png' : 'jpg'
    }
    if (!output) throw new Error('No se pudo optimizar la imagen.')

    return new File([output], `${baseName}.${extension}`, { type: output.type, lastModified: Date.now() })
  } finally {
    loaded.cleanup()
  }
}
