export async function onRequest(): Promise<Response> {
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 1024 1536" preserveAspectRatio="xMidYMid meet" role="img" aria-labelledby="title desc">
  <title id="title">A&amp;C Dominicana — perfil temporalmente fuera de línea</title>
  <desc id="desc">Perfil en proceso de rediseño. Estará en línea en breve.</desc>
  <rect width="1024" height="1536" fill="#f5f7fa"/>
  <image href="/assets/aycdom/perfil-temporalmente-fuera-de-linea.webp" x="0" y="0" width="1024" height="1536" preserveAspectRatio="xMidYMid meet"/>
</svg>`;

  return new Response(body, {
    status: 503,
    headers: {
      'Content-Type': 'image/svg+xml; charset=UTF-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      'Pragma': 'no-cache',
      'Retry-After': '3600',
      'X-Robots-Tag': 'noindex, nofollow, noarchive',
      'Content-Security-Policy': "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'",
    },
  });
}
