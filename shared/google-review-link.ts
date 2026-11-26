/** Provider URL contract shared by Kawlink App and API; no network calls. */
export const COUNTRY_CODES = 'AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW'.split(' ')
export function countryName(code: unknown, language:'es'|'en'='es'):string|null {
  if(typeof code!=='string'||!COUNTRY_CODES.includes(code))return null
  return new Intl.DisplayNames([language],{type:'region'}).of(code)||null
}
export function validGooglePlaceId(value:unknown):value is string {
  // Opaque identifier, no required prefix/length; bounded only for URL/storage safety.
  return typeof value==='string'&&/^[A-Za-z0-9_-]{1,1024}$/.test(value)
}
export function buildGoogleReviewUrl(id:unknown):string|null {
  if(!validGooglePlaceId(id))return null
  const url=new URL('https://search.google.com/local/writereview')
  url.searchParams.set('placeid',id)
  return url.href
}
export function normalizeGoogleReviewUrl(value:unknown):string|null {
  if(typeof value!=='string'||value.length>2048||/[\u0000-\u0020\u007f\\]/.test(value))return null
  let url:URL
  try{url=new URL(value)}catch{return null}
  if(url.protocol!=='https:'||url.username||url.password||url.port||url.hash)return null
  if(url.hostname==='search.google.com'&&url.pathname==='/local/writereview'){
    const ids=url.searchParams.getAll('placeid')
    if(ids.length!==1||!validGooglePlaceId(ids[0])||[...url.searchParams.keys()].some(k=>k!=='placeid'))return null
    return url.href
  }
  if(url.hostname==='g.page'&&/^\/r\/[A-Za-z0-9_-]+\/review\/?$/.test(url.pathname)&&!url.search)return url.href
  return null
}
