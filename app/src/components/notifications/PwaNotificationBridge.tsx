import { useEffect, useRef } from 'react'
import { apiGet, apiPost } from '../../lib/api'
import { isFreeDemoDelegationActive } from '../../lib/freeDemoDelegation'

type NotificationItem={
  id:string
  type:string
  title:string
  message:string
  action_url?:string|null
  read_at?:string|null
  created_at?:string|null
}

export const AGENDA_SOUND_KEY='kawvo:agenda-notification-sound'
const ALERTED_KEY='kawvo:agenda-alerted-ids-v1'

function base64UrlToUint8Array(value:string){
  const padding='='.repeat((4-value.length%4)%4)
  const base64=(value+padding).replace(/-/g,'+').replace(/_/g,'/')
  const raw=atob(base64)
  return Uint8Array.from(raw,ch=>ch.charCodeAt(0))
}
async function syncPushSubscription():Promise<boolean>{
  if(typeof Notification==='undefined'||Notification.permission!=='granted'||!('serviceWorker' in navigator)||!('PushManager' in window))return false
  try{
    const keyJson:any=await apiGet('/me/push/public-key')
    const publicKey=String(keyJson?.data?.public_key||'')
    if(!keyJson?.ok||!keyJson.data?.enabled||!publicKey)return false
    const registration=await navigator.serviceWorker.ready
    let subscription=await registration.pushManager.getSubscription()
    if(!subscription){
      subscription=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:base64UrlToUint8Array(publicKey)})
    }
    const json=subscription.toJSON()
    const saved:any=await apiPost('/me/push/subscribe',{endpoint:subscription.endpoint,keys:json.keys||{}})
    return Boolean(saved?.ok)
  }catch{return false}
}
export function syncServiceWorkerPreference(kind:string){
  try{navigator.serviceWorker?.controller?.postMessage({type:'kawvo:agenda-sound',value:kind})}catch{}
}

function vibrate(){
  try{if('vibrate' in navigator)navigator.vibrate([120,70,120])}catch{}
}

let agendaAudioContext:AudioContext|null=null
let agendaAudioUnlocked=false

function getAgendaAudioContext(){
  try{
    const AudioCtx=(window.AudioContext||(window as any).webkitAudioContext)
    if(!AudioCtx)return null
    if(!agendaAudioContext||agendaAudioContext.state==='closed')agendaAudioContext=new AudioCtx()
    return agendaAudioContext
  }catch{return null}
}

export async function unlockAgendaNotificationAudio(){
  const ctx=getAgendaAudioContext()
  if(!ctx){vibrate();return false}
  try{
    if(ctx.state==='suspended')await ctx.resume()
    const osc=ctx.createOscillator(),gain=ctx.createGain()
    gain.gain.setValueAtTime(0.00001,ctx.currentTime)
    osc.connect(gain);gain.connect(ctx.destination)
    osc.start();osc.stop(ctx.currentTime+.01)
    agendaAudioUnlocked=ctx.state==='running'
    return agendaAudioUnlocked
  }catch{agendaAudioUnlocked=false;return false}
}

type AgendaToneStep={frequency:number;offset:number;duration:number;gain:number;wave:OscillatorType}
const AGENDA_TONES:Record<string,AgendaToneStep[]>={
  agenda:[
    {frequency:523,offset:0,duration:.11,gain:.16,wave:'triangle'},
    {frequency:659,offset:.12,duration:.11,gain:.18,wave:'triangle'},
    {frequency:880,offset:.25,duration:.24,gain:.20,wave:'triangle'},
  ],
  soft:[
    {frequency:392,offset:0,duration:.28,gain:.10,wave:'sine'},
    {frequency:523,offset:.30,duration:.34,gain:.09,wave:'sine'},
  ],
  pulse:[
    {frequency:1047,offset:0,duration:.055,gain:.18,wave:'square'},
    {frequency:1047,offset:.095,duration:.055,gain:.18,wave:'square'},
    {frequency:784,offset:.19,duration:.075,gain:.15,wave:'square'},
  ],
}

export function playAgendaNotificationCue(kind:string){
  if(kind==='silent'){vibrate();return}
  try{
    const ctx=getAgendaAudioContext()
    if(!ctx||ctx.state!=='running'||!agendaAudioUnlocked){vibrate();return}
    const now=ctx.currentTime
    const plan=AGENDA_TONES[kind]||AGENDA_TONES.agenda
    plan.forEach(({frequency,offset,duration,gain:peak,wave})=>{
      const osc=ctx.createOscillator(),gain=ctx.createGain()
      osc.type=wave;osc.frequency.value=frequency
      gain.gain.setValueAtTime(0.0001,now+offset)
      gain.gain.exponentialRampToValueAtTime(peak,now+offset+.012)
      gain.gain.exponentialRampToValueAtTime(.0001,now+offset+duration)
      osc.connect(gain);gain.connect(ctx.destination)
      osc.start(now+offset);osc.stop(now+offset+duration+.02)
    })
  }catch{vibrate()}
}

async function setBadge(count:number){
  try{
    const nav=navigator as any
    if(count>0&&typeof nav.setAppBadge==='function')await nav.setAppBadge(count)
    else if(count<=0&&typeof nav.clearAppBadge==='function')await nav.clearAppBadge()
  }catch{}
}

async function showSystemNotification(item:NotificationItem){
  if(document.visibilityState==='visible'||typeof Notification==='undefined'||Notification.permission!=='granted')return
  try{
    const reg=await navigator.serviceWorker?.ready
    if(!reg)return
    await reg.showNotification(item.title||'Nueva solicitud de agenda',{
      body:item.message||'Tienes una nueva solicitud.',
      icon:'/kawvo-icon-192.png',
      badge:'/kawvo-icon-192.png',
      tag:'agenda:'+item.id,
      renotify:true,
      data:{url:item.action_url||'/admin/free/home?source=pwa'},
    } as NotificationOptions)
  }catch{}
}

export default function PwaNotificationBridge(){
  const running=useRef(false)
  const pushReady=useRef(false)

  useEffect(()=>{
    if(isFreeDemoDelegationActive())return
    let active=true
    const unlock=()=>void unlockAgendaNotificationAudio()
    window.addEventListener('pointerdown',unlock,{passive:true})
    window.addEventListener('touchstart',unlock,{passive:true})
    window.addEventListener('keydown',unlock)
    void syncPushSubscription().then(value=>{pushReady.current=value})
    syncServiceWorkerPreference(localStorage.getItem(AGENDA_SOUND_KEY)||'agenda')
    async function poll(){
      if(running.current)return
      running.current=true
      try{
        const json:any=await apiGet('/me/notifications?limit=30')
        if(!active||!json?.ok)return
        const items=(Array.isArray(json.data?.items)?json.data.items:[]) as NotificationItem[]
        const unread=Number(json.data?.unread_count||items.filter(item=>!item.read_at).length||0)
        await setBadge(unread)
        window.dispatchEvent(new CustomEvent('kawvo:pwa-notifications',{detail:{unread,items}}))
        const agendaItems=items.filter(item=>['sponsored_appointment_request','free_appointment_request'].includes(item.type)&&!item.read_at)
        let alerted:string[]=[]
        try{const parsed=JSON.parse(localStorage.getItem(ALERTED_KEY)||'[]');alerted=Array.isArray(parsed)?parsed.map(String):[]}catch{}
        if(!localStorage.getItem(ALERTED_KEY)){
          localStorage.setItem(ALERTED_KEY,JSON.stringify(agendaItems.map(item=>item.id).slice(0,60)))
        }else{
          const known=new Set(alerted)
          const fresh=agendaItems.filter(item=>!known.has(item.id)).reverse()
          for(let i=0;i<fresh.length;i++){
            if(i)await new Promise(resolve=>window.setTimeout(resolve,650))
            if(document.visibilityState==='visible'){
              playAgendaNotificationCue(localStorage.getItem(AGENDA_SOUND_KEY)||'agenda')
            }else if(!pushReady.current){
              await showSystemNotification(fresh[i])
            }
            known.add(fresh[i].id)
          }
          const next=[...agendaItems.map(item=>item.id),...Array.from(known)].filter((id,index,array)=>array.indexOf(id)===index).slice(0,60)
          localStorage.setItem(ALERTED_KEY,JSON.stringify(next))
        }
      }catch{/* auth/temporary network errors are non-fatal */}
      finally{running.current=false}
    }
    void poll()
    const timer=window.setInterval(()=>void poll(),20000)
    const refresh=()=>void poll()
    const syncPush=()=>void syncPushSubscription().then(value=>{pushReady.current=value})
    window.addEventListener('focus',refresh)
    window.addEventListener('kawvo:notifications-changed',refresh)
    window.addEventListener('kawvo:push-permission-changed',syncPush)
    return()=>{active=false;window.clearInterval(timer);window.removeEventListener('focus',refresh);window.removeEventListener('kawvo:notifications-changed',refresh);window.removeEventListener('kawvo:push-permission-changed',syncPush);window.removeEventListener('pointerdown',unlock);window.removeEventListener('touchstart',unlock);window.removeEventListener('keydown',unlock)}
  },[])

  return null
}
