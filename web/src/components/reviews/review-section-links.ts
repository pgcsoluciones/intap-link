/** Public section links; Google URL is deliberately not an input. */
export function reviewSectionLinks(origin:string,slug:string){
  const profile=new URL('/'+encodeURIComponent(slug),origin)
  profile.hash='resenas'
  const shareUrl=profile.href
  profile.searchParams.set('src','reviews-qr')
  return {shareUrl,qrUrl:profile.href}
}
