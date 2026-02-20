export const onRequest: PagesFunction = async (context) => {
  const url = new URL(context.request.url)
  const slug = url.searchParams.get('slug')

  if (url.pathname === '/' && slug) {
    const clean = slug.trim()
    if (!clean) return context.next()
    return Response.redirect(`${url.origin}/${encodeURIComponent(clean)}`, 302)
  }

  return context.next()
}
