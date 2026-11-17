// Cumulative behavior suite, reusable by successor phases after their own scope check.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs'
import { build } from 'esbuild'
const require=createRequire(import.meta.url),base='567a028a5a06754910a0335433b403cec806399a'
const dir='app/src/components/admin/medical/',medicalPath=dir+'MedicalDashboard.tsx'
const read=path=>readFileSync(path,'utf8'),prior=path=>execFileSync('git',['show',base+':'+path],{encoding:'utf8'})
export async function runG32Browser(){
const pure=await build({entryPoints:[dir+'KawMedShellReturn.ts'],bundle:true,write:false,platform:'node',format:'esm',define:{'import.meta.env':JSON.stringify({MODE:'preview'})}})
const {kawMedContextUrl:url}=await import('data:text/javascript;base64,'+Buffer.from(pure.outputFiles[0].text).toString('base64'))
const {chromium}=require('playwright'),executablePath=[process.env.KAWMED_TEST_BROWSER,chromium.executablePath(),'/usr/bin/chromium'].find(path=>path&&existsSync(path))
assert.ok(executablePath,'BLOCKED installed Chromium unavailable')
const webCss=readdirSync('web/dist/assets').filter(n=>n.endsWith('.css')).map(n=>read('web/dist/assets/'+n)).join('\n')
const css=readdirSync('app/dist/assets').filter(n=>n.endsWith('.css')).map(n=>read('app/dist/assets/'+n)).join('\n')
assert.ok(css,'Build App Preview first')
const browser=await chromium.launch({headless:true,executablePath}),bundles=new Map()
const artifacts=process.env.KAWMED_G32_ARTIFACTS||'/tmp/kawmed-g3-2-evidence';mkdirSync(artifacts,{recursive:true})
async function bundle({baseline=false,mode='preview',publicBaseline=false,guarded=false}={}){
 const key=[baseline,mode,publicBaseline,guarded].join(':');if(bundles.has(key))return bundles.get(key)
 const result=await build({stdin:{contents:`import React from 'react';import{createRoot}from'react-dom/client';import{BrowserRouter,Routes,Route,useNavigate}from'react-router-dom';
import PublicMedical from './web/src/components/medical-profile/KawMedProfile.tsx';import AdminGuard from './app/src/components/admin/AdminGuard.tsx';import Medical from './${medicalPath}';import Agenda from './${dir}MedicalAppointments.tsx';import Requests from './${dir}MedicalNotifications.tsx';import Accounts from './app/src/components/admin/IntapcardAccountSelector.tsx';import FreeAgenda from './app/src/components/admin/free/FreeAppointments.tsx';
function Bridge(){const navigate=useNavigate();window.fixtureNavigate=(path,state)=>navigate(path,{state});return null}
function Guard({children}){return ${guarded}?<AdminGuard requireProfile={false}>{children}</AdminGuard>:children}
function App(){return <BrowserRouter><Bridge/><Routes><Route path="/m/:slug" element={<PublicMedical/>}/><Route path="/admin/medical" element={<Guard><Medical scope={new URLSearchParams(location.search).get('fixture_scope')==='sponsor_master'?'sponsor_master':'doctor'}/></Guard>}/><Route path="/admin/medical/agenda" element={<Guard><Agenda/></Guard>}/><Route path="/admin/medical/notifications" element={<Guard><Requests/></Guard>}/><Route path="/admin/accounts" element={<Guard><Accounts/></Guard>}/><Route path="/admin/medical/demo/:token/agenda" element={<Agenda/>}/><Route path="/admin/medical/demo/:token" element={<Medical/>}/><Route path="/admin/free/agenda" element={<FreeAgenda/>}/><Route path="/admin/free/shell-preview" element={<h1>Shell Free existente</h1>}/><Route path="/admin/free/account" element={<h1>Cuenta Free existente</h1>}/><Route path="/admin/sponsor/kawmed" element={<h1>Master médico existente</h1>}/></Routes></BrowserRouter>};createRoot(document.getElementById('root')).render(<App/>);`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,loader:{'.css':'empty'},jsx:'automatic',format:'iife',define:{'import.meta.env':JSON.stringify({MODE:mode})},plugins:baseline?[{name:'exact-173-baseline',setup(build){build.onLoad({filter:/(?:MedicalDashboard|MedicalAppointments|MedicalNotifications)\.tsx$/},args=>({contents:prior(dir+args.path.split('/').pop()),loader:'tsx'}))}}]:publicBaseline?[{name:'exact-174-public-baseline',setup(build){build.onLoad({filter:/(?:KawMedProfile|AppointmentOwnerBar)\.tsx$/},args=>({contents:execFileSync('git',['show','8ef347ce7a09d43953a725bcb2d8fec5102390d8:'+args.path.slice(process.cwd().length+1)],{encoding:'utf8'}),loader:'tsx'}))}}]:[]})
 bundles.set(key,result.outputFiles[0].text);return result.outputFiles[0].text
}
const medical={id:'doctor-a',professional_prefix:'Dra.',name:'Médica de prueba',account_email:'intapcard@gmail.com',slug:'medica-prueba',specialty:'Medicina general | Pediatría',status:'active',centers:[],schedules:[],insurance_policy:{accepted:[],excluded:[]}}
const requests=Array.from({length:6},(_,i)=>({id:'request-'+i,customer_name:'Paciente sintético '+i,customer_phone:'8095550100',appointment_date:'2026-12-01',start_time:'09:00',end_time:'09:30',timezone:'America/Santo_Domingo',reason_label:'Consulta de prueba',status:i===4?'confirmed':i===5?'rejected':'pending',created_at:'2026-11-17 12:00:0'+i}))
const settings={enabled:true,slot_minutes:30,min_notice_minutes:120,horizon_days:30,timezone:'America/Santo_Domingo',reason_mode:'default'}
async function open(options={}){
 const ctx=await browser.newContext({viewport:{width:options.width||390,height:900}}),page=await ctx.newPage(),calls=[],errors=[]
 page.setDefaultTimeout(10000);page.on('pageerror',error=>errors.push(error.message))
 const server={medical:{...medical,...options.data},agendaProfile:null,agendaFailure:'',profileFailure:options.profileFailure||'',owner:options.owner!==false,activeKind:options.activeKind||'medical',activeId:options.activeId||'doctor-a',activeToken:'a'.repeat(32),requests:structuredClone(requests),settings:structuredClone(settings),apiDelay:0}
 const js=await bundle(options)
 await page.route('**/*',async route=>{
  const request=route.request(),target=new URL(request.url()),path=target.pathname,json=data=>route.fulfill({contentType:'application/json',body:JSON.stringify(data)})
  if(path.startsWith('/api/')){
   calls.push({host:target.hostname,path,method:request.method(),headers:request.headers(),body:request.postDataJSON(),search:target.search})
   if(path.startsWith('/api/v1/public/medical-profiles/'))return json({ok:true,data:{...server.medical,display_name:'Dra. Médica de prueba',services:[],insurance_policy:{accepts_all:false,accepted:[],excluded:[]}}})
   if(path.endsWith('/appointments/public-context'))return json(server.owner?{ok:true,data:{is_owner:true,is_master:false,is_guest_editor:false,allow_direct_actions:false,enabled:true,pending_count:server.requests.filter(r=>r.status==='pending').length,pending:server.requests.filter(r=>r.status==='pending'),manage_url:'/admin/medical/agenda',settings_url:'/admin/medical'}}:{ok:false,error:'Not owner'})
   if(path==='/api/v1/me')return json({ok:true,data:{email:'intapcard@gmail.com'}})
   if(path==='/api/v1/me/home-route')return json({ok:true,data:{kind:'multiaccount',route:'/admin/accounts'}})
   if(path==='/api/v1/me/medical-profile')return json(server.profileFailure?{ok:false,error:server.profileFailure}:{ok:true,data:server.medical})
   if(path.endsWith('/appointments')){
    if(server.apiDelay)await new Promise(resolve=>setTimeout(resolve,server.apiDelay))
    return json(server.agendaFailure?{ok:false,error:server.agendaFailure}:{ok:true,data:{profile:{id:server.agendaProfile||server.medical.id,business_name:'Dra. Médica de prueba'},settings:server.settings,availability:[],reasons:[],custom_reasons:[],default_reasons:[],blocks:[],requests:server.requests}})
   }
   if(path.endsWith('/sponsor-context'))return json({ok:true,data:null})
   if(path==='/api/v1/me/intapcard/accounts')return json({ok:true,data:{items:[{kind:'medical',id:'doctor-a',title:'Médica de prueba'},{kind:'medical',id:'doctor-b',title:'Segunda médica'},{kind:'free',id:'free-a',title:'Free de prueba'}]}})
   if(path==='/api/v1/me/intapcard/active-account'){
    if(request.method()==='GET'){const presented=request.headers()['x-intap-account-tab']||'';return json({ok:true,data:{active:{kind:server.activeKind,id:server.activeId,route:'/admin/medical'},tab_session_valid:presented===server.activeToken,new_tab_token:presented?null:server.activeToken}})}
    const selection=request.postDataJSON();if(selection.kind==='medical')server.medical={...server.medical,id:selection.id}
    return json({ok:true,data:{...selection,tab_token:'a'.repeat(32),route:selection.kind==='medical'?'/admin/medical':'/admin/free'}})
   }
   if(path.endsWith('/appointments/settings')){server.settings=request.postDataJSON();return json({ok:true})}
   throw Error('Unexpected API '+request.method()+' '+path)
  }
  if(path==='/fixture.js')return route.fulfill({contentType:'application/javascript',body:js})
  if(path==='/fixture.css'||path==='/web-fixture.css')return route.fulfill({contentType:'text/css',body:path==='/web-fixture.css'?webCss:css})
  if(request.resourceType()==='image')return route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="#e2e8f0"/></svg>'})
  if(request.isNavigationRequest())return route.fulfill({contentType:'text/html',body:'<!doctype html><html lang="es"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="'+(target.pathname.startsWith('/m/')?'/web-fixture.css':'/fixture.css')+'"></head><body><div id="root"></div><script src="/fixture.js"></script></body></html>'})
  return route.fulfill({status:404,body:''})
 })
 await page.goto(options.url||'https://app.preview.intaprd.com/admin/medical?kawvo_med_shell=1')
 return{page,server,calls,close:async()=>{assert.deepEqual(errors,[],'No runtime errors');await ctx.close()}}
}
const writes=calls=>calls.filter(c=>c.method!=='GET'),nav=page=>page.locator('nav:visible').filter({has:page.getByRole('button',{name:'Inicio',exact:true})})
const tab=async(page,name)=>nav(page).getByRole('button',{name,exact:true}).click()
const backButton=page=>page.getByRole('button',{name:/^← Volver/})
async function screen(page,name){await page.screenshot({path:artifacts+'/'+name+'.png',fullPage:false})}
async function noOverflow(page){assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No global horizontal overflow')}
let count=0
async function scenario(name,fn){if(process.env.KAWMED_G32_CASE&&!name.includes(process.env.KAWMED_G32_CASE))return;await fn();console.log('PASS '+name);count++}
try{
 await scenario('U01/U02 reproduce #173: Perfil itself works; bare request return loses shell and Agenda is one-button bridge',async()=>{
  const r=await open({baseline:true}),{page}=r
  await tab(page,'Perfil');await page.getByRole('button',{name:/Identidad y especialidades/}).click();await page.getByRole('heading',{name:'Perfil profesional',exact:true}).waitFor()
  await tab(page,'Agenda');assert.equal(await page.getByRole('button',{name:'Abrir Agenda médica',exact:true}).count(),1);assert.equal(await page.getByRole('button',{name:'Bloqueos',exact:true}).count(),0);await screen(page,'baseline-agenda-390')
  await tab(page,'Más');await page.getByRole('link',{name:/Solicitudes médicas/}).click();await page.getByRole('heading',{name:'Solicitudes médicas',exact:true}).waitFor()
  await page.getByRole('link',{name:'← Volver a mi perfil médico',exact:true}).click();await page.getByRole('heading',{name:'Dra. Médica de prueba',exact:true}).waitFor();assert.equal(await page.locator('[data-kawmed-shell=doctor]').count(),0)
  assert.equal(writes(r.calls).length,0);await r.close()
 })
 await scenario('U02/U03 Perfil filters, each module, contextual back, reload and browser back; no navigation writes',async()=>{
  const r=await open(),{page}=r;await tab(page,'Perfil');await screen(page,'profile-390')
  for(const [id,name,heading] of [['profile','Identidad y especialidades','Perfil profesional'],['centers','Centros de atención','Centros de atención'],['schedule','Horarios por centro','Horarios de atención'],['insurance','Seguros y excepciones','Seguros médicos'],['appearance','Apariencia','Apariencia del perfil']]){
   await page.getByRole('searchbox').fill(name);await page.getByRole('button',{name:new RegExp(name)}).click();await page.getByRole('heading',{name:heading,exact:true}).waitFor()
   assert.equal(new URL(page.url()).searchParams.get('med_module'),id);await page.reload();await page.getByRole('heading',{name:heading,exact:true}).waitFor()
   await page.getByRole('button',{name:'← Volver al perfil médico',exact:true}).click();assert.equal(await page.getByRole('searchbox').inputValue(),name)
  }
  await page.getByRole('searchbox').fill('');await page.getByRole('button',{name:/Horarios por centro/}).click();await page.goBack();await page.getByRole('searchbox').waitFor();assert.equal(new URL(page.url()).searchParams.has('med_module'),false)
  assert.equal(writes(r.calls).length,0);await r.close()
 })
 await scenario('U08 parent drafts survive tabs, module list and cancel external leave',async()=>{
  const r=await open(),{page}=r;await tab(page,'Perfil');await page.getByRole('button',{name:/Identidad y especialidades/}).click();await page.getByRole('textbox',{name:'Nombre',exact:true}).fill('Borrador intacto')
  await tab(page,'Más');await page.getByRole('link',{name:/Solicitudes de citas médicas/}).click();await page.getByRole('alert').waitFor();assert.equal(new URL(page.url()).pathname,'/admin/medical')
  await tab(page,'Perfil');assert.equal(await page.getByRole('textbox',{name:'Nombre',exact:true}).inputValue(),'Borrador intacto')
  await page.getByRole('button',{name:'← Volver al perfil médico',exact:true}).click();await page.getByRole('button',{name:/Identidad y especialidades/}).click();assert.equal(await page.getByRole('textbox',{name:'Nombre',exact:true}).inputValue(),'Borrador intacto')
  assert.equal(writes(r.calls).length,0);await r.close()
 })
 for(const width of [320,360,390,430,768,1280])await scenario('U02/U05/U09 visual surfaces and tap targets '+width,async()=>{
  const r=await open({width}),{page}=r;await tab(page,'Perfil');await noOverflow(page);await tab(page,'Agenda');await page.getByRole('heading',{name:'Últimas solicitudes pendientes',exact:true}).waitFor();await page.getByText('Paciente sintético 3',{exact:true}).waitFor()
  assert.equal(await page.getByText('Paciente sintético 4',{exact:true}).count(),0);await noOverflow(page)
  for(const entry of ['Solicitudes de citas médicas','Citas confirmadas','Disponibilidad de Agenda','Bloqueos','Configuración y motivos']){const box=await page.getByRole('button',{name:new RegExp('^'+entry)}).boundingBox();assert.ok(box.width>=44&&box.height>=44)}
  if(width===390||width===1280)await screen(page,'agenda-'+width)
  await page.getByRole('button',{name:/^Bloqueos/}).click();await page.getByRole('heading',{name:'Agenda médica',exact:true}).waitFor();await noOverflow(page);const backBox=await backButton(page).boundingBox();assert.ok(backBox.width>=44&&backBox.height>=44);await backButton(page).click()
  await tab(page,'Más');await noOverflow(page);assert.equal(writes(r.calls).length,0);await r.close()
 })
 for(const [section,label,heading]of[['requests','Solicitudes de citas médicas','Solicitudes pendientes'],['confirmed','Citas confirmadas','Citas confirmadas'],['availability','Disponibilidad de Agenda','Horarios disponibles'],['blocks','Bloqueos','Bloquear días u horas'],['settings','Configuración y motivos','Configuración']])await scenario('U02/U03 Agenda existing entry, focus, reload, deterministic back '+section,async()=>{
  const r=await open(),{page}=r;await tab(page,'Agenda');await page.getByRole('button',{name:new RegExp('^'+label)}).click();await page.getByRole('heading',{name:'Agenda médica',exact:true}).waitFor()
  await page.waitForFunction(name=>document.activeElement?.textContent.startsWith(name),heading)
  await page.reload();await page.waitForFunction(name=>document.activeElement?.textContent.startsWith(name),heading)
  if(section==='availability'){assert.equal(await page.getByRole('button',{name:/Horarios disponibles/}).getAttribute('aria-expanded'),'true');await screen(page,'availability-390')}
  await backButton(page).click();await page.getByRole('heading',{name:'Agenda',exact:true}).waitFor();assert.equal(new URL(page.url()).searchParams.get('med_tab'),'agenda')
  assert.equal(writes(r.calls).length,0);await r.close()
 })
 await scenario('U03 center schedules to Agenda availability returns to exact profile submodule and filter',async()=>{
  const r=await open(),{page}=r;await tab(page,'Perfil');await page.getByRole('searchbox').fill('Horarios');await page.getByRole('button',{name:/Horarios por centro/}).click();await page.getByRole('button',{name:'Disponibilidad de Agenda',exact:true}).click()
  await page.getByRole('heading',{name:'Agenda médica',exact:true}).waitFor();await page.reload();await backButton(page).click();await page.getByRole('heading',{name:'Horarios de atención',exact:true}).waitFor();assert.equal(new URL(page.url()).searchParams.get('med_module'),'schedule')
  await page.getByRole('button',{name:'← Volver al perfil médico',exact:true}).click();assert.equal(await page.getByRole('searchbox').inputValue(),'Horarios');assert.equal(writes(r.calls).length,0);await r.close()
 })
 await scenario('U03/U04 request filter → request detail → filter → Más survives reload, scoped page deep link',async()=>{
  const r=await open(),{page}=r;await tab(page,'Más');await page.getByRole('link',{name:/Solicitudes de citas médicas/}).click();await page.getByText('Paciente sintético 0',{exact:true}).waitFor();await screen(page,'requests-390')
  assert.equal(await page.getByText('Paciente sintético 4',{exact:true}).count(),0)
  await page.getByRole('button',{name:'Citas confirmadas',exact:true}).click();await page.getByText('Paciente sintético 4',{exact:true}).waitFor();await page.getByRole('link',{name:'Gestionar en Agenda →',exact:true}).click()
  await page.locator('#appointment-request-request-4').waitFor();await page.reload();await page.locator('#appointment-request-request-4').waitFor();await backButton(page).click()
  await page.getByText('Paciente sintético 4',{exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'Citas confirmadas',exact:true}).getAttribute('aria-pressed'),'true')
  await page.reload();await page.getByRole('link',{name:'← Volver a Más opciones',exact:true}).click();await page.getByRole('heading',{name:'Más opciones',exact:true}).waitFor()
  assert.equal(writes(r.calls).length,0);await r.close()
 })
 await scenario('U03 direct copied link targets existing pending page 2; browser back restores Agenda',async()=>{
  const r=await open(),{page}=r;await tab(page,'Agenda');await page.getByRole('button',{name:/Paciente sintético 3/}).click();await page.locator('#appointment-request-request-3').waitFor();assert.equal(new URL(page.url()).searchParams.get('request'),'request-3')
  const copy=page.url();await page.goBack();await page.getByRole('heading',{name:'Agenda',exact:true}).waitFor();await page.goto(copy);await page.locator('#appointment-request-request-3').waitFor();await backButton(page).click();await page.getByRole('heading',{name:'Agenda',exact:true}).waitFor();assert.equal(writes(r.calls).length,0);await r.close()
 })
 await scenario('U03 account explicit back is read-only; verified selection resets foreign profile hints',async()=>{
  const r=await open(),{page}=r;await page.getByRole('link',{name:'Cambiar cuenta',exact:true}).click();await page.getByRole('heading',{name:'¿Qué deseas hacer?',exact:true}).waitFor();await page.getByRole('link',{name:'← Volver al perfil médico',exact:true}).click();await page.locator('[data-kawmed-shell=doctor]').waitFor();assert.equal(writes(r.calls).length,0)
  await page.getByRole('link',{name:'Cambiar cuenta',exact:true}).click();await page.getByRole('button',{name:/Gestionar cuenta existente/}).click();await page.getByRole('article').filter({has:page.getByRole('heading',{name:'Segunda médica',exact:true})}).getByRole('button').click();await page.locator('[data-kawmed-shell=doctor]').waitFor()
  assert.equal(new URL(page.url()).searchParams.get('med_account'),'doctor-b');assert.equal(new URL(page.url()).searchParams.get('med_tab'),'home');assert.equal(await page.evaluate(()=>sessionStorage.getItem('kawvo_intap_active_tab_v1')),'a'.repeat(32));assert.deepEqual(writes(r.calls).map(c=>c.path),['/api/v1/me/intapcard/active-account']);await r.close()
 })
 await scenario('U03 PWA help closes in context and installation URL preserves tab/module; no writes',async()=>{
  const r=await open(),{page}=r;await tab(page,'Más');await page.getByRole('button',{name:'Instalar app Kawvo',exact:true}).click();const help=page.getByRole('dialog');await help.waitFor();const href=await help.getByRole('link').getAttribute('href');assert.equal(new URL(href).searchParams.get('med_tab'),'more');assert.equal(new URL(href).searchParams.get('kawvo_med_shell'),'1');await help.getByRole('button',{name:/Entendido|Cerrar/}).click();await page.getByRole('heading',{name:'Más opciones',exact:true}).waitFor();assert.equal(writes(r.calls).length,0);await r.close()
 })
 await scenario('U08 Agenda dirty cancellation preserves settings; explicit discard returns without save',async()=>{
  const r=await open({url:'https://app.preview.intaprd.com'+url('/admin/medical/agenda',{account:'doctor-a',tab:'agenda'},{section:'settings'})}),{page}=r;await page.getByRole('heading',{name:'Agenda médica',exact:true}).waitFor();await page.getByRole('combobox',{name:'Duración',exact:true}).selectOption('45')
  let discard=false,prompts=0;page.on('dialog',dialog=>{prompts++;void(discard?dialog.accept():dialog.dismiss())});await backButton(page).click();assert.equal(prompts,1);assert.equal(await page.getByRole('combobox',{name:'Duración',exact:true}).inputValue(),'45');assert.equal(writes(r.calls).length,0)
  discard=true;await backButton(page).click();await page.getByRole('heading',{name:'Agenda',exact:true}).waitFor();assert.equal(prompts,2);assert.equal(writes(r.calls).length,0);await r.close()
 })
 await scenario('U08 native browser back cannot discard Agenda drafts silently; explicit save still uses existing operation',async()=>{
  const r=await open(),{page}=r;await tab(page,'Agenda');await page.getByRole('button',{name:/^Configuración y motivos/}).click();await page.getByRole('heading',{name:'Agenda médica',exact:true}).waitFor();await page.getByRole('combobox',{name:'Duración',exact:true}).selectOption('45')
  let prompts=0;page.on('dialog',dialog=>{prompts++;void dialog.dismiss()});const origin=page.url();await page.goBack();await page.waitForURL(origin);assert.equal(prompts,1);assert.equal(await page.getByRole('combobox',{name:'Duración',exact:true}).inputValue(),'45');assert.equal(writes(r.calls).length,0)
  await page.getByRole('button',{name:'Guardar configuración de agenda',exact:true}).click();await page.getByText('Agenda guardada.',{exact:true}).waitFor();assert.deepEqual(writes(r.calls).map(c=>[c.method,c.path]),[['PUT','/api/v1/me/medical-profile/appointments/settings']]);assert.equal(writes(r.calls)[0].body.slot_minutes,45)
  await backButton(page).click();await page.getByRole('heading',{name:'Agenda',exact:true}).waitFor();assert.equal(prompts,1);await r.close()
 })
 await scenario('U08 error, empty, permission and mismatched identity never masquerade as summary success',async()=>{
  const r=await open(),{page,server}=r;server.requests=[];await tab(page,'Agenda');await page.getByText('No tienes solicitudes pendientes.',{exact:true}).waitFor()
  server.agendaFailure='Unauthorized';server.apiDelay=100;await tab(page,'Inicio');await tab(page,'Agenda');await page.getByText('Cargando solicitudes…',{exact:true}).waitFor();await page.getByRole('alert').waitFor();await page.getByText('No se pudo verificar el acceso a la Agenda de esta cuenta. Comprueba la cuenta activa y tus permisos.',{exact:true}).waitFor();server.agendaFailure='';server.agendaProfile='other-doctor';await page.getByRole('button',{name:'Reintentar',exact:true}).click();await page.getByRole('alert').waitFor();assert.equal(await page.getByText('Paciente sintético 0',{exact:true}).count(),0)
  await page.getByRole('button',{name:/^Solicitudes de citas médicas/}).click();await page.getByText('La Agenda no corresponde a la cuenta médica de origen. Vuelve al perfil y verifica la cuenta activa.',{exact:true}).waitFor();assert.equal(await page.locator('[id^=appointment-request-]').count(),0);assert.equal(await page.getByRole('button',{name:'Guardar configuración de agenda',exact:true}).count(),0);assert.equal(writes(r.calls).length,0);await r.close()
  for(const path of ['/admin/medical/agenda','/admin/medical/notifications']){const bad=await open({url:'https://app.preview.intaprd.com'+url(path,{account:'foreign-doctor',tab:'agenda'})});await bad.page.getByRole('alert').waitFor();assert.equal(await bad.page.getByText('Paciente sintético 0',{exact:true}).count(),0);assert.equal(writes(bad.calls).length,0);await bad.close()}
 })
 await scenario('U03/U08 denied context retry recovers safely; missing request deep link is explicit',async()=>{
  for(const path of ['/admin/medical/agenda','/admin/medical/notifications']){
   const r=await open({profileFailure:'Unauthorized',url:'https://app.preview.intaprd.com'+url(path,{account:'doctor-a',tab:'agenda'})}),{page,server}=r;await page.getByRole('alert').waitFor();assert.equal(await page.getByText('Paciente sintético 0',{exact:true}).count(),0);server.profileFailure='';await page.getByRole('button',{name:'Reintentar',exact:true}).click();await page.getByRole('heading',{name:path.endsWith('agenda')?'Agenda médica':'Solicitudes de citas médicas',exact:true}).waitFor();assert.equal(writes(r.calls).length,0);await r.close()
  }
  const r=await open({url:'https://app.preview.intaprd.com'+url('/admin/medical/agenda',{account:'doctor-a',tab:'agenda'},{section:'requests',request:'not-in-this-account'})});await r.page.getByText('La solicitud no existe o no pertenece a esta cuenta médica. Puedes volver a Agenda para revisar las solicitudes disponibles.',{exact:true}).waitFor();assert.equal(writes(r.calls).length,0);await r.close()
 })
 await scenario('U01/U08 opt-in isolation and deterministic legacy guest/Master/doctor returns',async()=>{
  for(const options of [{mode:'production'},{url:'https://isolated.pages.dev/admin/medical?kawvo_med_shell=1'},{url:'https://app.preview.intaprd.com/admin/medical'},{url:'https://app.preview.intaprd.com/admin/medical?kawvo_med_shell=1&fixture_scope=sponsor_master'},{data:{guest_editor:true}}]){const r=await open(options);await r.page.getByRole('heading',{name:'Dra. Médica de prueba',exact:true}).waitFor();assert.equal(await r.page.locator('[data-kawmed-shell=doctor]').count(),0);assert.equal(writes(r.calls).length,0);await r.close()}
  for(const [path,target]of[['/admin/medical/agenda','/admin/medical'],['/admin/medical/agenda?scope=sponsor_master','/admin/sponsor/kawmed?tab=profile'],['/admin/medical/demo/i-fixture/agenda','/admin/medical/demo/i-fixture']]){const r=await open({url:'https://app.preview.intaprd.com'+path});await r.page.getByRole('heading',{name:/^Agenda/}).waitFor();await backButton(r.page).click();await r.page.waitForURL('https://app.preview.intaprd.com'+target);assert.equal(writes(r.calls).length,0);await r.close()}
 })
 await scenario('U07 shared AppointmentManager retains Free requests entry and context return',async()=>{
  const r=await open(),{page}=r;await page.evaluate(()=>window.fixtureNavigate('/admin/free/agenda?section=requests',{kawvoShellReturn:true,kawvoShellTab:'agenda',kawvoShellAccount:'free-a'}));await page.getByRole('heading',{name:'Horario y agenda',exact:true}).waitFor();await page.waitForFunction(()=>document.activeElement?.textContent.startsWith('Solicitudes pendientes'));await backButton(page).click();await page.getByRole('heading',{name:'Shell Free existente',exact:true}).waitFor();assert.equal(writes(r.calls).length,0);await r.close()
 })
 await scenario('U01/U03 public return: reproduce first context loss on #174 and recover full owner path',async()=>{
  const prior=await open({publicBaseline:true,guarded:true,url:'https://preview.intaprd.com/m/medica-prueba'}),page=prior.page
  await page.getByRole('button',{name:'Abrir menú del perfil',exact:true}).click();const oldLink=page.getByRole('link',{name:'Editar mi perfil',exact:true});assert.equal(await oldLink.getAttribute('href'),'https://app.preview.intaprd.com/admin/medical')
  await oldLink.click();await page.getByRole('heading',{name:'Dra. Médica de prueba',exact:true}).waitFor();assert.equal(await page.locator('[data-kawmed-shell=doctor]').count(),0);await page.getByRole('button',{name:'Agenda',exact:true}).click();await page.getByRole('heading',{name:'Agenda médica',exact:true}).waitFor();await backButton(page).click();await page.getByRole('heading',{name:'Dra. Médica de prueba',exact:true}).waitFor();assert.equal(await page.locator('[data-kawmed-shell=doctor]').count(),0);assert.equal(writes(prior.calls).length,0);await prior.close()
  for(const width of [390,1280]){
   const r=await open({guarded:true,width,url:'https://preview.intaprd.com/m/medica-prueba'}),{page}=r
   await page.getByRole('button',{name:'Agenda',exact:true}).waitFor()
   if(await page.getByRole('button',{name:'Abrir menú del perfil',exact:true}).isVisible()){await page.getByRole('button',{name:'Abrir menú del perfil',exact:true}).click();await page.getByRole('link',{name:'Editar mi perfil',exact:true}).click()}else await page.getByRole('button',{name:'Editar mi perfil',exact:true}).click()
   await page.getByRole('heading',{name:'Mi perfil',exact:true}).waitFor();assert.equal(new URL(page.url()).searchParams.get('med_account'),'doctor-a');await page.reload();await page.getByRole('heading',{name:'Mi perfil',exact:true}).waitFor()
   await tab(page,'Agenda');await page.getByRole('button',{name:/^Solicitudes de citas médicas/}).click();await page.getByRole('heading',{name:'Agenda médica',exact:true}).waitFor();await backButton(page).click();await page.getByRole('heading',{name:'Agenda',exact:true}).waitFor()
   await tab(page,'Más');await page.getByRole('link',{name:/Solicitudes de citas médicas/}).click();await page.getByText('Paciente sintético 0',{exact:true}).waitFor();await page.getByRole('link',{name:'Gestionar en Agenda →',exact:true}).first().click();await page.locator('#appointment-request-request-0').waitFor();await page.reload();await backButton(page).click();await page.getByRole('heading',{name:'Solicitudes de citas médicas',exact:true}).waitFor();await page.getByRole('link',{name:'← Volver a Más opciones',exact:true}).click();await page.getByRole('heading',{name:'Más opciones',exact:true}).waitFor()
   assert.equal(await page.locator('[data-kawmed-shell=doctor]').count(),1);assert.equal(await page.evaluate(()=>sessionStorage.getItem('kawvo_intap_active_tab_v1')),'a'.repeat(32));assert.equal(writes(r.calls).length,0);await r.close()
  }
 })
 await scenario('U03 public Agenda entry and copied owner links survive direct entry and reload with real guard',async()=>{
  const r=await open({guarded:true,url:'https://preview.intaprd.com/m/medica-prueba'}),{page}=r;await page.getByRole('button',{name:'Agenda',exact:true}).click();await page.getByRole('heading',{name:'Agenda',exact:true}).waitFor();assert.equal(new URL(page.url()).searchParams.get('med_tab'),'agenda');const copy=page.url();await page.goto('https://preview.intaprd.com/m/medica-prueba');await page.goto(copy);await page.reload();await page.getByRole('heading',{name:'Agenda',exact:true}).waitFor();await page.goto('https://preview.intaprd.com/m/medica-prueba');await page.getByRole('button',{name:'Solicitudes de agenda',exact:true}).click();await page.getByRole('button',{name:'Gestionar agenda',exact:true}).click();await page.getByRole('heading',{name:'Agenda',exact:true}).waitFor();assert.equal(writes(r.calls).length,0);await r.close()
 })
 await scenario('U03 public owner hints never switch active account or renew a stale tab',async()=>{
  const wrong=await open({guarded:true,activeKind:'free',url:'https://preview.intaprd.com/m/medica-prueba'});await wrong.page.getByRole('button',{name:'Agenda',exact:true}).click();await wrong.page.getByRole('heading',{name:'¿Qué deseas hacer?',exact:true}).waitFor();assert.equal(await wrong.page.locator('[data-kawmed-shell=doctor]').count(),0);assert.equal(writes(wrong.calls).length,0);await wrong.close()
  const stale=await open({guarded:true,url:'https://preview.intaprd.com/m/medica-prueba'});await stale.page.goto('https://app.preview.intaprd.com/admin/accounts');await stale.page.evaluate(()=>sessionStorage.setItem('kawvo_intap_active_tab_v1','b'.repeat(32)));await stale.page.goto('https://preview.intaprd.com/m/medica-prueba');await stale.page.getByRole('button',{name:'Agenda',exact:true}).click();await stale.page.getByRole('heading',{name:'¿Qué deseas hacer?',exact:true}).waitFor();assert.equal(await stale.page.evaluate(()=>sessionStorage.getItem('kawvo_intap_active_tab_v1')),'b'.repeat(32));assert.equal(writes(stale.calls).length,0);await stale.close()
 })
 await scenario('U08 public patients and production owner navigation remain unchanged',async()=>{
  const visitor=await open({guarded:true,owner:false,url:'https://preview.intaprd.com/m/medica-prueba'});await visitor.page.getByRole('heading',{name:'Dra. Médica de prueba',exact:true}).waitFor();const patientMarkup=await visitor.page.locator('.kawmed-profile').innerHTML();const baselineVisitor=await open({publicBaseline:true,owner:false,url:'https://preview.intaprd.com/m/medica-prueba'});await baselineVisitor.page.getByRole('heading',{name:'Dra. Médica de prueba',exact:true}).waitFor();assert.equal(patientMarkup,await baselineVisitor.page.locator('.kawmed-profile').innerHTML(),'Patient UI byte-identical');await baselineVisitor.close();assert.equal(await visitor.page.getByRole('button',{name:'Agenda',exact:true}).count(),0);assert.equal(await visitor.page.getByRole('button',{name:'Abrir menú del perfil',exact:true}).count(),0);assert.equal(writes(visitor.calls).length,0);await visitor.close()
  const prod=await open({mode:'production',url:'https://intaprd.com/m/medica-prueba'});await prod.page.getByRole('button',{name:'Abrir menú del perfil',exact:true}).click();assert.equal(await prod.page.getByRole('link',{name:'Editar mi perfil',exact:true}).getAttribute('href'),'https://app.intaprd.com/admin/medical');assert.equal(writes(prod.calls).length,0);await prod.close()
 })
 console.log(`PASS G3.2 browser: ${count} scenarios, actual components/router/CSS, synthetic intercepted API only; not authenticated QA`)
}finally{await browser.close()}
// Cumulative U05/U06/G3.1.1 suite: no dropped assertions; only an explicit Home return after the new persisted-tab reload.
if(!process.env.KAWMED_G32_CASE){const {runG311Browser}=await import('./kawvo-g3-1-1-browser.mjs');await runG311Browser({contextual:true})}

}
