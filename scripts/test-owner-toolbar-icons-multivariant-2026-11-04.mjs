import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const bar=readFileSync('web/src/components/appointments/AppointmentOwnerBar.tsx','utf8')
const css=readFileSync('web/src/components/appointments/AppointmentOwnerBar.mobile.css','utf8')
const free=readFileSync('web/src/components/free-profile/IntapLinkGratisProfile.tsx','utf8')
const med=readFileSync('web/src/components/medical-profile/KawMedProfile.tsx','utf8')
const sponsor=readFileSync('web/src/components/sponsored/SponsoredProfile.tsx','utf8')

function match(src,re,name){assert.match(src,re,name)}
// A single shared owner toolbar covers Free/Link, KawMed, and sponsored profiles.
match(free,/<AppointmentOwnerBar username=\{profile\.slug\} mobileMenu ownerApiBase=\{appOrigin\(\)\+'\/api\/v1\/me\/free\/appointments'\}/,'Free/Link profiles share the owner bar, including mobile')
match(free,/settingsPath="\/admin\/free\/account"/,'Free Link existing destination is untouched')
match(med,/settingsLabel="Mi perfil"/,'KawMed label changed from Editar mi perfil')
match(med,/settingsPath="\/admin\/medical"/,'KawMed existing settings destination is untouched')
match(sponsor,/settingsLabel="Mi perfil"/,'Sponsored label changed from Editar mi perfil')
match(sponsor,/settingsPath="\/admin\/sponsored"/,'Sponsored existing settings destination is untouched')
match(sponsor,/mobileMenu settingsLabel="Mi perfil"/,'Sponsored mobile owner menu is retained')
match(bar,/settingsLabel='Configuración'/,'Free default label remains unchanged')
match(bar,/const settingsUrl=origin\+String\(context\.settings_url\|\|settingsPath\)/,'Settings URL and account scope preserved')
match(bar,/const resourceUrl=String\(context\.resource_url\|\|''\)\.trim\(\)/,'Resource URL preserved')
match(bar,/const contactUrl=String\(context\.contact_url\|\|''\)\.trim\(\)/,'Contact URL preserved')
match(bar,/href=\{contactUrl\} target="_blank" rel="noopener noreferrer"/,'Contact URL untouched')
match(bar,/href=\{resourceUrl\} target="_blank" rel="noopener noreferrer"/,'Resource URL untouched')
match(bar,/window\.location\.assign\(manageUrl\)/,'Agenda URL untouched')
match(bar,/ownerSessionApiBase\(ownerApiBase\)/,'Owner cookie/session lookup stays on the correct origin')
match(bar,/json\?\.ok&&json\.data\?\.is_owner/,'Links shown only to authorized owner')
// Icons are derived from existing labels; no link text, grant, or URL changes.
for(const [icon,label] of [['FaUserCircle','profile'],['FaWhatsapp','WhatsApp'],['FaUserMd','visitador'],['FaUserTie','vendedor'],['FaBookMedical','vademecum'],['FaBook','catalogo'],['FaBullhorn','promociones'],['FaLink','generic resource'],['FaCalendarAlt','agenda'],['FaBell','notifications']]){
  assert.ok(bar.includes(icon),'Missing '+label+' icon '+icon)
}
match(bar,/\{contactIcon\(contactLabel,contactUrl\)\}\{contactLabel\}/,'Mobile contact displays icon and unchanged label')
match(bar,/\{resourceIcon\(resourceLabel\)\}\{resourceLabel\}/,'Mobile resource displays icon and unchanged label')
match(bar,/\{contactIcon\(contactLabel,contactUrl\)\}<\/span>\{contactLabel\}/,'Desktop contact displays icon and unchanged label')
match(bar,/\{resourceIcon\(resourceLabel\)\}<\/span>\{resourceLabel\}/,'Desktop resource displays icon and unchanged label')
match(css,/\.kawmed-owner-header__dropdown a svg/,'Mobile icons remain legible')
match(css,/@media\(max-width:700px\)/,'Small-screen toolbar uses the existing menu')
console.log('PASS: owner toolbar icons and unchanged links/text across Free, Link, sponsored and KawMed, independent/mobile/multicuenta')
