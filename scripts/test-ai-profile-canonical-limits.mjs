import assert from 'node:assert/strict'
import fs from 'node:fs'

const identity = fs.readFileSync('app/src/components/admin/free/onboarding/FreeOnboardingIdentity.tsx','utf8')
const portfolio = fs.readFileSync('app/src/components/admin/free/FreePortfolio.tsx','utf8')
const services = fs.readFileSync('app/src/components/admin/free/FreeServices.tsx','utf8')
const assistant = fs.readFileSync('api/src/ai-profile-assistant.ts','utf8')

assert.match(identity, /maxLength=\{80\}[^\n]*placeholder="Tu nombre o marca"/)
assert.match(identity, /maxLength=\{80\}[^\n]*placeholder="Ej\. Asesor inmobiliario"/)
assert.match(identity, /maxLength=\{300\}[^\n]*rows=\{4\}/)

assert.match(portfolio, /const MAX_PHOTOS = 5/)
assert.match(portfolio, /const DESCRIPTION_LIMIT = 90/)
assert.match(portfolio, /maxLength=\{80\}[^\n]*placeholder="Título de la imagen"/)

assert.match(services, /const MAX_SERVICES = 3/)
assert.match(services, /const DESCRIPTION_LIMIT = 90/)
assert.match(services, /const SERVICE_TITLE_LIMIT = 60/)
assert.match(services, /const SECTION_DESCRIPTION_LIMIT = 240/)

assert.match(assistant, /FREE_MAX_SERVICES = 3/)
assert.match(assistant, /professional_title: text\(value\.professional_title, 80\)/)
assert.match(assistant, /bio: text\(value\.bio, 300\)/)
assert.match(assistant, /services_section_title: text\(value\.services_section_title, 60\)/)
assert.match(assistant, /services_section_description: text\(value\.services_section_description, 240\)/)

// The AI server must never allow service descriptions longer than the actual editor.
assert.match(assistant, /description: text\(item\?\.description, 90\)/)

console.log('AI profile canonical field/limit checks: OK')
