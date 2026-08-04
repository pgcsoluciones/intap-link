const TRACKING_QUERY_PARAMETERS = new Set([
  'fbclid',
  'gclid',
  'utm_campaign',
  'utm_content',
  'utm_medium',
  'utm_source',
  'utm_term',
])

export function normalizeQuickActionUrl(value: string): string | null {
  try {
    const url = new URL(value.trim())
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null

    let hostname = url.hostname.toLowerCase()
    if (hostname.startsWith('www.')) hostname = hostname.slice(4)

    const pathname = url.pathname.replace(/\/+$/, '') || '/'
    const normalizedParameters = [...url.searchParams.entries()]
      .filter(([key]) => !TRACKING_QUERY_PARAMETERS.has(key.toLowerCase()))
      .sort(([leftKey, leftValue], [rightKey, rightValue]) =>
        leftKey.localeCompare(rightKey) || leftValue.localeCompare(rightValue)
      )

    const search = new URLSearchParams(normalizedParameters).toString()
    return `${hostname}${url.port ? `:${url.port}` : ''}${pathname}${search ? `?${search}` : ''}`
  } catch {
    return null
  }
}
