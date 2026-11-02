import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const read=p=>readFileSync(p,'utf8')
const access=read('api/src/kawmed-live-guest.ts')
const api=read('api/src/kawmed-demo-invitations.ts')
const view=read('app/src/components/admin/medical/KawMedDemoGuest.tsx')
const admin=read('app/src/components/admin/SuperAdminKawMed.tsx')
const schema=read('api/migrations/0152_kawmed_live_guest_access.sql')

const functionBody=(start,end)=> {
  const from=access.indexOf('export async function '+start+'(')
  assert.ok(from>=0, start+' must exist')
  const to=access.indexOf('export async function '+end+'(',from+1)
  assert.ok(to>from,end+' must follow '+start)
  return access.slice(from,to)
}

const editor=functionBody('liveGuestProfile','liveGuestInvitation')
const activation=functionBody('liveGuestInvitation','liveGuestBySlug')
const readGuard=/AND i.status IN \('pending','active'\) AND datetime\(i.expires_at\)>datetime\('now'\)/
const editGuard=/AND i.status='active' AND datetime\(i.expires_at\)>datetime\('now'\)/
assert.match(activation,readGuard,'una invitación pending puede consultarse para activación')
assert.doesNotMatch(activation,editGuard,'consulta de activación no debe requerir active')
assert.match(editor,editGuard,'editor real requiere invitación active')
assert.doesNotMatch(editor,readGuard,'nunca permitir edición con invitación pending')

for(const [name,source] of [['consulta',activation],['editor',editor]]){
  assert.match(source,/(?:FROM|JOIN) kawmed_demo_live_access /,name+' exige grant live')
  assert.match(source,/p.id=g.medical_profile_id AND p.user_id=g.owner_user_id/,name+' exige propietario del perfil')
  assert.match(source,/lower\(owner.email\)='intapcard@gmail.com'/,name+' restringe propietario autorizado')
  assert.match(source,/i.rowid=\(SELECT MAX\(recent.rowid\)/,name+' exige invitación vigente más reciente')
  assert.match(source,/datetime\(i.expires_at\)>datetime\('now'\)/,name+' impide expiradas')
}
assert.match(activation,/lower\(i.invited_email\)=\?/,'el correo del invitado debe coincidir')
assert.match(activation,/normalize\(guestEmail\)/,'normalización del correo invitado')
assert.match(editor,/lower\(i.invited_email\)=lower\(guest.email\)/,'editor identifica sesión activa de invitado')
assert.match(editor,/delegateHeader\(c\)/,'edición requiere delegado en el request')
assert.match(activation,/FROM kawmed_demo_invitations i JOIN kawmed_demo_live_access g ON g.invitation_id=i.id/,'la invitación debe existir')
assert.match(api,/if\(b.live_access===true\)/,'conservar generación real distinguible de demo aislada')
assert.match(api,/INSERT INTO kawmed_demo_live_access/,'grant se genera solamente para live')
assert.match(api,/liveGuestInvitation\(c,String\(actor.email\),String\(c.req.param\('token'\)\|\|''\)\)/,'GET y POST validan correo invitado')
assert.match(api,/UPDATE kawmed_demo_invitations SET status='active'/,'activación pasa estado a active')
assert.match(api,/WHERE id=\? AND status IN \('pending','active'\) AND datetime\(expires_at\)>datetime\('now'\)/,'activación no acepta revocadas ni vencidas')
assert.match(api,/const actor:any=await sessionActor\(c\)/,'activación exige sesión')
assert.match(view,/if\(grant\?\.ok\)\{return apiPost\('\/me\/kawmed\/live-access\//,'invitado activa antes de mostrar editor')
assert.match(view,/if\(accepted\?\.ok\)\{setExpires\(grant.data.expires_at\);setLiveAccess\(true\)/,'vista real solo tras POST correcto')
assert.match(view,/if\(liveAccess\)return <MedicalDashboard/,'usa el MedicalDashboard original')
assert.match(admin,/live_access:true/,'Super Admin crea invitaciones reales')
assert.match(schema,/CREATE TABLE IF NOT EXISTS kawmed_demo_live_access/,'migración 0152 sin cambios')
assert.doesNotMatch(schema,/DROP TABLE|DELETE FROM|UPDATE /,'no se debe tocar esquema/destruir datos')

console.log('PASS: pending activa la invitación, editor sigue active-only, correo/grant/perfil/vigencia y módulos originales protegidos')
