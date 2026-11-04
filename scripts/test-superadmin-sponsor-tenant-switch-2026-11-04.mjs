import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const src=readFileSync('app/src/components/admin/SuperAdminSponsors.tsx','utf8')
const medical=readFileSync('app/src/components/admin/KawMedClaim.tsx','utf8')
const sponsoredActivation=readFileSync('app/src/components/admin/sponsored/SponsoredActivation.tsx','utf8')
const p=(a,b)=>{const x=src.indexOf(a),y=src.indexOf(b,x+a.length);assert.ok(x>=0&&y>x,'Missing segment: '+a);return src.slice(x,y)}
const chooser=p('function chooseSponsor(item:Sponsor){','  async function load(){')
assert.match(src,/useRef\(/, 'Sponsor change guarded by a ref')
assert.match(chooser,/selectedSponsorIdRef\.current=item\.id/, 'Synchronously bind active sponsor before UI update')
assert.match(chooser,/codeRequestIdRef\.current\+=1/, 'Invalidate in-flight sponsor inventory request immediately')
assert.match(chooser,/setBatch\(\{batch_name:'',quantity:10,product_type:'keychain',city:'',zone:'',notes:''\}\)/,'Never reuse prior sponsor batch parameters')
for(const val of ["setGenerated([])","setMaster(null)","setExistingCodes('')","setCommercialResource({resource_url:'',resource_label:''})","setModules({bank_accounts:false,commercial_contact:'none',commercial_resource:'none'})","setMembers([])","setCodes([])","setCodeQuery('')","setCodeStatus('all')","setCodeRole('all')","setError('')","setMessage('')"]){
  assert.ok(chooser.includes(val),'Missing tenant-switch reset: '+val)
}
assert.match(src,/onClick=\{\(\)=>chooseSponsor\(item\)\} disabled=\{saving\|\|Boolean\(bannerUpdating\)\}/,'Do not switch tenants during a pending write')
const effect=p('useEffect(()=>{\n    const sponsorId=selected?.id', '  const totals=useMemo(')
assert.match(effect,/let live=true/,'An asynchronous effect requires a cleanup guard')
assert.match(effect,/return \(\)=>\{live=false\}/,'Invalidate stale sponsor requests')
assert.match(effect,/if\(!live\|\|selectedSponsorIdRef\.current!==sponsorId\)return/g,'Guard delayed members/modules and commercial resource results')
assert.match(effect,/setCommercialResource\(result\?\.ok\?/, 'Blank resource on unavailable per-sponsor response')
const codes=p('async function loadCodes(page=1,filters?', '  const startNotice=')
assert.match(codes,/const sponsorId=selected\.id/,'Capture tenant ID for all code requests')
assert.match(codes,/if\(selectedSponsorIdRef\.current!==sponsorId\|\|codeRequestIdRef\.current!==requestId\)return/,'Block stale tenant or filter pagination')
assert.match(codes,/if\(selectedSponsorIdRef\.current===sponsorId&&codeRequestIdRef\.current===requestId\)setCodesLoading\(false\)/,'Do not stop latest loading from a stale request')
assert.match(medical,/Estación \{context\?\.display_code\|\|'sin ID físico'\}/,'MED first scan retains physical ID')
assert.match(medical,/Salir \/ Activar luego/,'MED first scan retains exit')
assert.match(medical,/import\.meta\.env\.VITE_WEB_URL/,'MED exit respects Preview Web URL instead of hardcoded Production')
assert.match(sponsoredActivation,/Activar luego/,'Sponsored second-stage exit exists')
assert.match(sponsoredActivation,/import\.meta\.env\.VITE_WEB_URL/,'Sponsored second-stage exit respects Preview origin')
assert.match(sponsoredActivation,/Aceptar y activar mi presentación/,'Sponsored second-stage CTA must be product-neutral')
console.log('PASS: tenant switch isolation, KawMed first scan and sponsored exit in matching environment')
