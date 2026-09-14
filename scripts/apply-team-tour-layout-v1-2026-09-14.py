from pathlib import Path

team = Path('app/src/components/admin/free/FreeTeamCorporate.tsx')
tour = Path('app/src/components/admin/free/FreeTeamGuidedTour.tsx')

s = team.read_text()
old = '''    <FreeBackButton onClick={()=>navigate('/admin/free/account')} />
    <div data-team-tour="header" className="mt-3 flex flex-wrap items-end justify-between gap-3"><div><p className="text-[11px] font-black uppercase tracking-[0.18em] text-cyan-600">KAWVO LINK · TEAM</p><h1 className="mt-1 text-3xl font-black">Equipo de trabajo</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">{isMaster?'Administra los perfiles y la configuración de tu equipo.':currentRole==='editor'?'Edita los perfiles del equipo dentro de los campos autorizados.':'Administra los perfiles según las funciones permitidas por tu rol.'}</p></div><div className="flex items-center gap-2"><button type="button" onClick={()=>window.dispatchEvent(new Event('kawvo:team-tour:start'))} className="rounded-full border border-cyan-200 bg-cyan-50 px-3 py-2 text-xs font-black text-cyan-700">Recorrido</button>{manage&&<div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-right"><p className="text-[10px] font-black uppercase tracking-wide text-slate-400">Miembros</p><p className="text-2xl font-black">{memberCount}</p></div>}</div></div>
'''
new = '''    <div data-team-tour="header" className="sticky top-0 z-30 -mx-5 border-b border-slate-200/80 bg-[#f7f9fc]/95 px-5 py-3 backdrop-blur">
      <div className="mx-auto flex w-full max-w-[980px] items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3"><FreeBackButton onClick={()=>navigate('/admin/free/account')} /><div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-600">KAWVO LINK · TEAM</p><h1 className="truncate text-xl font-black tracking-[-0.03em]">Equipo de trabajo</h1></div></div>
        <button type="button" onClick={()=>window.dispatchEvent(new Event('kawvo:team-tour:start'))} className="shrink-0 rounded-full border border-cyan-200 bg-cyan-50 px-3 py-2 text-xs font-black text-cyan-700 shadow-sm">Recorrido</button>
      </div>
    </div>
    <div className="mt-5 flex flex-wrap items-start justify-between gap-3"><p className="max-w-2xl text-sm leading-6 text-slate-500">{isMaster?'Administra los perfiles y la configuración de tu equipo.':currentRole==='editor'?'Edita los perfiles del equipo dentro de los campos autorizados.':'Administra los perfiles según las funciones permitidas por tu rol.'}</p>{manage&&<div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-right"><p className="text-[10px] font-black uppercase tracking-wide text-slate-400">Miembros</p><p className="text-2xl font-black">{memberCount}</p></div>}</div>
'''
if old not in s:
    raise SystemExit('No encontré el encabezado Team esperado')
s = s.replace(old, new, 1)
team.write_text(s)
print('✓ Recorrido Team movido a barra superior sticky')

s = tour.read_text()
old = """  const position=useCallback((i=index)=>{const el=document.querySelector(steps[i]?.target) as HTMLElement|null;if(!el)return;el.scrollIntoView({block:'center',inline:'nearest',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});window.setTimeout(()=>setRect(el.getBoundingClientRect()),220)},[index,steps])
"""
new = """  const TOP_CARD_STEPS=new Set(['team-name','company','banking','variable-data'])
  const position=useCallback((i=index)=>{const step=steps[i];const el=document.querySelector(step?.target) as HTMLElement|null;if(!el)return;const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;const behavior:ScrollBehavior=reduced?'auto':'smooth';if(TOP_CARD_STEPS.has(step.id)){el.scrollIntoView({block:'start',inline:'nearest',behavior});window.setTimeout(()=>{const r=el.getBoundingClientRect();const desiredTop=Math.min(330,Math.max(300,window.innerHeight*0.36));window.scrollBy({top:r.top-desiredTop,left:0,behavior});window.setTimeout(()=>setRect(el.getBoundingClientRect()),reduced?20:220)},reduced?20:180);return}el.scrollIntoView({block:'center',inline:'nearest',behavior});window.setTimeout(()=>setRect(el.getBoundingClientRect()),reduced?20:220)},[index,steps])
"""
if old not in s:
    raise SystemExit('No encontré position() esperado en tour Team')
s = s.replace(old, new, 1)
old2 = """  let top=16;if(safe){const below=safe.bottom+gap,above=safe.top-gap-cardHeight;top=below+cardHeight<=window.innerHeight-12?below:above>=12?above:clamp((window.innerHeight-cardHeight)/2,12,window.innerHeight-cardHeight-12)}
"""
new2 = """  const forceTopCard=TOP_CARD_STEPS.has(step.id)
  let top=16;if(forceTopCard){top=12}else if(safe){const below=safe.bottom+gap,above=safe.top-gap-cardHeight;top=below+cardHeight<=window.innerHeight-12?below:above>=12?above:clamp((window.innerHeight-cardHeight)/2,12,window.innerHeight-cardHeight-12)}
"""
if old2 not in s:
    raise SystemExit('No encontré cálculo top esperado en tour Team')
s = s.replace(old2, new2, 1)
tour.write_text(s)
print('✓ pasos Team 3–6 reservan zona propia para la tarjeta del recorrido')
print('✓ PATCH TEAM TOUR LAYOUT V1 COMPLETO')
