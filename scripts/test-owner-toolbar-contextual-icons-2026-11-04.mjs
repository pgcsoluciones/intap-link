import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const bar=readFileSync('web/src/components/appointments/AppointmentOwnerBar.tsx','utf8')
const css=readFileSync('web/src/components/appointments/AppointmentOwnerBar.mobile.css','utf8')
const med=readFileSync('web/src/components/medical-profile/KawMedProfile.tsx','utf8')
const sponsor=readFileSync('web/src/components/sponsored/SponsoredProfile.tsx','utf8')

assert.match(bar, /function contactIcon\(label:string\)/, 'Contact icons must follow existing dynamic labels')
assert.match(bar, /normalized\.includes\('whatsapp'\)/, 'WhatsApp icon')
assert.match(bar, /normalized\.includes\('visitador'\)/, 'Visitador icon')
assert.match(bar, /normalized\.includes\('vendedor'\)/, 'Seller icon')
assert.match(bar, /normalized\.includes\('promoci'\)/, 'Promotion icon')
assert.match(bar, /normalized\.includes\('vadem'\)/, 'Vademecum icon')
assert.match(bar, /normalized\.includes\('catálogo'\)/, 'Catalog icon')
assert.match(bar, /<FaUserCircle aria-hidden="true"[^>]*\/>\{settingsLabel\}/, 'Profile icon without rewriting label')
assert.match(bar, /\{contactIcon\(contactLabel\)\}<\/span>\{contactLabel\}/, 'Contact icon and original label')
assert.match(bar, /\{resourceIcon\(resourceLabel\)\}<\/span>\{resourceLabel\}/, 'Resource icon and original label')
assert.match(bar, /<FaCalendarAlt aria-hidden="true"\/>Agenda/, 'Agenda remains unchanged')
assert.match(bar, /<FaBell aria-hidden="true"\/>/, 'Notification bell preserved')
assert.match(bar, /<a href=\{settingsUrl\} onClick=\{\(\)=>setMenuOpen\(false\)\}><FaUserCircle/, 'Mobile profile link destination unchanged')
assert.match(bar, /<a href=\{contactUrl\} target="_blank" rel="noopener noreferrer" onClick=\{\(\)=>setMenuOpen\(false\)\}>\{contactIcon\(contactLabel\)\}\{contactLabel\}<\/a>/, 'Mobile contact link unchanged')
assert.match(bar, /<a href=\{resourceUrl\} target="_blank" rel="noopener noreferrer" onClick=\{\(\)=>setMenuOpen\(false\)\}>\{resourceIcon\(resourceLabel\)\}\{resourceLabel\}<\/a>/, 'Mobile resource link unchanged')
assert.match(bar, /const settingsUrl=origin\+String\(context\.settings_url\|\|settingsPath\)/, 'Profile route unchanged')
assert.match(bar, /const manageUrl=origin\+String\(context\.manage_url\|\|'/, 'Agenda route unchanged')
assert.match(bar, /if\(json\?\.ok&&json\.data\?\.is_owner\)setContext\(json\.data\)/, 'Owner-only permissions preserved')
assert.match(css, /\.kawmed-owner-header__dropdown a svg\{width:21px/, 'Mobile icon sizing')
for (const [source,name] of [[med,'KawMed'],[sponsor,'Sponsored']] ){
  assert.match(source, /settingsLabel="Mi perfil"/, name+' label must be Mi perfil')
  assert.doesNotMatch(source, /settingsLabel="Editar mi perfil"/, name+' legacy label must be removed')
}
console.log('PASS: owner toolbar icons match links and dynamic labels; Mi perfil replaces only Editar mi perfil; mobile and owner permissions preserved')
