export const REVIEW_SHARE_MESSAGE='Tu opinión es de suma importancia para nosotros.'
export const EVALUATION_SHARE_MESSAGE='Tu evaluación es de suma importancia para nosotros.'
/** Google destination deliberately not an input. Med always uses /m/ and its own anchor. */
export function feedbackSectionLinks(origin:string,slug:string,mode:'link'|'med'='link',design=false){
 const med=mode==='med'
 const profile=new URL((med?'/m/':'/')+encodeURIComponent(slug),origin)
 profile.hash=med?'evaluaciones':'resenas'
 profile.searchParams.set('share',med?'evaluaciones':'reviews')
 if(med&&design)profile.searchParams.set('kawmed_evaluations_preview','1')
 const shareUrl=profile.href
 profile.searchParams.delete('share')
 profile.searchParams.set('src',med?'evaluaciones-qr':'reviews-qr')
 return {shareUrl,qrUrl:profile.href,shareText:(med?EVALUATION_SHARE_MESSAGE:REVIEW_SHARE_MESSAGE)+'\n'+shareUrl}
}
export function reviewSectionLinks(origin:string,slug:string){return feedbackSectionLinks(origin,slug)}
