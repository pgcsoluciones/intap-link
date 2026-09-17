import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { apiGet } from '../../../lib/api'

const KEY='kawvo_sponsored_public_code'
function valid(value:string){return /^[A-Z2-9]{8,24}$/.test(value)}

export default function SponsoredResumeGate(){
  const location=useLocation();const navigate=useNavigate()
  useEffect(()=>{
    const raw=String(sessionStorage.getItem(KEY)||localStorage.getItem(KEY)||'').trim().toUpperCase()
    if(!valid(raw))return
    if(location.pathname==='/admin/sponsored/activate'||location.pathname==='/admin/login'||location.pathname==='/admin/check-email'||location.pathname.startsWith('/auth/'))return
    let alive=true
    apiGet('/me').then((json:any)=>{
      if(!alive||!json?.ok)return
      navigate(`/admin/sponsored/activate?public_code=${encodeURIComponent(raw)}`,{replace:true})
    }).catch(()=>undefined)
    return()=>{alive=false}
  },[location.pathname,navigate])
  return null
}
