const PREVIEW_API_BASE = 'https://intap-api-preview.fliaprince.workers.dev';
const PRODUCTION_API_BASE = 'https://api.intaprd.com';

function isProductionHost(hostname: string): boolean {
  return hostname === 'intaprd.com' || hostname === 'www.intaprd.com';
}

export async function onRequest(context: { request: Request }): Promise<Response> {
  const incomingUrl = new URL(context.request.url);
  const apiOrigin = isProductionHost(incomingUrl.hostname)
    ? PRODUCTION_API_BASE
    : PREVIEW_API_BASE;

  const targetUrl = new URL(incomingUrl.pathname + incomingUrl.search, apiOrigin);
  const headers = new Headers(context.request.headers);
  headers.delete('host');

  const init: RequestInit = {
    method: context.request.method,
    headers,
    redirect: 'manual',
  };

  if (context.request.method !== 'GET' && context.request.method !== 'HEAD') {
    init.body = context.request.body;
  }

  try {
    return await fetch(targetUrl.toString(), init);
  } catch {
    return new Response(JSON.stringify({ ok: false, error: 'Demo API temporalmente no disponible' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json; charset=UTF-8', 'Cache-Control': 'no-store' },
    });
  }
}
