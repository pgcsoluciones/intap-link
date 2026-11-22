// Public owner bar regression: actual component/CSS, all HTTP mocked. No authenticated QA.
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {existsSync,mkdirSync,readFileSync,readdirSync,writeFileSync} from 'node:fs'
import {build} from 'esbuild'
const require=createRequire(import.meta.url),{chromium}=require('playwright')
const executablePath=[process.env.KAWMED_TEST_BROWSER,chromium.executablePath(),'/usr/bin/chromium'].find(p=>p&&existsSync(p))
assert.ok(executablePath,'BLOCKED: installed Chromium unavailable')
const artifacts=process.env.OWNER_LABEL_ARTIFACTS||'/tmp/kawvo-g5-owner-label';mkdirSync(artifacts,{recursive:true})
const css=readdirSync('web/dist/assets').filter(p=>p.endsWith('.css')).map(p=>readFileSync('web/dist/assets/'+p,'utf8')).join('\n')
const browser=await chromium.launch({headless:true,executablePath}),results=[]
try{
 for(const mode of ['preview','production'])for(const width of [320,360,390,430,768,1280]){
  for(const variant of ['master','beneficiary','free','explicit-medical','explicit-configuration','visitor']){
   const owner=variant!=='visitor',mobileMenu=variant.startsWith('explicit-'),label=variant==='explicit-medical'?'Perfil':variant==='explicit-configuration'?'Configuración de Agenda':undefined
   const settingsPath=variant==='free'?'/admin/free/account':'/admin/sponsored',destination=variant==='master'?'/admin/sponsor':settingsPath
   const host=mode==='preview'?'https://preview.intaprd.com':'https://intaprd.com',origin=mode==='preview'?'https://app.preview.intaprd.com':'https://app.intaprd.com',calls=[],errors=[]
   const compiled=await build({stdin:{contents:`import React from 'react';import{createRoot}from'react-dom/client';import OwnerBar from './web/src/components/appointments/AppointmentOwnerBar';createRoot(document.getElementById('root')).render(<OwnerBar username="fixture" ownerApiBase="${origin}/api/v1/me/sponsored-profile/appointments" manageOrigin="${origin}" settingsPath="${settingsPath}" ${label?`settingsLabel=${JSON.stringify(label)}`:''} mobileMenu={${mobileMenu}} palette={{accent:'#0891b2',accentSoft:'#ecfeff',text:'#0f172a'}} onToast={()=>{}}/>);`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,jsx:'automatic',format:'iife',define:{'import.meta.env':JSON.stringify({MODE:mode})}})
   const context=await browser.newContext({viewport:{width,height:900}}),p=await context.newPage();p.on('pageerror',e=>errors.push(e.message))
   await p.route('**/*',async route=>{const req=route.request(),u=new URL(req.url());if(u.pathname.endsWith('/public-context')){calls.push(req.method());return route.fulfill({contentType:'application/json',body:JSON.stringify({ok:true,data:{is_owner:owner,is_master:variant==='master',enabled:true,pending:[],pending_count:0,manage_url:'/admin/sponsored/agenda'+(variant==='master'?'?scope=master':''),...(variant==='master'?{settings_url:destination}:{})}})})}if(u.pathname==='/fixture.js')return route.fulfill({contentType:'application/javascript',body:compiled.outputFiles[0].text});if(u.pathname==='/fixture.css')return route.fulfill({contentType:'text/css',body:css});return route.fulfill({contentType:'text/html',body:u.pathname==='/fixture'?'<html lang="es"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fixture.css"></head><body style="margin:0"><div id="root"></div><script src="/fixture.js"></script></body></html>':'<h1>Destino existente</h1>'})})
   const response=p.waitForResponse(r=>r.url().includes('/public-context'));await p.goto(host+'/fixture');await response;
   if(owner){
    const expected=label||'Editar perfil';await p.getByRole('button',{name:'Solicitudes de agenda',exact:true}).waitFor()
    assert.equal(await p.getByRole('button',{name:'Configuración',exact:true}).count(),0)
    assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No global overflow')
    let edit=p.getByRole('button',{name:expected,exact:true})
    if(mobileMenu&&width<=700){await p.getByRole('button',{name:'Abrir menú del perfil',exact:true}).click();edit=p.getByRole('link',{name:expected,exact:true});assert.equal(await edit.getAttribute('href'),origin+destination)}
    if(mode==='preview'&&width===390&&variant==='master')await p.screenshot({path:artifacts+'/ownerbar-390.png'})
    await edit.click();await p.waitForURL(origin+destination);await p.getByRole('heading',{name:'Destino existente',exact:true}).waitFor()
   }else{await p.waitForFunction(()=>document.getElementById('root')?.childElementCount===0);assert.equal(await p.getByRole('button').count(),0)}
   assert.deepEqual(calls,['GET']);assert.deepEqual(errors,[]);results.push({mode,width,variant,label:label||'Editar perfil',destination:owner?origin+destination:null,status:'PASS'});await context.close()
  }
 }
 writeFileSync(artifacts+'/results.json',JSON.stringify(results,null,2)+'\n');console.log('PASS public owner label: '+results.length+' fixture cases; same destinations and permission boundary; explicit labels unchanged; no global overflow')
}finally{await browser.close()}
