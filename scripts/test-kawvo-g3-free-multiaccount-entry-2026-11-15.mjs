import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const read=p=>readFileSync(p,'utf8')
const chooser=read('app/src/components/admin/IntapcardAccountSelector.tsx')
const shell=read('app/src/components/admin/free/KawvoFreeShellPreview.tsx')
const helper=read('app/src/components/admin/free/KawvoShellReturn.ts')
const guard=read('app/src/components/admin/AdminGuard.tsx')
const home=read('api/src/account-home-route.ts')
const runner=read('scripts/run-kawvo-g3-free-multiaccount-entry-2026-11-15.sh')
const checks=[
 [chooser,"apiPost('/me/intapcard/active-account',{kind:item.kind,id:item.id})",'Canonical selection unchanged'],
 [chooser,"sessionStorage.setItem(INTAP_ACTIVE_TAB_STORAGE,token)",'Tab token retained'],
 [chooser,"response.data?.kind==='free'&&String(response.data?.id||'')===item.id",'Server confirms exact selected Free identity'],
 [chooser,"item.kind==='free'&&selectedFree&&route==='/admin/free'&&isKawvoShellPreviewHost()",'Only confirmed Free on Preview changes destination'],
 [chooser,"? KAWVO_SHELL_PREVIEW_ROUTE",'Opt-in target'],
 [chooser,"item.kind==='sponsor'?route+(route.includes('?')?'&':'?')+'sponsor_id='+encodeURIComponent(item.id):route",'Other account targets unchanged'],
 [chooser,"window.location.assign(origin+'/trial/mi/'+encodeURIComponent(item.id))",'Trial unchanged'],
 [helper,"import.meta.env.MODE === 'preview'",'Production disabled'],
 [helper,"window.location.hostname === 'app.preview.intaprd.com'",'Exact host'],
 [helper,"'/admin/free/shell-preview?kawvo_shell=1'",'Existing opt-in route'],
 [guard,"kind==='free' && (path==='/admin/free'||path.startsWith('/admin/free/'))",'Existing route guard'],
 [guard,"if (!selected.data?.tab_session_valid)",'Stale tabs rejected'],
 [home,"return c.json({ok:true,data:{kind:'multiaccount',route:'/admin/accounts'}})",'Generic directory contract preserved'],
 [shell,"if(h?.ok&&h.data?.kind==='multiaccount')",'Only directory context needs resolution'],
 [shell,"apiGet('/me/intapcard/active-account')",'Verify active account read-only'],
 [shell,"selected.data?.tab_session_valid!==true",'No stale token'],
 [shell,"current?.kind!=='free'||current?.route!=='/admin/free'",'No other account kinds'],
 [shell,"String(current.id)!==String(p.data.profile_id)",'No cross-profile Agenda'],
 [shell,"resolvedHome={route:'/admin/free',agenda_route:'/admin/free/agenda',kind:'multiaccount'}",'Existing guarded Agenda only'],
 [shell,"incomingReturn.kawvoShellAccount!==activeAccount",'Return remains account-scoped'],
 [shell,"if(path)navigate(path,{state:{...shellReturnState,kawvoShellList:listState,kawvoShellItem:id}})",'Module returns retain shell origin'],
 [runner,"scripts/test-kawvo-g3-free-module-parity-2026-11-15.mjs",'G3.1 regression retained']
]
let failures=0
for(const [src,needle,label] of checks)if(!src.includes(needle)){console.error('FAIL: '+label);failures++}
assert.ok(chooser.indexOf("sessionStorage.setItem(INTAP_ACTIVE_TAB_STORAGE,token)")<chooser.indexOf("const selectedFree="),'Verified token before redirected entry')
assert.doesNotMatch(shell,/apiPost\(|apiPut\(|apiPatch\(|apiDelete\(|apiUpload\(|fetch\(/)
assert.equal(failures,0,'G3.2 navigation contract')
console.log('PASS G3.2: confirmed Free selection, Preview-only entry, scoped Agenda and return')
