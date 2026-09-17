import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { apiGet } from '../../../lib/api'

const PROFILE_KEY='kawvo_sponsored_public_code'
const MASTER_KEY='kawvo_sponsor_master_code'
const PANEL_KEY='kawvo_sponsored_panel_resume'
function valid(value:string){return /^[A-Z2-9]{8,24}$/.test(value)}

export default function SponsoredResumeGate(){
  const location=useLocation();const navigate=useNavigate()
  useEffect(()=>{
    if(location.pathname==='/admin/login'||location.pathname==='/admin/check-email'||location.pathname.startsWith('/auth/')||location.pathname.startsWith('/admin/sponsored/entry')||location.pathname.startsWith('/admin/sponsor/entry'))return
    const profileCode=String(sessionStorage.getItem(PROFILE_KEY)||localStorage.getItem(PROFILE_KEY)||'').trim().toUpperCase()
    const masterCode=String(sessionStorage.getItem(MASTER_KEY)||localStorage.getItem(MASTER_KEY)||'').trim().toUpperCase()
    const panelResume=(sessionStorage.getItem(PANEL_KEY)||localStorage.getItem(PANEL_KEY))==='1'
    if(!valid(profileCode)&&!valid(masterCode)&&!panelResume)return
    if(valid(profileCode)&&location.pathname==='/admin/sponsored/activate')return
    if(valid(masterCode)&&location.pathname.startsWith('/admin/sponsor'))return
    if(panelResume&&location.pathname==='/admin/sponsored')return
    let alive=true
    apiGet('/me').then((json:any)=>{
      if(!alive||!json?.ok)return
      if(valid(masterCode)){navigate(`/admin/sponsor?master=${encodeURIComponent(masterCode)}`,{replace:true});return}
      if(valid(profileCode)){navigate(`/admin/sponsored/activate?public_code=${encodeURIComponent(profileCode)}`,{replace:true});return}
      if(panelResume)navigate('/admin/sponsored',{replace:true})
    }).catch(()=>undefined)
    return()=>{alive=false}
  },[location.pathname,navigate])
  return null
}
