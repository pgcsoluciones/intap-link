export type SupportedImage = {
  bytes: ArrayBuffer
  contentType: 'image/gif' | 'image/jpeg' | 'image/png' | 'image/webp'
  extension: 'gif' | 'jpg' | 'png' | 'webp'
}

function startsWith(bytes: Uint8Array, signature: number[]): boolean {
  return signature.every((value, index) => bytes[index] === value)
}

export async function inspectImageFile(
  file: File,
  options: { allowGif?: boolean } = {},
): Promise<SupportedImage | null> {
  if (file.size <= 0 || file.size > 5 * 1024 * 1024) return null

  const buffer = await file.arrayBuffer()
  const bytes = new Uint8Array(buffer)

  if (startsWith(bytes, [0xff, 0xd8, 0xff])) {
    return { bytes: buffer, contentType: 'image/jpeg', extension: 'jpg' }
  }

  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return { bytes: buffer, contentType: 'image/png', extension: 'png' }
  }

  if (
    startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return { bytes: buffer, contentType: 'image/webp', extension: 'webp' }
  }

  if (
    options.allowGif &&
    startsWith(bytes, [0x47, 0x49, 0x46, 0x38]) &&
    (bytes[4] === 0x37 || bytes[4] === 0x39) &&
    bytes[5] === 0x61
  ) {
    return { bytes: buffer, contentType: 'image/gif', extension: 'gif' }
  }

  return null
}

export function extractOwnedAssetKey(
  value: string | null | undefined,
  expectedPrefix: string,
): string | null {
  if (!value) return null

  try {
    const pathname = new URL(value, 'https://assets.invalid').pathname
    const publicPrefix = '/api/v1/public/assets/'
    if (!pathname.startsWith(publicPrefix)) return null

    const key = decodeURIComponent(pathname.slice(publicPrefix.length))
    if (!key.startsWith(expectedPrefix)) return null

    const filename = key.slice(expectedPrefix.length)
    if (!/^[0-9a-f-]+\.(?:gif|jpe?g|png|webp)$/i.test(filename)) return null
    return key
  } catch {
    return null
  }
}
