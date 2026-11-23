// G8 production activation: exact host/build pairing and existing tenant guards.
// Synthetic fixtures only. No Cloudflare access, migrations or deployments.
import assert from 'node:assert/strict'
import {build} from 'esbuild'
import {inventoryFixture} from './test-sponsor-inventory-g7-contract.mjs'

async function load(path) {
  const b=await build({entryPoints:[path],bundle:true,write:false,platform:'node',format:'esm',target:'node20',logLevel:'silent',define:{'import.meta.env.MODE':'"production"'}})
  return import('data:text/javascript;base64,'+Buffer.from(b.outputFiles[0].text).toString('base64'))
}
const app=await load('app/src/components/admin/kawvo-release-host.ts')
const pairs=[['preview','app.preview.intaprd.com'],['production','app.intaprd.com']]
for(const [mode,hostname] of pairs)assert.equal(app.isKawvoReleaseAppHost(mode,hostname),true)
for(const [mode,hostname] of [['preview','app.intaprd.com'],['production','app.preview.intaprd.com'],['development','app.intaprd.com'],['production','evil.intaprd.com'],['production','app.intaprd.com.evil.invalid'],['production','intap-web2.pages.dev'],['preview','localhost']])assert.equal(app.isKawvoReleaseAppHost(mode,hostname),false)

const doctor=await load('app/src/components/admin/medical/kawmed-shell-navigation.ts')
const guest=await load('app/src/components/admin/medical/kawmed-guest-shell-navigation.ts')
const master=await load('app/src/components/admin/medical/kawmed-master-shell-navigation.ts')
const ret=await load('app/src/components/admin/medical/KawMedShellReturn.ts')
const sponsored=await load('app/src/components/admin/sponsored/sponsored-shell-gate.ts')
const sponsor=await load('app/src/components/admin/sponsored/sponsor-shell-navigation.ts')
const doctorBase={pathname:'/admin/medical',search:'?kawvo_med_shell=1',scope:'doctor',delegated:false,profileId:'doctor-a',guestEditor:false}
const invitePath='/admin/medical/demo/i-11111111-1111-4111-8111-111111111111'
const masterBase={pathname:'/admin/sponsor/kawmed',search:''}
const benefit={search:'?profile_id=abc&kawvo_sponsored_shell=1',isMaster:false,legacyPanel:false,profileId:'abc'}
const tenant={search:'',tenant:{id:'tenant-a',role:'owner'},active:{kind:'sponsor',id:'tenant-a'}}
for(const [mode,hostname] of pairs){
  const context={mode,hostname}
  assert.equal(doctor.canUseKawMedShell({...context,...doctorBase}),true)
  assert.equal(doctor.canUseKawMedShell({...context,...doctorBase,scope:'sponsor_master'}),false)
  assert.equal(doctor.canUseKawMedShell({...context,...doctorBase,delegated:true}),false)
  assert.equal(doctor.canUseKawMedShell({...context,...doctorBase,profileId:''}),false)
  assert.equal(guest.canUseKawMedDelegateShell({...context,pathname:invitePath,search:'',scope:'doctor',assignedId:'doctor-a',verifiedId:'doctor-a',profileId:'doctor-a'}),true)
  assert.equal(guest.canUseKawMedDelegateShell({...context,pathname:invitePath,search:'',scope:'doctor',assignedId:'doctor-a',verifiedId:'doctor-b',profileId:'doctor-a'}),false)
  assert.equal(guest.isKawMedGuestShellRequest({...context,pathname:invitePath,search:'?legacy=1'}),false)
  assert.equal(master.isKawMedMasterShellRequest({...context,...masterBase}),true)
  assert.equal(master.isKawMedMasterIdentity({sponsorId:'tenant-a',currentSponsorId:'tenant-a',role:'admin',active:{kind:'medical_master',id:'tenant-a'}}),true)
  assert.equal(master.isKawMedMasterIdentity({sponsorId:'tenant-a',currentSponsorId:'tenant-b',role:'admin',active:{kind:'medical_master',id:'tenant-a'}}),false)
  assert.equal(ret.isKawMedContextHost(mode,hostname),true)
  assert.equal(sponsored.shouldShowSponsoredShell({...context,...benefit}),true)
  assert.equal(sponsored.shouldShowSponsoredShell({...context,...benefit,profileId:'other'}),false)
  assert.equal(sponsored.shouldShowSponsoredShell({...context,...benefit,isMaster:true}),false)
  assert.equal(sponsored.sponsoredAgendaReturn(benefit.search,mode,hostname),'/admin/sponsored?profile_id=abc&kawvo_sponsored_shell=1')
  assert.equal(sponsored.sponsoredAccountSelectionUrl({...context,search:'',profileId:'abc',selection:{kind:'sponsored',id:'abc',route:'/admin/sponsored'}}),'/admin/sponsored?profile_id=abc&kawvo_sponsored_shell=1&sp_tab=home')
  assert.equal(sponsored.sponsoredAccountSelectionUrl({...context,search:'',profileId:'abc',selection:{kind:'sponsored',id:'wrong',route:'/admin/sponsored'}}),null)
  assert.equal(sponsor.canUseSponsorShell({...context,...tenant}),true)
  assert.equal(sponsor.canUseSponsorShell({...context,...tenant,tenant:{id:'tenant-a',role:'viewer'}}),false)
  assert.equal(sponsor.canUseSponsorShell({...context,...tenant,active:{kind:'sponsor',id:'tenant-b'}}),false)
  assert.equal(sponsor.isSponsorShellHost(mode,hostname),true)
  assert.ok(sponsor.sponsorSelectionUrl('tenant-a',{kind:'sponsor',id:'tenant-a',route:'/admin/sponsor'},mode,hostname,'').includes('sm_sponsor=tenant-a'))
}
for(const [mode,hostname] of [['production','app.preview.intaprd.com'],['preview','app.intaprd.com'],['production','evil.pages.dev']]){
  assert.equal(doctor.isKawMedShellRequest({mode,hostname,...doctorBase}),false)
  assert.equal(guest.isKawMedGuestShellRequest({mode,hostname,pathname:invitePath,search:''}),false)
  assert.equal(master.isKawMedMasterShellRequest({mode,hostname,...masterBase}),false)
  assert.equal(ret.isKawMedContextHost(mode,hostname),false)
  assert.equal(sponsored.shouldShowSponsoredShell({mode,hostname,...benefit}),false)
  assert.equal(sponsor.isSponsorShellHost(mode,hostname),false)
}
const r=await inventoryFixture(5)
assert.equal((await r.request('',{environment:'development',authenticated:false})).status,404,'Unknown environments stay closed')
assert.equal((await r.request('',{environment:'production',authenticated:false})).status,401,'Production route reaches existing auth; never a public inventory')
assert.equal((await r.request('',{environment:'preview',authenticated:false})).status,401)
assert.equal(r.writeAttempts,0)
console.log('PASS G8 exact Preview/Production app hosts, doctor/guest/master/beneficiary/sponsor identity and isolation, authenticated-only inventory')
