import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const get=path=>readFileSync(path,'utf8')
const sponsor=get('web/src/components/sponsored/SponsoredProfile.tsx')
const med=get('web/src/components/medical-profile/KawMedProfile.tsx')
const owner=get('web/src/components/appointments/AppointmentOwnerBar.tsx')
const css=get('web/src/components/appointments/AppointmentOwnerBar.mobile.css')
const medCss=get('web/src/components/medical-profile/KawMedProfile.css')
const commercial=get('api/src/sponsored-appointments.ts')

// Align sponsored private bar with the previously approved KawMed UX.
const sponsorMount=sponsor.match(/<AppointmentOwnerBar\b[^>]*\/>/)?.[0]||''
const medMount=med.match(/<AppointmentOwnerBar\b[\s\S]*?\/>/)?.[0]||''
assert.ok(sponsorMount.includes('mobileMenu'),'sponsored enables existing responsive hamburger mode')
assert.ok(sponsorMount.includes('settingsLabel="Editar mi perfil"'),'sponsored uses the exact KawMed edit label')
assert.ok(medMount.includes('mobileMenu')&&medMount.includes('settingsLabel="Editar mi perfil"'),'KawMed reference unchanged')
assert.ok(sponsorMount.includes('ownerApiBase={appOrigin()'), 'sponsored keeps owner API URL')
assert.ok(sponsorMount.includes('onToast={setToast}'),'sponsored notifications retained')
assert.ok(owner.includes("import './AppointmentOwnerBar.mobile.css'"),'responsive styles loaded by shared component')
assert.ok(owner.includes("fetch(ownerSessionApiBase(ownerApiBase)+'/public-context"),'host-only Multicuenta cookie routing retained')
assert.ok(owner.includes("if(!context)return null"),'private owner guard retained')
assert.ok(owner.includes("context.contact_url")&&owner.includes("context.resource_url"),'commercial links are still scoped')
assert.ok(commercial.includes('resolveSponsoredCommercialLinks(c.env.DB,profile)'),'API commercial context unchanged')

// Hamburger contains profile editing AND optional commercial links, but does not
// take the Agenda button or notification bell out of the main toolbar.
const menuStart=owner.indexOf('mobileMenu&&<div className="kawmed-owner-header__mobile-menu"')
const menuEnd=owner.indexOf('<div style={{display:',menuStart)
assert.ok(menuStart>=0&&menuEnd>menuStart,'hamburger block exists')
const menu=owner.slice(menuStart,menuEnd)
assert.ok(menu.includes('<FaBars />'),'hamburger icon present')
assert.ok(menu.includes('aria-expanded={menuOpen}'),'accessibility state present')
assert.ok(menu.includes('href={settingsUrl}'),'edit link in mobile menu')
assert.ok(menu.includes('href={contactUrl}'),'seller/visitor link in mobile menu')
assert.ok(menu.includes('href={resourceUrl}'),'catalog/vademecum link in mobile menu')
assert.ok(menu.includes('onClick={()=>setMenuOpen(false)}'),'menu closes on navigation')
const toolbar=owner.slice(menuEnd)
assert.ok(toolbar.includes('<FaCalendarAlt/>Agenda'),'Agenda outside hamburger')
assert.ok(toolbar.includes('<FaBell/>'),'notifications outside hamburger')

// Styles are scoped by the header class; at mobile widths we replace desktop
// links with hamburger while large screens retain a desktop link row.
assert.ok(css.includes('.kawmed-owner-header__mobile-menu{display:none}'),'hamburger hidden on desktop')
assert.ok(css.includes('@media(max-width:700px)'),'KawMed breakpoint retained')
assert.ok(css.includes('.kawmed-owner-header .kawmed-owner-header__desktop-links{display:none!important}'),'only mobile hides desktop links')
assert.ok(css.includes('.kawmed-owner-header__mobile-menu{display:block'),'menu visible only on mobile')
assert.ok(css.includes('.kawmed-owner-header__dropdown a{padding:13px 12px'),'finger-sized touch targets')
const sharedSelectors=['.kawmed-owner-header__mobile-menu{display:none}', '.kawmed-owner-header .kawmed-owner-header__row{max-width:none!important;', '.kawmed-owner-header .kawmed-owner-header__desktop-links{display:none!important}', '.kawmed-owner-header__menu-button svg{width:22px;height:22px}']
for(const selector of sharedSelectors) assert.ok(medCss.includes(selector)&&css.includes(selector),'matches existing KawMed mobile CSS: '+selector)

console.log('PASS: patrocinado usa Editar mi perfil, menú hamburguesa móvil, conserva enlaces comerciales y Agenda/campana')
