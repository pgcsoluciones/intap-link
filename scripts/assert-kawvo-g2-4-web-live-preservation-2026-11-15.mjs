#!/usr/bin/env node
// Fail-closed Web Preview source preservation. Executes read-only Git commands.
// Compare against the actual Pages Web deployment commit, NOT the G2.3 App base.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const webSha=process.argv[2]||''
if(!/^[0-9a-f]{40}$/.test(webSha))throw new Error('BLOCKED: SHA Web de Pages no válido o incompleto')
const git=(args)=>execFileSync('git',args,{encoding:'utf8',maxBuffer:5*1024*1024,stdio:['ignore','pipe','pipe']})
git(['cat-file','-e',webSha+'^{commit}'])

const files=[
 'web/src/components/appointments/AppointmentOwnerBar.tsx',
 'web/src/components/free-profile/FreePreviewEditShortcut.tsx',
 'web/src/components/free-profile/IntapLinkGratisProfile.tsx',
 'web/src/components/free-profile/freeShellPreviewReturn.ts'
]
const changed=git(['diff','--no-renames','--name-only',webSha,'HEAD','--','web/','shared/','package.json','package-lock.json']).trim().split('\n').filter(Boolean).sort()
assert.deepEqual(changed,files.slice().sort(),'BLOCKED: Web publicado tiene cambios distintos de los cuatro archivos Free/OwnerBar autorizados')

function existingAt(path){return git(['show',webSha+':'+path])}
function replaceOnce(content,from,to,subject){
 const parts=content.split(from)
 assert.equal(parts.length,2,'BLOCKED: fuente Web previa no coincide con el patrón seguro: '+subject)
 return parts.join(to)
}
const newFile=(path)=>readFileSync(path,'utf8')

// Only an optional URL override for the Free owner bar; no change for medical/sponsor.
{
 const path=files[0]
 let expected=existingAt(path)
 expected=replaceOnce(expected,'  settingsLabel?:string\n','  settingsLabel?:string\n  settingsPreviewReturnUrl?:string\n',path+' prop')
 expected=replaceOnce(expected,"settingsLabel='Mi perfil',palette","settingsLabel='Mi perfil',settingsPreviewReturnUrl,palette",path+' default')
 expected=replaceOnce(expected,'const settingsUrl=origin+String(context.settings_url||settingsPath)','const settingsUrl=settingsPreviewReturnUrl||origin+String(context.settings_url||settingsPath)',path+' URL')
 assert.equal(newFile(path),expected,'BLOCKED: la barra Owner difiere de la versión Web activa en algo más que el retorno Free')
}
// An explicit Free-only navigation hint in the preview edit shortcut.
{
 const path=files[1]
 let expected=existingAt(path)
 expected=replaceOnce(expected,"import { createPortal } from 'react-dom'\n","import { createPortal } from 'react-dom'\nimport { freeShellPreviewReturnUrl } from './freeShellPreviewReturn'\n",path+' import')
 expected=replaceOnce(expected,"  const appUrl=(import.meta.env.VITE_APP_URL||'https://app.intaprd.com').replace(/\\/$/,'')\n","  const appUrl=(import.meta.env.VITE_APP_URL||'https://app.intaprd.com').replace(/\\/$/,'')\n  const shellReturnUrl=freeShellPreviewReturnUrl()\n",path+' state')
 expected=replaceOnce(expected,'href={`${appUrl}/admin/free`}','href={shellReturnUrl || `${appUrl}/admin/free`}',path+' href')
 assert.equal(newFile(path),expected,'BLOCKED: atajo edición Web difiere de la versión activa en algo más que destino Free')
}
// Only add Free preview return to an existing Free profile; preserve all content.
{
 const path=files[2]
 let expected=existingAt(path)
 expected=replaceOnce(expected,"import AppointmentOwnerBar from '../appointments/AppointmentOwnerBar'\n","import AppointmentOwnerBar from '../appointments/AppointmentOwnerBar'\nimport { freeShellPreviewReturnUrl } from './freeShellPreviewReturn'\n",path+' import')
 expected=replaceOnce(expected,'  const hasWhatsapp = Boolean(profile.whatsapp)\n','  const hasWhatsapp = Boolean(profile.whatsapp)\n  const previewShellReturn = freeShellPreviewReturnUrl()\n',path+' state')
 expected=replaceOnce(expected,'settingsPath="/admin/free/account" palette={{accent:action,accentSoft:softPrimary,text}}','settingsPath="/admin/free/account" settingsLabel={previewShellReturn ? \'Mi perfil\' : undefined} settingsPreviewReturnUrl={previewShellReturn || undefined} palette={{accent:action,accentSoft:softPrimary,text}}',path+' owner bar')
 assert.equal(newFile(path),expected,'BLOCKED: perfil Free Web difiere de la versión activa en algo más que retorno Free')
}
// The new helper must be absent from the currently live Web commit.
{
 const path=files[3]
 let found=false
 try{git(['cat-file','-e',webSha+':'+path]);found=true}catch{}
 assert.equal(found,false,'BLOCKED: el Web activo ya tiene helper de retorno; revisar antes de sobrescribir')
 const helper=newFile(path)
 assert.ok(helper.includes("window.location.hostname !== 'preview.intaprd.com'"),'BLOCKED: el retorno no está restringido a Web Preview')
 assert.ok(helper.includes("slug.toLowerCase() !== pageSlug.toLowerCase()"),'BLOCKED: el retorno no valida el perfil real')
 assert.ok(helper.includes('https://app.preview.intaprd.com/admin/free/shell-preview?kawvo_shell=1&resume=profile'),'BLOCKED: el destino App no es el shell Free Preview')
}
console.log('PASS: Web Preview activo preservado íntegramente salvo tres regresos Free y nuevo helper; Kawmed, Sponsored, NFC, CSS y paquetes byte-a-byte intactos')
