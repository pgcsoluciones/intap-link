import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import vm from 'node:vm'

const worker=readFileSync('api/src/index.ts','utf8')
const selection=readFileSync('api/src/intap-active-account.ts','utf8')
const appEnv=readFileSync('app/.env.production','utf8')
const previewEnv=readFileSync('app/.env.preview','utf8')
const dashboard=readFileSync('app/src/components/admin/free/FreeDashboard.tsx','utf8')
const visual=readFileSync('app/src/components/admin/free/FreeVisualEditor.tsx','utf8')
const preview=readFileSync('api/src/free-profile-preview.ts','utf8')

assert.match(appEnv,/^VITE_API_URL=https:\/\/api\.intaprd\.com$/m)
assert.match(previewEnv,/^VITE_API_URL=https:\/\/app\.preview\.intaprd\.com$/m)
assert.match(dashboard,/\/api\/v1\/me\/free\/profile-preview\//)
assert.match(visual,/\/api\/v1\/me\/free\/profile-preview\//)
assert.match(selection,/KEY\+'='\+encodeURIComponent\(selection.kind/)
assert.doesNotMatch(selection,/Domain=\.intaprd\.com/,'Do not widen the selection cookie across all subdomains')
const start=worker.indexOf("  if(c.req.method==='GET'&&path.startsWith('/api/v1/me/free/profile-preview/')")
const end=worker.indexOf('  // Like sponsored and KawMed',start)
assert.ok(start>0&&end>start,'Canonical host GET/HTML navigation guard exists')
assert.ok(end<worker.indexOf("  const raw=parseCookie",end),'Redirect happens before cookie-based Free selection guard')
const source=worker.slice(start,end)
const handler=vm.runInNewContext('(function(c,path){'+source+'})',{URL})
const request=(origin,method='GET',accept='text/html')=>{
  const u=new URL(origin)
  const c={
    req:{method,url:u.href,header:name=>name==='Accept'?accept:''},
    env:{ENVIRONMENT:'production'},
    redirect:(location,status)=>({location,status})
  }
  return handler(c,u.pathname)
}
const good=request('https://app.intaprd.com/api/v1/me/free/profile-preview/intap3?full=1')
assert.equal(good.status,302)
assert.equal(good.location,'https://api.intaprd.com/api/v1/me/free/profile-preview/intap3?full=1')
assert.equal(request('https://app.intaprd.com/api/v1/me/free/profile-preview/intap3?v=5').location,
  'https://api.intaprd.com/api/v1/me/free/profile-preview/intap3?v=5')
assert.equal(request('https://app.intaprd.com/api/v1/me/free/profile-preview/intap3','POST'),undefined)
assert.equal(request('https://app.intaprd.com/api/v1/me/free/profile-preview/intap3','GET','application/json'),undefined)
assert.equal(request('https://app.intaprd.com/api/v1/me/free/appointments/public-context?username=intap3'),undefined)
assert.equal(request('https://api.intaprd.com/api/v1/me/free/profile-preview/intap3'),undefined,'Canonical API host never redirects twice')
assert.equal(request('https://preview.intaprd.com/api/v1/me/free/profile-preview/intap3'),undefined)
assert.equal(request('https://evil.intaprd.com/api/v1/me/free/profile-preview/intap3'),undefined)
const previewHost={req:{method:'GET',url:'https://app.preview.intaprd.com/api/v1/me/free/profile-preview/intap3',header:()=> 'text/html'},env:{ENVIRONMENT:'preview'},redirect:()=>{throw Error('No preview redirect')}}
assert.equal(handler(previewHost,'/api/v1/me/free/profile-preview/intap3'),undefined)
assert.match(worker,/if\(c\.req\.method==='GET'&&path\.startsWith\(freePreviewPrefix\)\)/)
assert.match(worker,/\.bind\(active\.id,slug\)\.first\(\)/,'Canonical destination still enforces chosen profile ID+slug')
assert.match(worker,/if\(!matchesActiveIntapTab\(c,active\)\)/,'All editing routes still enforce tab token')
assert.match(preview,/app\.get\('\/api\/v1\/me\/free\/profile-preview\/:slug', requireProfileOwner/)
assert.match(preview,/SELECT id FROM profiles WHERE user_id = \? AND lower\(slug\) = lower\(\?\)/)
assert.match(preview,/Set-Cookie/)
console.log('PASS: Production Free preview uses canonical API host; Preview unchanged; no cookie widening, profile bypass or write exemption')
