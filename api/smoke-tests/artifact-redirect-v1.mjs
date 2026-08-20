import assert from 'node:assert/strict'

globalThis.fetch = async (input) => {
  const url = String(input)
  if (url.includes('/artifacts/ZXCV234567/resolve')) {
    return new Response(JSON.stringify({ ok: true, data: { redirect_path: '/jpconsulting' } }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  return new Response('{}', { status: 404 })
}

const { onRequest } = await import(process.env.INTAP_B2_MIDDLEWARE || '../../functions/_middleware.ts')
const response = await onRequest({
  request: new Request('https://preview.example.test/l/ZXCV234567?source=nfc'),
  next: async () => new Response('should not reach Pages asset fallback', { status: 500 }),
})

assert.equal(response.status, 302)
assert.equal(response.headers.get('location'), 'https://preview.example.test/jpconsulting?source=nfc')
assert.equal(response.headers.get('cache-control'), 'no-store, no-cache, must-revalidate, max-age=0')
assert.equal(response.headers.get('x-content-type-options'), 'nosniff')
console.log('B2 artifact redirect smoke test: PASS (302, query preserved, no-store)')
