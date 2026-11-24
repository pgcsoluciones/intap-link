import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import vm from 'node:vm'
const source=readFileSync(new URL('../api/src/medical-appointments.ts',import.meta.url),'utf8')
const marker="app.get('/api/v1/me/medical-profile/appointments/public-context',requireUser,"
const start=source.indexOf(marker)
assert.ok(start>=0)
const end=source.indexOf('\n})',start)
assert.ok(end>start)
const handlerSource=source.slice(start+marker.length,end+2).replace(/:any\b/g,'').replace(/ as any\b/g,'')
const doctor={id:'doctor-a',slug:'doctor-a'}
const master={id:'master-a',slug:'master-a'}
const guest={id:'guest-a',slug:'guest-a',invitation_id:'invite-a'}
async function scenario({multi=true,active=null,slug='doctor-a',scope='sponsor_master',doctorProfile=doctor,masterProfile=master,guestProfile=null,legacyProfile=null,status=403,role,guestExpected=false}={}){
 const calls=[]
 const c={get:()=> 'user',req:{query:k=>k==='username'?slug:scope},json:(data,status=200)=>({data,status}),env:{DB:{prepare(sql){
  calls.push('db:'+sql)
  return{bind(id){return{first:async()=>sql.startsWith('SELECT 1 FROM medical_sponsor_master_profiles')?(id===master.id?{ok:1}:null):{n:0},all:async()=>({results:[]})}}}
 }}}}
 const handler=vm.runInNewContext('('+handlerSource+')',{
  cleanSlug:x=>x,sponsoredMultiProfileAccess:async()=>multi,readIntapSelection:async()=>active,
  resolveOwnedMedicalContext:async()=>{calls.push('doctor');return doctorProfile},
  sponsorMasterMedicalProfile:async()=>{calls.push('master');return masterProfile},
  ownedSubject:async()=>{calls.push('legacy');return legacyProfile?{profile:legacyProfile}:null},
  liveGuestBySlug:async()=>{calls.push('guest');return guestProfile},
  ensureMedicalAppointmentDefaults:async()=>{calls.push('defaults')},
  getAppointmentSettings:async()=>({enabled:true}),medicalSponsorContext:async()=>null
 })
 const result=await handler(c)
 assert.equal(result.status,status,JSON.stringify({active,slug,scope,calls}))
 if(status===403){
  assert.ok(!calls.includes('defaults'))
  assert.ok(!calls.some(x=>x.includes('appointment_requests')))
  if(multi)assert.ok(!calls.includes('guest')&&!calls.includes('legacy'))
 }else{
  assert.equal(result.data.data.is_master,role==='master')
  assert.equal(result.data.data.is_guest_editor,guestExpected)
  assert.equal(result.data.data.allow_direct_actions,!multi&&!guestExpected)
  if(role==='master')assert.equal(result.data.data.settings_url,'/admin/sponsor/kawmed?tab=profile')
 }
 return calls
}
await scenario()
for(const kind of ['sponsor','sponsored','free','paid','trial']){
 const calls=await scenario({active:{kind,id:'sponsor-a'},slug:'master-a'})
 assert.deepEqual(calls,[])
}
await scenario({active:{kind:'medical',id:doctor.id},status:200,role:'doctor'})
await scenario({active:{kind:'medical',id:doctor.id},slug:master.slug})
await scenario({active:{kind:'medical',id:'other'},slug:doctor.slug})
await scenario({active:{kind:'medical',id:master.id},slug:master.slug,doctorProfile:master})
await scenario({active:{kind:'medical_master',id:'sponsor-a'},slug:master.slug,status:200,role:'master'})
await scenario({active:{kind:'medical_master',id:'sponsor-a'},slug:doctor.slug})
await scenario({active:{kind:'medical_master',id:'sponsor-b'},slug:master.slug,masterProfile:null})
await scenario({multi:false,legacyProfile:doctor,status:200,role:'doctor'})
await scenario({multi:false,slug:master.slug,status:200,role:'master'})
await scenario({multi:false,slug:guest.slug,masterProfile:null,guestProfile:guest,status:200,role:'doctor',guestExpected:true})
await scenario({multi:false,slug:'unknown',masterProfile:null})
console.log('PASS_KAWVO_R04_MEDICAL_OWNER_CONTEXT_ISOLATION')
