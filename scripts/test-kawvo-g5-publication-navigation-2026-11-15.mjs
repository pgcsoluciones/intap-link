import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {execFileSync} from 'node:child_process'
const base='de9b231f4533b8e24583ab363b047c2b20a4926b'
const free='app/src/components/admin/free/'
const shell=readFileSync(free+'KawvoFreeShellPreview.tsx','utf8')
const action=readFileSync(free+'FreePublicationActions.tsx','utf8')
const before=execFileSync('git',['show',base+':'+free+'FreePublicationActions.tsx'],{encoding:'utf8'})
assert.equal(action,before,'Do not alter publication mutation')
assert.ok(action.includes("type=\"button\""))
assert.ok(action.includes("apiPut('/me/profile',{is_published:next})"))
assert.ok(!/\bnavigate\s*\(|window\.location/.test(action))
const start=shell.indexOf('  const restoredNavigation=useRef')
assert.ok(start>=0)
const section=shell.slice(start,shell.indexOf('  if(!enabled)return <Navigate',start))
assert.ok(section.includes('const restoredNavigation=useRef'))
const effect=section.match(/useEffect\(\(\)=>\{\n([\s\S]+?)\n  \},\[([^\]]+)\]\)/)
assert.ok(effect,'Expected actual navigation effect')
assert.ok(!effect[2].split(',').map(x=>x.trim()).includes('profile'),'Whole profile object must not be a dependency')
assert.ok(effect[2].includes('location.key'))
const step=new Function('enabled','busy','navigationAccount','navigationSlug','home','location','restoredNavigation','getKawvoShellReturn','setTab',effect[1])
const restoredNavigation={current:null}
let tab='home'
const run=({key='r1',account='p1',state=null,search='',busy=false,agenda=true}={})=>step(true,busy,account,'slug1',agenda?{agenda_route:'/admin/free/agenda'}:null,{key,state,search},restoredNavigation,v=>v&&v.kawvoShellReturn===true?v:null,v=>{tab=v})
const hint=(kawvoShellTab,kawvoShellAccount='p1')=>({kawvoShellReturn:true,kawvoShellTab,kawvoShellAccount})
run({busy:true,state:hint('home')});assert.equal(restoredNavigation.current,null)
run({state:hint('home')});assert.equal(tab,'home')
tab='profile'
run({state:hint('home')});assert.equal(tab,'profile','Publication update must not reapply old home return')
tab='more'
run({state:hint('home')});assert.equal(tab,'more','Readiness update must not reapply old home return')
run({key:'r2',state:hint('profile')});assert.equal(tab,'profile','New module return still restores context')
tab='home'
run({key:'r2',state:hint('profile')});assert.equal(tab,'home','Publish/hide from home must not reopen old profile tab')
run({key:'r3',search:'?kawvo_shell=1&resume=profile&slug=slug1'});assert.equal(tab,'profile')
tab='home'
run({key:'r3',search:'?kawvo_shell=1&resume=profile&slug=slug1'});assert.equal(tab,'home','Web return consumed once')
run({key:'r4',state:hint('more','other')});assert.equal(tab,'home','Cross-account hint ignored')
run({key:'r5',state:hint('agenda'),agenda:false});assert.equal(tab,'home','Unavailable Agenda not selected')
run({key:'r6',state:hint('agenda')});assert.equal(tab,'agenda','Valid new Agenda return retained')
assert.ok(shell.includes('onSaved={next=>setProfile(current=>current&&String(current.profile_id||current.slug||\'\')===accountIdentity?{...current,is_published:next?1:0}:current)}'))
console.log('PASS G5.2: return hints consumed once; publication updates preserve selected tab; valid navigation and account guards retained')
