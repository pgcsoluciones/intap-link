import {countryName,validGooglePlaceId} from '../../../shared/google-review-link'
export const GOOGLE_PLACES_ENDPOINT='https://places.googleapis.com/v1/places:searchText'
export const GOOGLE_PLACES_FIELD_MASK='places.id'
export const GOOGLE_SEARCH_POLICY='FREE_ONLY'
type SearchInput={businessName:string;city:string;address:string;countryCode:string;language:'es'|'en'}
export type GoogleSearchEnv={GOOGLE_REVIEWS_SEARCH_ENABLED?:string;GOOGLE_PLACES_API_KEY?:string;GOOGLE_MAPS_EMBED_KEY?:string;GOOGLE_REVIEWS_SEARCH_DAILY_LIMIT?:string;DB:D1Database}
const text=(v:unknown,max:number,required:boolean)=>{
 if(typeof v!=='string'||v.length>max||/[\u0000-\u001f\u007f]/.test(v))return null
 const clean=v.trim()
 return required&&!clean?null:clean
}
export function parseGoogleSearchInput(value:unknown):SearchInput|null{
 if(!value||typeof value!=='object'||Array.isArray(value))return null
 const r=value as Record<string,unknown>
 if(Object.keys(r).some(k=>!['businessName','city','address','countryCode','language'].includes(k)))return null
 const language=r.language??'es'
 if(language!=='es'&&language!=='en')return null
 const businessName=text(r.businessName,120,true),city=text(r.city,100,true),address=text(r.address??'',180,false)
 const code=r.countryCode
 if(businessName===null||city===null||address===null||typeof code!=='string'||!countryName(code,language))return null
 return {businessName,city,address,countryCode:code,language}
}
export function googleSearchCapability(env:GoogleSearchEnv):{available:boolean;embedKey?:string}{
 const key=env.GOOGLE_PLACES_API_KEY,embed=env.GOOGLE_MAPS_EMBED_KEY
 const valid=(v:unknown):v is string=>typeof v==='string'&&/^[A-Za-z0-9_-]{20,200}$/.test(v)
 if(env.GOOGLE_REVIEWS_SEARCH_ENABLED!=='1'||!valid(key)||!valid(embed)||key===embed)return {available:false}
 return {available:true,embedKey:embed}
}
export class GoogleSearchError extends Error {
 constructor(public readonly code:'GOOGLE_SEARCH_UNAVAILABLE'|'GOOGLE_SEARCH_TIMEOUT'|'GOOGLE_SEARCH_LIMIT'|'GOOGLE_SEARCH_BILLING'|'GOOGLE_SEARCH_PROVIDER_DENIED',public readonly status:503|504|429){super(code)}
}
export async function searchGooglePlaces(input:SearchInput,env:GoogleSearchEnv,request:typeof fetch=fetch){
 if(!googleSearchCapability(env).available)throw new GoogleSearchError('GOOGLE_SEARCH_UNAVAILABLE',503)
 const country=countryName(input.countryCode,input.language)
 if(!country)throw new GoogleSearchError('GOOGLE_SEARCH_UNAVAILABLE',503)
 let response:Response
 try{
  response=await request(GOOGLE_PLACES_ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json','X-Goog-Api-Key':env.GOOGLE_PLACES_API_KEY!,'X-Goog-FieldMask':GOOGLE_PLACES_FIELD_MASK},body:JSON.stringify({textQuery:[input.businessName,input.address,input.city,country].filter(Boolean).join(', '),languageCode:input.language,regionCode:input.countryCode,pageSize:5}),redirect:'error',signal:AbortSignal.timeout(8000)})
 }catch(e){if(e instanceof Error&&['TimeoutError','AbortError'].includes(e.name))throw new GoogleSearchError('GOOGLE_SEARCH_TIMEOUT',504);throw new GoogleSearchError('GOOGLE_SEARCH_UNAVAILABLE',503)}
 if(response.status===429)throw new GoogleSearchError('GOOGLE_SEARCH_LIMIT',429)
 if(!response.ok){
  // Classify only bounded provider error fields. Never return or log provider text, request, or key.
  if([400,402,403].includes(response.status)){
   const error=await response.json().catch(()=>null) as any
   const reasons=Array.isArray(error?.error?.details)?error.error.details.map((d:any)=>d?.reason):[]
   const message=typeof error?.error?.message==='string'?error.error.message.slice(0,2000):''
   const billing=reasons.some((r:unknown)=>typeof r==='string'&&['BILLING_DISABLED','BILLING_NOT_ENABLED','BILLING_ACCOUNT_DISABLED','PROJECT_BILLING_DISABLED'].includes(r))||/billing (?:must be enabled|has not been enabled|is not enabled|is disabled)|enable billing on (?:the|your) (?:google cloud )?project|billing account.*(?:not active|disabled|not enabled)/i.test(message)
   if(billing)throw new GoogleSearchError('GOOGLE_SEARCH_BILLING',503)
   throw new GoogleSearchError('GOOGLE_SEARCH_PROVIDER_DENIED',503)
  }
  throw new GoogleSearchError('GOOGLE_SEARCH_UNAVAILABLE',503)
 }
 let body:unknown
 try{body=await response.json()}catch{throw new GoogleSearchError('GOOGLE_SEARCH_UNAVAILABLE',503)}
 if(!body||typeof body!=='object'||Array.isArray(body))throw new GoogleSearchError('GOOGLE_SEARCH_UNAVAILABLE',503)
 const raw=body as Record<string,unknown>
 if(raw.error!==undefined)throw new GoogleSearchError('GOOGLE_SEARCH_UNAVAILABLE',503)
 if(raw.places===undefined)return []
 if(!Array.isArray(raw.places)||raw.places.length>5)throw new GoogleSearchError('GOOGLE_SEARCH_UNAVAILABLE',503)
 const ids:string[]=[]
 for(const p of raw.places){if(!p||typeof p!=='object'||!validGooglePlaceId(p.id))throw new GoogleSearchError('GOOGLE_SEARCH_UNAVAILABLE',503);ids.push(p.id)}
 return [...new Set(ids)].map(placeId=>({placeId}))
}
export const GOOGLE_SEARCH_RESERVE_SQL=`INSERT INTO review_google_search_usage(id,user_id,profile_id,ip_hash,created_at)
 SELECT ?,?,?,?,unixepoch('now')
 WHERE (SELECT count(*) FROM review_google_search_usage WHERE user_id=? AND created_at>unixepoch('now')-60)<5
 AND (SELECT count(*) FROM review_google_search_usage WHERE profile_id=? AND created_at>unixepoch('now')-86400)<50
 AND (?='' OR (SELECT count(*) FROM review_google_search_usage WHERE ip_hash=? AND created_at>unixepoch('now')-60)<15)
 AND (SELECT count(*) FROM review_google_search_usage WHERE created_at>unixepoch('now')-86400)<?
`
export async function reserveGoogleSearch(env:GoogleSearchEnv,userId:string,profileId:string,ip:string){
 const raw=env.GOOGLE_REVIEWS_SEARCH_DAILY_LIMIT
 const limit=raw===undefined||raw===''?500:Number(raw)
 if(!Number.isInteger(limit)||limit<1||limit>5000)throw new GoogleSearchError('GOOGLE_SEARCH_UNAVAILABLE',503)
 let ipHash=''
 if(/^[0-9a-f:.]{3,64}$/i.test(ip)){
  // HMAC domain separation, no raw IP stored; never returned to browser.
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(env.GOOGLE_PLACES_API_KEY!),{name:'HMAC',hash:'SHA-256'},false,['sign'])
  const digest=await crypto.subtle.sign('HMAC',key,new TextEncoder().encode('kawvo-review-ip-v1:'+ip))
  ipHash=Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,'0')).join('')
 }
 try{
  // Cleanup only this operational table, bounded; reservation is atomic and counts failed provider calls.
  await env.DB.prepare("DELETE FROM review_google_search_usage WHERE id IN (SELECT id FROM review_google_search_usage WHERE created_at<=unixepoch('now')-172800 LIMIT 100)").run()
  const r=await env.DB.prepare(GOOGLE_SEARCH_RESERVE_SQL).bind(crypto.randomUUID(),userId,profileId,ipHash,userId,profileId,ipHash,ipHash,limit).run()
  if(r.meta.changes!==1)throw new GoogleSearchError('GOOGLE_SEARCH_LIMIT',429)
 }catch(e){if(e instanceof GoogleSearchError)throw e;throw new GoogleSearchError('GOOGLE_SEARCH_UNAVAILABLE',503)}
}
