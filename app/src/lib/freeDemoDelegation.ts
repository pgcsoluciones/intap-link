export const FREE_DEMO_DELEGATION_STORAGE_KEY='kawvo_free_demo_admin_id'
export const FREE_DEMO_DELEGATION_QUERY='demo_admin'

function clean(value:unknown){
  const id=String(value||'').trim()
  return /^[a-f0-9-]{20,80}$/i.test(id)?id:''
}

export function captureFreeDemoDelegationFromLocation(){
  if(typeof window==='undefined')return''
  const path=window.location.pathname
  if(!path.startsWith('/admin/free'))return''
  const params=new URLSearchParams(window.location.search)
  const fromUrl=clean(params.get(FREE_DEMO_DELEGATION_QUERY))
  if(fromUrl){
    sessionStorage.setItem(FREE_DEMO_DELEGATION_STORAGE_KEY,fromUrl)
    return fromUrl
  }
  return clean(sessionStorage.getItem(FREE_DEMO_DELEGATION_STORAGE_KEY))
}

export function activeFreeDemoDelegationId(){
  if(typeof window==='undefined')return''
  if(!window.location.pathname.startsWith('/admin/free'))return''
  return captureFreeDemoDelegationFromLocation()
}

export function isFreeDemoDelegationActive(){
  return Boolean(activeFreeDemoDelegationId())
}

export function clearFreeDemoDelegation(){
  if(typeof window==='undefined')return
  sessionStorage.removeItem(FREE_DEMO_DELEGATION_STORAGE_KEY)
}

export function delegatedFreeDemoHeaders(path:string):Record<string,string>{
  const normalized=path.startsWith('/')?path:'/'+path
  const delegatedProfileRoute=normalized==='/profile/gallery/upload'
  if(!normalized.startsWith('/me')&&!delegatedProfileRoute)return{}
  const id=activeFreeDemoDelegationId()
  return id?{'X-Kawvo-Free-Demo-Id':id}:{}
}
