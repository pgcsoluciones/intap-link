import { useEffect, useState, type FormEvent } from 'react'
import { apiGet, apiPost, INTAP_ACTIVE_TAB_STORAGE } from '../../lib/api'

type AccountItem={
  id:string;kind:'medical'|'medical_master'|'sponsor'|'sponsored'|'free'|'paid'|'trial'
  title:string;detail?:string;sponsor?:string;status?:string
}
type ActivationKind='product'|'sponsored'|'sponsor_master'|'medical'|'medical_master'|'trial'
const activationKinds:{value:ActivationKind;label:string;help:string;placeholder:string}[]=[
  {value:'product',label:'Kawvo Link · Free / Link / producto',help:'Código del producto físico; el sistema determina el plan correspondiente.',placeholder:'Código del producto'},
  {value:'sponsored',label:'Kawvo Link · Perfil patrocinado',help:'Código entregado por el patrocinador.',placeholder:'Código del producto patrocinado'},
  {value:'sponsor_master',label:'Kawvo Link · Master patrocinador',help:'Código Master de la empresa patrocinadora.',placeholder:'Código Master'},
  {value:'medical',label:'KawMed · Perfil médico (independiente o patrocinado)',help:'El prefijo MED identifica el acceso; el programa patrocinado se reconoce al validarlo.',placeholder:'MED-XXX-XXX'},
  {value:'medical_master',label:'KawMed · Master patrocinador',help:'Código de acceso al panel Master médico.',placeholder:'MEDM-XXX-XXX'},
  {value:'trial',label:'Kawvo Link · Trial',help:'El Trial actual se inicia con un token de invitación de 64 caracteres o mediante su flujo habitual. No utiliza un código físico.',placeholder:'Token de invitación Trial'}
]
const labels:Record<AccountItem['kind'],string>={
  medical:'KawMed · Perfil médico',medical_master:'KawMed · Master patrocinador',
  sponsor:'Kawvo Link · Patrocinador',sponsored:'Kawvo Link · Patrocinado',
  free:'Kawvo Link · Free',paid:'Kawvo Link · Link',trial:'Kawvo Link · Trial'
}

export default function IntapcardAccountSelector(){
  const[stage,setStage]=useState<'choice'|'new'|'existing'>('choice')
  const[activationKind,setActivationKind]=useState<ActivationKind>('product')
  const[activationCode,setActivationCode]=useState('')
  const[activationError,setActivationError]=useState('')
  const[checkingActivation,setCheckingActivation]=useState(false)
  const[items,setItems]=useState<AccountItem[]>([])
  const[loading,setLoading]=useState(true)
  const[busy,setBusy]=useState('')
  const[error,setError]=useState('')
  const[signingOut,setSigningOut]=useState(false)
  useEffect(()=>{if(stage!=='existing')return;let alive=true;setLoading(true);setError('');apiGet('/me/intapcard/accounts').then((r:any)=>{
    if(!alive)return
    if(!r?.ok)throw new Error(r?.error||'No se pudieron cargar las cuentas.')
    setItems(Array.isArray(r.data?.items)?r.data.items:[])
  }).catch((e:Error)=>{if(alive)setError(e.message)}).finally(()=>{if(alive)setLoading(false)})
  return()=>{alive=false}},[stage])

  async function beginActivation(e:FormEvent<HTMLFormElement>){
    e.preventDefault()
    setActivationError('')
    const code=activationCode.trim().toUpperCase()
    const med=/^MED-[A-Z2-9]{3}-[A-Z2-9]{3}$/
    const medMaster=/^MEDM-[A-Z2-9]{3}-[A-Z2-9]{3}$/
    const product=/^[A-Z2-9]{8,24}$/
    const trial=/^[A-F0-9]{64}$/
    let target=''
    if(activationKind==='medical'&&med.test(code))target='/claim/kawmed?code='+encodeURIComponent(code)
    if(activationKind==='medical_master'&&medMaster.test(code))target='/claim/kawmed-master?code='+encodeURIComponent(code)
    if(activationKind==='product'&&product.test(code))target='/activate-product/'+encodeURIComponent(code)
    if(activationKind==='sponsored'&&product.test(code))target='/admin/sponsored/entry?public_code='+encodeURIComponent(code)
    if(activationKind==='sponsor_master'&&product.test(code))target='/admin/sponsor/entry?public_code='+encodeURIComponent(code)
    if(activationKind==='trial'&&trial.test(code))target='/trial/activate?lead_token='+encodeURIComponent(code.toLowerCase())
    if(!target){
      setActivationError(activationKind==='trial'
        ?'Introduce el token de invitación Trial de 64 caracteres. Si no lo tienes, utiliza el flujo habitual de Trial.'
        :activationKind==='medical'?'El código médico debe tener formato MED-XXX-XXX.'
        :activationKind==='medical_master'?'El Master médico debe tener formato MEDM-XXX-XXX.'
        :'Introduce el código del producto (8 a 24 caracteres, sin espacios ni guiones).')
      return
    }
    // Free/Link usa profiles.user_id UNIQUE y Trial conserva su política de una
    // prueba por usuario. No permitir que «cuenta nueva» reabra una existente.
    if(activationKind==='product'||activationKind==='trial'){
      setCheckingActivation(true)
      try{
        const directory:any=await apiGet('/me/intapcard/accounts')
        if(!directory?.ok)throw new Error(directory?.error||'No pudimos verificar las cuentas existentes.')
        const accounts:Array<{kind:string}>=Array.isArray(directory.data?.items)?directory.data.items:[]
        if(activationKind==='product'&&accounts.some(account=>account.kind==='free'||account.kind==='paid')){
          setActivationError('Este correo ya tiene un perfil Free/Link. El activador clásico no permite crear otro perfil independiente con el mismo usuario. No hemos utilizado el código ni modificado la cuenta existente.')
          return
        }
        if(activationKind==='trial'&&accounts.some(account=>account.kind==='trial')){
          setActivationError('Este correo ya tiene un Trial. La política actual no permite iniciar otra prueba independiente. No hemos consumido el token.')
          return
        }
      }catch(error){
        setActivationError(error instanceof Error?error.message:'No pudimos verificar las cuentas existentes.')
        return
      }finally{setCheckingActivation(false)}
    }
    // Solo navegar: el endpoint canónico valida el código, cuenta, estado y consentimiento.
    window.location.assign(target)
  }

  async function choose(item:AccountItem){
    const key=item.kind+':'+item.id
    setBusy(key);setError('')
    try{
      // All categories share ONE active identity, bound to the current login
      // session in an HttpOnly cookie and checked against D1 ownership.
      const response:any=await apiPost('/me/intapcard/active-account',{kind:item.kind,id:item.id})
      if(!response?.ok)throw new Error(response?.error||'No pudimos seleccionar esta cuenta.')
      const token=String(response.data?.tab_token||'')
      if(!/^[a-f0-9]{32}$/.test(token))throw new Error('No se pudo activar la sesión exclusiva de esta cuenta.')
      sessionStorage.setItem(INTAP_ACTIVE_TAB_STORAGE,token)
      if(item.kind==='trial'){
        const host=window.location.hostname
        const origin=host==='app.preview.intaprd.com'?'https://preview.intaprd.com':'https://intaprd.com'
        window.location.assign(origin+'/trial/mi/'+encodeURIComponent(item.id))
      }else{
        window.location.assign(String(response.data?.route||'/admin/accounts'))
      }
    }catch(e){setError(e instanceof Error?e.message:'No se pudo seleccionar la cuenta.');setBusy('')}
  }

  async function signOut(){
    if(signingOut)return
    setSigningOut(true);setError('')
    try{
      const result:any=await apiPost('/auth/logout',{})
      if(!result?.ok)throw new Error(result?.error||'No se pudo cerrar la sesión.')
      sessionStorage.removeItem(INTAP_ACTIVE_TAB_STORAGE)
      window.location.replace('/admin/login')
    }catch(e){setError(e instanceof Error?e.message:'No se pudo cerrar la sesión.');setSigningOut(false)}
  }

  const activeKind=activationKinds.find(kind=>kind.value===activationKind)!
  return <main className="min-h-screen bg-slate-50 px-4 py-8 font-['Inter'] text-slate-950">
    <div className="mx-auto max-w-[1020px] space-y-5">
      <header className="rounded-[28px] border border-slate-200 bg-white p-6">
        <div className="flex justify-end"><button type="button" disabled={signingOut} onClick={()=>void signOut()} className="rounded-xl border border-rose-200 bg-white px-4 py-2 text-sm font-black text-rose-700 disabled:opacity-50">{signingOut?"Cerrando sesión…":"Cerrar sesión"}</button></div>
        <p className="text-xs font-black uppercase tracking-[.14em] text-cyan-700">Intapcard · Multicuenta</p>
        <h1 className="mt-2 text-3xl font-black">{stage==='choice'?'¿Qué deseas hacer?':stage==='new'?'Agregar una cuenta nueva':'Gestionar cuentas existentes'}</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">{stage==='choice'?'Puedes activar una cuenta nueva con su código o elegir una cuenta que ya esté vinculada a este correo.':stage==='new'?'Indica la categoría y su código. Continuarás por el proceso de activación normal, sin sustituir ninguna cuenta anterior.':'Estas son las cuentas asociadas a tu correo. Elige exactamente cuál deseas administrar.'}</p>
        {stage!=='choice'&&<button type="button" onClick={()=>{setStage('choice');setActivationError('');setError('')}} className="mt-4 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-black">← Volver a las opciones</button>}
      </header>

      {stage==='choice'&&<section className="grid gap-4 md:grid-cols-2" aria-label="Opciones de la cuenta multicuenta">
        <button type="button" onClick={()=>{setStage('new');setActivationError('')}} className="rounded-[26px] border border-cyan-200 bg-white p-6 text-left shadow-sm hover:border-cyan-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-600">
          <span className="text-xs font-black uppercase tracking-[.1em] text-cyan-700">Nueva cuenta</span>
          <h2 className="mt-2 text-2xl font-black">Agregar cuenta nueva</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">Ingresar un código e iniciar la activación correspondiente a la categoría elegida.</p>
        </button>
        <button type="button" onClick={()=>setStage('existing')} className="rounded-[26px] border border-slate-200 bg-white p-6 text-left shadow-sm hover:border-cyan-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-600">
          <span className="text-xs font-black uppercase tracking-[.1em] text-slate-500">Mis cuentas</span>
          <h2 className="mt-2 text-2xl font-black">Gestionar cuenta existente</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">Ver tus cuentas médicas, patrocinadas, Free y Trial para elegir una en particular.</p>
        </button>
      </section>}

      {stage==='new'&&<section className="rounded-[26px] border border-slate-200 bg-white p-6">
        <form onSubmit={beginActivation} className="mx-auto max-w-2xl space-y-4">
          <label className="block text-sm font-black text-slate-800">Tipo de cuenta que deseas activar
            <select className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold" value={activationKind} onChange={e=>{setActivationKind(e.target.value as ActivationKind);setActivationCode('');setActivationError('')}}>
              {activationKinds.map(kind=><option key={kind.value} value={kind.value}>{kind.label}</option>)}
            </select>
          </label>
          <p className="text-sm text-slate-600">{activeKind.help}</p>
          <label className="block text-sm font-black text-slate-800">Código de activación
            <input className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 font-mono text-base font-bold tracking-wide uppercase" value={activationCode} onChange={e=>{setActivationCode(e.target.value);setActivationError('')}} placeholder={activeKind.placeholder} autoComplete="off" required/>
          </label>
          {activationError&&<p role="alert" className="rounded-xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{activationError}</p>}
          <button type="submit" disabled={checkingActivation} className="w-full rounded-xl bg-slate-950 px-5 py-4 text-sm font-black text-white disabled:opacity-50">{checkingActivation?"Verificando cuenta…":"Continuar con la activación"}</button>
          {activationKind==='trial'&&<a href="/trial/login" className="block text-center text-sm font-bold text-cyan-800">Ir al acceso habitual de Trial</a>}
        </form>
      </section>}

      {stage==='existing'&&<>
        {loading&&<p role="status" className="rounded-2xl bg-white p-5 text-sm">Cargando cuentas…</p>}
        {error&&<p role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700">{error}</p>}
        {!loading&&!error&&items.length===0&&<p className="rounded-2xl border border-slate-200 bg-white p-5 text-sm">No existen cuentas registradas para este correo.</p>}
        <div className="grid gap-3 md:grid-cols-2">
          {items.map(item=><article key={item.kind+':'+item.id} className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-[11px] font-black uppercase tracking-[.1em] text-cyan-700">{labels[item.kind]}</p>
            <h2 className="mt-2 text-xl font-black">{item.title}</h2>
            {item.sponsor&&<p className="mt-1 text-sm font-semibold text-slate-600">{item.sponsor}</p>}
            {item.detail&&<p className="mt-2 break-all text-xs text-slate-500">{item.detail}</p>}
            {item.status&&<p className="mt-1 text-xs text-slate-500">Estado: {item.status}</p>}
            <button type="button" disabled={Boolean(busy)} onClick={()=>void choose(item)} className="mt-5 w-full rounded-xl bg-slate-950 px-4 py-3 text-sm font-black text-white disabled:opacity-50">
              {busy===item.kind+':'+item.id?'Abriendo…':'Administrar esta cuenta'}
            </button>
          </article>)}
        </div>
      </>}
    </div>
  </main>
}
