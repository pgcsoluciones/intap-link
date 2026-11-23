// Real React components, guards and compiled CSS. Every HTTP request is intercepted.
// Synthetic fixtures only: not authenticated Preview/Production QA.
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {existsSync,readdirSync,readFileSync,mkdirSync,writeFileSync} from 'node:fs'
import {build} from 'esbuild'
const require=createRequire(import.meta.url)
export async function runG8Browser(){
 const {chromium}=require('playwright'),executablePath=[process.env.KAWMED_TEST_BROWSER,chromium.executablePath(),'/usr/bin/chromium'].find(p=>p&&existsSync(p));assert.ok(executablePath,'BLOCKED: installed Chromium missing')
 const browser=await chromium.launch({headless:true,executablePath}),bundles=new Map(),results=[],artifacts=process.env.KAWVO_G8_ARTIFACTS||'/tmp/kawvo-g8-validation/g8-browser'
 mkdirSync(artifacts,{recursive:true});const css=readdirSync('app/dist/assets').filter(p=>p.endsWith('.css')).map(p=>readFileSync('app/dist/assets/'+p,'utf8')).join('\n')
 async function compiled(mode){
  if(!bundles.has(mode))bundles.set(mode,(await build({stdin:{contents:`import React from 'react';import{createRoot}from'react-dom/client';import{BrowserRouter,Routes,Route}from'react-router-dom';import Sponsor from './app/src/components/admin/sponsored/SponsorKawMed';import Guard from './app/src/components/admin/AdminGuard';import Team from './app/src/components/admin/free/TeamPermissionGuard';import Products from './app/src/components/admin/AdminProducts';import FAQs from './app/src/components/admin/AdminFAQs';import Videos from './app/src/components/admin/AdminVideos';createRoot(document.getElementById('root')).render(<BrowserRouter><Routes><Route path="/admin/sponsor/kawmed" element={<Guard requireProfile={false}><Sponsor/></Guard>}/><Route path="/admin/products" element={<Guard planScope="paid"><Products/></Guard>}/><Route path="/admin/faqs" element={<Guard planScope="paid"><FAQs/></Guard>}/><Route path="/admin/videos" element={<Guard planScope="paid"><Videos/></Guard>}/><Route path="/fixture-team" element={<Team permission="design"><h1>Editor Team autorizado</h1></Team>}/><Route path="/admin/free" element={<h1>Perfil Free existente</h1>}/><Route path="/admin/login" element={<h1>Login existente</h1>}/></Routes></BrowserRouter>);`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,format:'iife',jsx:'automatic',define:{'import.meta.env':JSON.stringify({MODE:mode})}})).outputFiles[0].text)
  return bundles.get(mode)
 }
 async function open({width=390,mode='preview',plan='pro',team='allowed',path='/admin/sponsor/kawmed?kawvo_med_shell=1&tab=codes'}={}){
  const host=mode==='preview'?'https://app.preview.intaprd.com':'https://app.intaprd.com',context=await browser.newContext({viewport:{width,height:900}}),page=await context.newPage(),calls=[],errors=[],unexpected=[]
  page.on('pageerror',e=>errors.push(e.message));const js=await compiled(mode)
  const medical={id:'master-fixture',name:'Presentación Master sintética',slug:'master-fixture',specialty:'Laboratorio',status:'active',centers:[],schedules:[],insurance_policy:{accepted:[],excluded:[]}}
  const overview={sponsor:{id:'tenant-fixture',name:'Patrocinador sintético',role:'owner'},master:{master_code:'MEDM-FIXTURE',status:'claimed'},programs:[{id:'program-fixture',name:'Programa sintético'}],representatives:[{id:'rep-a',first_name:'Erika',last_name:'Espinal',active:1}],batches:[],codes:[{id:'one',code:'MED-TEST-ONE',display_code:'M0A1',station_number:1,status:'claimed',medical_name:'Carmen Jiménez Díaz',medical_specialty:'Medicina General',representative_id:'rep-a',representative_first_name:'Erika',representative_last_name:'Espinal'},{id:'two',code:'MED-TEST-TWO',station_number:2,status:'available',medical_name:'Otra persona sintética',medical_specialty:'Pediatría'}]}
  await page.route('**/*',async route=>{
   const req=route.request(),u=new URL(req.url()),p=u.pathname,json=data=>route.fulfill({contentType:'application/json',body:JSON.stringify(data)})
   if(p.startsWith('/api/')){
    calls.push({path:p,method:req.method()});assert.equal(req.method(),'GET','Search/navigation/guard test cannot write')
    if(p==='/api/v1/me')return json({ok:true,data:{email:'owner@example.test',profile_id:'fixture-profile',plan_id:plan}})
    if(p==='/api/v1/me/home-route')return json({ok:true,data:{kind:path.includes('kawmed')?'medical_master':'paid',route:path.includes('kawmed')?'/admin/sponsor/kawmed':'/admin'}})
    if(p==='/api/v1/sponsor/kawmed/overview')return json({ok:true,data:overview})
    if(p==='/api/v1/sponsor/accounts')return json({ok:true,data:{current_sponsor_id:'tenant-fixture',accounts:[{sponsor_id:'tenant-fixture',name:'Patrocinador sintético',has_normal_master:1,has_kawmed:1}]}})
    if(p==='/api/v1/me/intapcard/active-account')return json({ok:true,data:{active:null}})
    if(p==='/api/v1/me/medical-profile')return json({ok:true,data:medical})
    if(p==='/api/v1/me/team/context')return json({ok:true,data:{role:'member',member:{master_name:'Team sintético',permissions:team==='allowed'?['design']:['name']}}})
    if(['/api/v1/me/products','/api/v1/me/faqs','/api/v1/me/videos'].includes(p))return json({ok:true,data:[]})
    if(p.endsWith('/appointments'))return json({ok:true,data:{profile:{id:medical.id},settings:{enabled:true},requests:[],appointments:[],blocks:[]}})
    unexpected.push(p);return route.fulfill({status:500,contentType:'application/json',body:'{"ok":false,"error":"Unexpected fixture request"}'})
   }
   if(p==='/fixture.js')return route.fulfill({contentType:'application/javascript',body:js})
   if(p==='/fixture.css')return route.fulfill({contentType:'text/css',body:css})
   if(req.resourceType()==='image')return route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg"/>'})
   return route.fulfill({contentType:'text/html',body:'<!doctype html><html lang="es"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fixture.css"><div id="root"></div><script src="/fixture.js"></script></html>'})
  })
  await page.goto(host+path)
  return {page,context,calls,errors,unexpected}
 }
 const done=async(f,name)=>{assert.deepEqual(f.errors,[]);assert.deepEqual(f.unexpected,[]);assert.ok(f.calls.every(c=>c.method==='GET'));results.push({name,result:'PASS',simulated:true});await f.context.close();console.log('PASS G8 browser '+name)}
 try{
  for(const width of [320,360,390,430,768,1280]){
   const f=await open({width}),p=f.page,query=p.getByRole('textbox',{name:'Buscar estaciones',exact:true}),counter=p.getByRole('status').filter({hasText:/estaciones encontradas/})
   await query.waitFor();await query.fill('carmen jimenez');await counter.filter({hasText:'1 de 2 estaciones encontradas'}).waitFor()
   await query.fill('erika general');await counter.filter({hasText:'1 de 2 estaciones encontradas'}).waitFor()
   await p.getByRole('combobox',{name:'Estado de estaciones',exact:true}).selectOption('available');await counter.filter({hasText:'0 de 2 estaciones encontradas'}).waitFor()
   await p.getByRole('button',{name:'Limpiar filtros',exact:true}).click();assert.equal(await query.inputValue(),'');await counter.filter({hasText:'2 de 2 estaciones encontradas'}).waitFor()
   assert.equal(new URL(p.url()).searchParams.has('codeQuery'),false)
   await query.fill('m0a1 activado');await counter.filter({hasText:'1 de 2 estaciones encontradas'}).waitFor();await p.getByRole('button',{name:'Seleccionar visibles',exact:true}).click();await p.getByText('1 seleccionadas',{exact:true}).waitFor()
   assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No global horizontal overflow')
   if([320,1280].includes(width))await p.screenshot({path:artifacts+'/master-search-'+width+'.png',fullPage:true})
   await done(f,'approved G7.1 search/reset/selection/no writes/no overflow '+width)
  }
  for(const [path,label] of [['/admin/products','Productos y servicios'],['/admin/faqs','Preguntas frecuentes'],['/admin/videos','Videos']]){
   const f=await open({mode:'production',path});await f.page.getByRole('heading',{name:label,exact:true}).waitFor();assert.equal(new URL(f.page.url()).pathname,path);await done(f,'paid legacy module '+path)
  }
  const free=await open({mode:'production',path:'/admin/products',plan:'free'});await free.page.getByRole('heading',{name:'Perfil Free existente',exact:true}).waitFor();await done(free,'paid guard redirects unauthorized Free plan')
  for(const team of ['allowed','denied']){
   const f=await open({mode:'production',path:'/fixture-team',team});await f.page.getByRole('heading',{name:team==='allowed'?'Editor Team autorizado':'Opción administrada por el Team',exact:true}).waitFor();await done(f,'existing Team design permission '+team)
  }
  writeFileSync(artifacts+'/results.json',JSON.stringify(results,null,2));console.log('PASS G8 additional browser '+results.length+' groups; all HTTP simulated, not authenticated QA')
 }finally{await browser.close()}
}
