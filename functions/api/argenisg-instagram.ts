interface Env {
  ARGENIS_INSTAGRAM_ACCESS_TOKEN?: string
  ARGENIS_INSTAGRAM_USER_ID?: string
}

type PagesContext = {
  request: Request
  env: Env
}

const json = (body: unknown, status = 200, cache = 'public, max-age=300, stale-while-revalidate=1800') =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': cache,
      'x-content-type-options': 'nosniff',
    },
  })

export const onRequestGet = async ({ env }: PagesContext) => {
  const token = env.ARGENIS_INSTAGRAM_ACCESS_TOKEN?.trim()
  if (!token) {
    return json({ configured: false, items: [] }, 503, 'no-store')
  }

  const user = env.ARGENIS_INSTAGRAM_USER_ID?.trim() || 'me'
  const url = new URL(`https://graph.instagram.com/${encodeURIComponent(user)}/media`)
  url.searchParams.set('fields', 'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp')
  url.searchParams.set('limit', '6')
  url.searchParams.set('access_token', token)

  try {
    const upstream = await fetch(url.toString(), {
      headers: { Accept: 'application/json' },
      cf: { cacheTtl: 300, cacheEverything: true },
    } as RequestInit)
    const payload = await upstream.json().catch(() => null) as { data?: unknown[]; error?: unknown } | null

    if (!upstream.ok || !payload || !Array.isArray(payload.data)) {
      console.error('Instagram feed upstream error', upstream.status, payload?.error ?? payload)
      return json({ configured: true, items: [], upstream_status: upstream.status }, 502, 'no-store')
    }

    return json({ configured: true, items: payload.data.slice(0, 6) })
  } catch (error) {
    console.error('Instagram feed request failed', error)
    return json({ configured: true, items: [] }, 502, 'no-store')
  }
}
