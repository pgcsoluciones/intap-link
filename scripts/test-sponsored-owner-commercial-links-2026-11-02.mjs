import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import vm from 'node:vm'
const require=createRequire(import.meta.url)
const ts=require('typescript')
const file=readFileSync('api/src/sponsored-commercial-links-core.ts','utf8')
const js=ts.transpileModule(file,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText
const exports={}
vm.runInNewContext(js,{exports,URL,console})
const {resolveSponsoredCommercialLinks,EMPTY_SPONSORED_COMMERCIAL_LINKS}=exports
assert.equal(typeof resolveSponsoredCommercialLinks,'function')

function fakeDb({grants=[],resource=null,representative=null}={}){
  const calls=[]
  return {
    calls,
    prepare(sql){
      return {
        bind(...values){
          calls.push({sql,values})
          return {
            all:async()=>({results:grants}),
            first:async()=>sql.includes('FROM sponsor_commercial_resources')?resource:representative,
          }
        }
      }
    }
  }
}
const seller={module_code:'commercial_seller',enabled:1}
const visitor={module_code:'commercial_visitor',enabled:1}
const catalog={module_code:'commercial_catalog',enabled:1}
const vad={module_code:'commercial_vademecum',enabled:1}
const owner={sponsor_id:'sponsor-one',artifact_id:'artifact-a',profile_role:'beneficiary'}
const catalogInfo={resource_url:'https://catalog.example.com/current',resource_label:'Catálogo general'}

{
  const db=fakeDb({grants:[seller,catalog],resource:catalogInfo,representative:{whatsapp:'+1 (809) 222-3333'}})
  const x=await resolveSponsoredCommercialLinks(db,owner)
  assert.equal(x.contact_label,'Mi vendedor')
  assert.equal(x.contact_url,'https://wa.me/18092223333')
  assert.equal(x.resource_label,'Catálogo general')
  assert.equal(x.resource_url,catalogInfo.resource_url)
  const rep=db.calls.find(x=>x.sql.includes('FROM sponsor_sales_assignments'))
  assert.deepEqual(Array.from(rep.values),['sponsor-one','artifact-a'])
  assert.match(rep.sql,/r\.sponsor_id=a\.sponsor_id AND r\.active=1/)
  assert.match(rep.sql,/sa\.sponsor_id=a\.sponsor_id/)
  assert.match(rep.sql,/a\.active=1/)
}
{
  const db=fakeDb({grants:[visitor,vad],resource:{resource_url:'https://vademecum.example.com',resource_label:''},representative:{whatsapp:'8295554444'}})
  const x=await resolveSponsoredCommercialLinks(db,owner)
  assert.equal(x.contact_label,'Mi visitador')
  assert.equal(x.resource_label,'Vademécum')
}
{
  // Production DAPSA: catalog authorized, zero active representatives.
  const db=fakeDb({grants:[seller,catalog],resource:catalogInfo,representative:null})
  const x=await resolveSponsoredCommercialLinks(db,owner)
  assert.equal(x.contact_url,'')
  assert.equal(x.contact_label,'')
  assert.equal(x.resource_label,'Catálogo general')
}
{
  // Master has access to an authorized sponsor resource but is NEVER assigned a personal seller.
  const db=fakeDb({grants:[seller,catalog],resource:catalogInfo,representative:{whatsapp:'8099990000'}})
  const x=await resolveSponsoredCommercialLinks(db,{...owner,profile_role:'sponsor_owner'})
  assert.equal(x.contact_url,'')
  assert.equal(x.resource_url,catalogInfo.resource_url)
  assert.equal(db.calls.some(c=>c.sql.includes('FROM sponsor_sales_assignments')),false)
}
{
  const db=fakeDb({grants:[{module_code:'commercial_catalog',enabled:0}],resource:catalogInfo,representative:{whatsapp:'8091112222'}})
  const x=await resolveSponsoredCommercialLinks(db,owner)
  assert.equal(x.contact_url,'')
  assert.equal(x.resource_url,'')
  assert.equal(db.calls.length,1)
}
{
  const db=fakeDb({grants:[catalog],resource:{resource_url:'http://insecure.example.com',resource_label:'Catálogo'}})
  const x=await resolveSponsoredCommercialLinks(db,owner)
  assert.equal(x.resource_url,'')
}
{
  const db=fakeDb({grants:[seller],representative:{whatsapp:'abc'}})
  const x=await resolveSponsoredCommercialLinks(db,owner)
  assert.equal(x.contact_url,'')
}
{
  const db=fakeDb()
  const x=await resolveSponsoredCommercialLinks(db,{sponsor_id:''})
  assert.deepEqual(JSON.parse(JSON.stringify(x)),JSON.parse(JSON.stringify(EMPTY_SPONSORED_COMMERCIAL_LINKS)))
  assert.equal(db.calls.length,0)
}

const appointments=readFileSync('api/src/sponsored-appointments.ts','utf8')
const privateSales=readFileSync('api/src/sponsor-commercial-sales.ts','utf8')
const bar=readFileSync('web/src/components/appointments/AppointmentOwnerBar.tsx','utf8')
const start=appointments.indexOf("app.get('/api/v1/me/sponsored-profile/appointments/public-context'")
const end=appointments.indexOf("export default app",start)
assert.ok(start>=0&&end>start)
const ownerRoute=appointments.slice(start,end)
const ownerGuard=ownerRoute.indexOf('if(!profile)return c.json')
const selectionGuard=ownerRoute.indexOf('if(await sponsoredMultiProfileAccess')
const queryCommercial=ownerRoute.indexOf('const commercial=await resolveSponsoredCommercialLinks')
assert.ok(ownerGuard>=0&&selectionGuard>ownerGuard&&queryCommercial>selectionGuard,'verify owner and explicit Multicuenta selection BEFORE commercial query')
assert.ok(ownerRoute.includes("WHERE username=? AND user_id=? LIMIT 1"),'URL must match session owner')
assert.ok(ownerRoute.includes("const requiredKind=isMaster?'sponsor':'sponsored'"),'separate Master and Beneficiary active kind')
assert.ok(ownerRoute.includes("if(active.id!==requiredId)"),'account ID isolation')
assert.ok(ownerRoute.includes("settings_url:isMaster?'/admin/sponsor'"),'preserve Configuración link')
assert.ok(ownerRoute.includes("action_scope:isMaster?'master':null,...commercial"),'commercial additions do not replace Agenda context')
assert.ok(ownerRoute.includes('return {...EMPTY_SPONSORED_COMMERCIAL_LINKS}'),'commercial failures do not hide basic bar')
assert.ok(privateSales.includes('resolveSponsoredCommercialLinks(c.env.DB,owned as any)'),'existing private preview functionality shares resolver')
assert.ok(bar.includes('context.contact_url')&&bar.includes('context.resource_url'),'already-approved bar shows contact and catalog')
assert.ok(bar.includes("fetch(ownerSessionApiBase(ownerApiBase)+'/public-context"),'recovered correct cookie-host retained')
assert.ok(bar.includes('if(!context)return null'),'bar remains owner-only')
console.log('PASS: Master/beneficiary vendor visitor catalog policies, isolation, and basic owner toolbar preservation')
