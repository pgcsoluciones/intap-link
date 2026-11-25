import assert from 'node:assert/strict'
import {build} from 'esbuild'
import {readFileSync} from 'node:fs'
import {execFileSync} from 'node:child_process'
const bundle=async path=>{
 const r=await build({entryPoints:[path],bundle:true,format:'esm',platform:'node',target:'node20',write:false})
 return import('data:text/javascript;base64,'+Buffer.from(r.outputFiles[0].text).toString('base64'))
}
const {parseGoogleSearchInput,googleSearchCapability,searchGooglePlaces,GOOGLE_PLACES_FIELD_MASK,GOOGLE_PLACES_ENDPOINT,GOOGLE_SEARCH_POLICY,GOOGLE_SEARCH_RESERVE_SQL}=await bundle('api/src/reviews/google-place-search.ts')
const {buildGoogleReviewUrl,normalizeGoogleReviewUrl}=await bundle('shared/google-review-link.ts')
const input={businessName:'Decology by Beato',city:'Santo Domingo',address:'',countryCode:'DO',language:'es'}
const parsed=parseGoogleSearchInput(input)
assert.deepEqual(parsed,input)
for(const raw of [null,[],{}, {...input,businessName:' '},{...input,city:'x'.repeat(101)},{...input,countryCode:'ZZ'},{...input,language:'fr'},{...input,mask:'*'},{...input,pageSize:20},{...input,address:'x\nfoo'},{...input,address:3}])assert.equal(parseGoogleSearchInput(raw),null)
assert.equal(GOOGLE_PLACES_FIELD_MASK,'places.id')
assert.equal(GOOGLE_PLACES_ENDPOINT,'https://places.googleapis.com/v1/places:searchText')
assert.equal(GOOGLE_SEARCH_POLICY,'FREE_ONLY')
const env={GOOGLE_REVIEWS_SEARCH_ENABLED:'1',GOOGLE_PLACES_API_KEY:'test-only-backend-key-123456789',GOOGLE_MAPS_EMBED_KEY:'test-only-embed-key-123456789'}
assert.deepEqual(googleSearchCapability({}),{available:false})
assert.deepEqual(googleSearchCapability({...env,GOOGLE_REVIEWS_SEARCH_ENABLED:'0'}),{available:false})
assert.deepEqual(googleSearchCapability({...env,GOOGLE_MAPS_EMBED_KEY:env.GOOGLE_PLACES_API_KEY}),{available:false})
assert.deepEqual(googleSearchCapability(env),{available:true,embedKey:env.GOOGLE_MAPS_EMBED_KEY})
let calls=0
const provider=(body,status=200)=>async(url,init)=>{
 calls++
 assert.equal(url,GOOGLE_PLACES_ENDPOINT)
 assert.equal(init.method,'POST')
 assert.equal(init.redirect,'error')
 assert.equal(init.headers['X-Goog-FieldMask'],'places.id')
 assert.equal(init.headers['X-Goog-Api-Key'],env.GOOGLE_PLACES_API_KEY)
 assert.deepEqual(JSON.parse(init.body),{textQuery:'Decology by Beato, Santo Domingo, República Dominicana',languageCode:'es',regionCode:'DO',pageSize:5})
 assert.ok(init.signal)
 return new Response(JSON.stringify(body),{status})
}
assert.deepEqual(await searchGooglePlaces(parsed,env,provider({places:[{id:'abc_1'},{id:'abc_1'},{id:'nonChIJ-2',displayName:{text:'ignore'}}]})),[{placeId:'abc_1'},{placeId:'nonChIJ-2'}])
assert.deepEqual(await searchGooglePlaces(parsed,env,provider({})),[])
assert.deepEqual(await searchGooglePlaces(parsed,env,provider({places:[]})),[])
for(const body of [null,[],{places:'abc'},{places:[{name:'places/abc'}]},{places:[{id:'foo/bar'}]},{places:Array.from({length:6},(_,i)=>({id:'id'+i}))},{error:{message:'private'}}])await assert.rejects(()=>searchGooglePlaces(parsed,env,provider(body)),e=>e.code==='GOOGLE_SEARCH_UNAVAILABLE')
await assert.rejects(()=>searchGooglePlaces(parsed,env,provider({error:'secret'},429)),e=>e.status===429)
await assert.rejects(()=>searchGooglePlaces(parsed,env,provider({},500)),e=>e.status===503)
await assert.rejects(()=>searchGooglePlaces(parsed,env,provider({error:{details:[{reason:'BILLING_DISABLED'}],message:'private key details'}},403)),e=>e.code==='GOOGLE_SEARCH_BILLING'&&e.message==='GOOGLE_SEARCH_BILLING')
await assert.rejects(()=>searchGooglePlaces(parsed,env,provider({error:{message:'Billing must be enabled on the project.'}},403)),e=>e.code==='GOOGLE_SEARCH_BILLING')
await assert.rejects(()=>searchGooglePlaces(parsed,env,provider({error:{details:[{reason:'API_KEY_SERVICE_BLOCKED'}]}},403)),e=>e.code==='GOOGLE_SEARCH_PROVIDER_DENIED')
await assert.rejects(()=>searchGooglePlaces(parsed,env,async()=>{throw Object.assign(Error('timeout'),{name:'TimeoutError'})}),e=>e.status===504)
await assert.rejects(()=>searchGooglePlaces(parsed,env,async()=>new Response('not JSON')),e=>e.status===503)
const before=calls
await assert.rejects(()=>searchGooglePlaces(parsed,{},provider({})),e=>e.status===503)
assert.equal(calls,before)
assert.equal(buildGoogleReviewUrl('opaque-id_123'),'https://search.google.com/local/writereview?placeid=opaque-id_123')
assert.equal(buildGoogleReviewUrl('abc&foo=bar'),null)
assert.equal(buildGoogleReviewUrl('a'.repeat(400)),normalizeGoogleReviewUrl('https://search.google.com/local/writereview?placeid='+'a'.repeat(400)))
assert.equal(normalizeGoogleReviewUrl('https://g.page/r/Cabc123/review'),'https://g.page/r/Cabc123/review')
// Execute the actual reservation SQL against SQLite, including cross-user and cross-profile quota.
const schema=readFileSync(new URL('../docs/releases/kawvo-r4-proposed-migrations/google-search-usage.sql',import.meta.url),'utf8')
const python=
`import sqlite3,json,sys,uuid
x=json.load(sys.stdin)
db=sqlite3.connect(':memory:')
db.executescript(x['schema'])
def reserve(u,p,ip='',limit=500):
 return db.execute(x['sql'],(str(uuid.uuid4()),u,p,ip,u,p,ip,ip,limit)).rowcount
for n in range(5): assert reserve('u','p'+str(n))==1
assert reserve('u','different-profile')==0
db.execute("DELETE FROM review_google_search_usage")
for n in range(50): assert reserve('u'+str(n),'p')==1
assert reserve('fresh-user','p')==0
db.execute("DELETE FROM review_google_search_usage")
for n in range(15): assert reserve('u'+str(n),'p'+str(n),'hash')==1
assert reserve('fresh-user','fresh-profile','hash')==0
db.execute("DELETE FROM review_google_search_usage")
assert reserve('a','a','',2)==1
assert reserve('b','b','',2)==1
assert reserve('c','c','',2)==0
db.execute("UPDATE review_google_search_usage SET created_at=unixepoch('now')-86401")
assert reserve('c','c','',2)==1
print('PASS SQLite rolling quota reservation')
`
execFileSync('python3',['-c',python],{input:JSON.stringify({schema,sql:GOOGLE_SEARCH_RESERVE_SQL}),stdio:['pipe','inherit','inherit']})
const editor=readFileSync(new URL('../app/src/components/admin/shared/GoogleReviewLinkEditor.tsx',import.meta.url),'utf8')
assert.match(editor,/referrerPolicy="strict-origin-when-cross-origin"/)
assert.match(editor,/maps\/embed\/v1\/place/)
assert.match(editor,/Seleccionar este establecimiento/)
assert.doesNotMatch(editor,/GOOGLE_PLACES_API_KEY|places\.googleapis\.com|localStorage/)
console.log('PASS R4 FREE_ONLY request, errors, URL compatibility, quotas and App-only Embed design')

const panel=readFileSync(new URL('../app/src/components/admin/shared/ReviewsTenantPanel.tsx',import.meta.url),'utf8')
assert.match(editor,/const displayedUrl=mode==='manual'\?value:\(searchDraft\|\|''\)/)
assert.match(editor,/onSearchDraftChange\(next==='manual'\?null:''\)/)
assert.match(editor,/onSearchDraftChange\(url\)/)
assert.match(panel,/if\(!canSave\|\|busy\)return/)
assert.match(panel,/googleReviewUrl:effectiveUrl\.trim\(\)/)
assert.match(editor,/simulationAllowed=import\.meta\.env\.MODE==='preview'&&window\.location\.hostname==='app\.preview\.intaprd\.com'/)
assert.match(editor,/if\(simulation&&simulationAllowed&&billingBlocked\)\{/)
assert.match(editor,/No se crea un ID ni una URL de Google ficticios/)
console.log('PASS S1-QA1 independent manual/search drafts, guarded save, billing diagnostics and explicit simulation')
