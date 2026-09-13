from pathlib import Path


def replace_once(path: str, old: str, new: str, label: str):
    p=Path(path); s=p.read_text();
    if old not in s: raise SystemExit(f'No encontré patrón: {label} en {path}')
    s=s.replace(old,new,1); p.write_text(s); print('✓',label)

# Dashboard tour copy
p=Path('app/src/components/admin/free/FreeGuidedTour.tsx')
s=p.read_text()
s=s.replace("title: 'Datos para recibir transferencias',\n    text: 'Si esta función está disponible en tu cuenta, aquí administras los datos bancarios que quieras mostrar a tus clientes.',","title: 'Facilita transferencias a tus clientes',\n    text: 'Aquí preparas tus cuentas para facilitar pagos por transferencia. Kawvo protege la privacidad ocultando datos sensibles cuando corresponde y tú compartes el acceso solo cuando lo necesitas.',")
s=s.replace("title: 'Avisos y tu cuenta',\n    text: 'En la parte superior encuentras tus notificaciones, la guía y el acceso a la configuración de tu cuenta.',","title: 'Avisos, recorrido y Mi cuenta',\n    text: 'En la parte superior encuentras tus notificaciones, el acceso al recorrido y Mi cuenta, donde están las configuraciones avanzadas y opciones personales.',")
s=s.replace('Guía Kawvo','Recorrido Kawvo')
p.write_text(s); print('✓ copy recorrido dashboard')

# Account integration
replace_once('app/src/components/admin/free/FreeAccount.tsx',"import FreeSupportPanel from './FreeSupportPanel'","import FreeSupportPanel from './FreeSupportPanel'\nimport FreeAccountGuidedTour from './FreeAccountGuidedTour'",'import tour Mi cuenta')
replace_once('app/src/components/admin/free/FreeAccount.tsx',"  danger?: boolean\n}","  danger?: boolean\n  tour?: string\n}",'tipo tour SettingsRow')
replace_once('app/src/components/admin/free/FreeAccount.tsx',"function SettingsRow({ icon, label, detail, badge, onClick, href, danger = false }: RowProps) {","function SettingsRow({ icon, label, detail, badge, onClick, href, danger = false, tour }: RowProps) {",'prop tour SettingsRow')
replace_once('app/src/components/admin/free/FreeAccount.tsx',"  if (href) return <a href={href} target=\"_blank\" rel=\"noreferrer\" className={className}>{content}</a>\n  return <button type=\"button\" onClick={onClick} className={className}>{content}</button>","  if (href) return <a href={href} target=\"_blank\" rel=\"noreferrer\" className={className} data-account-tour={tour}>{content}</a>\n  return <button type=\"button\" onClick={onClick} className={className} data-account-tour={tour}>{content}</button>",'data tour SettingsRow')
replace_once('app/src/components/admin/free/FreeAccount.tsx',"        : 'Crea y administra un equipo de trabajo'","        : 'Integra un grupo bajo un mismo perfil sin configurar uno por uno'",'copy Team account')
replace_once('app/src/components/admin/free/FreeAccount.tsx',"          <div className=\"flex items-center gap-3 pb-5\">\n            <button type=\"button\" onClick={() => navigate('/admin/free')} aria-label=\"Volver\" className=\"text-[34px] font-light leading-none text-slate-500\">←</button>\n            <h1 className=\"text-[32px] font-black tracking-[-0.045em] text-slate-950\">Mi cuenta</h1>\n          </div>","          <div className=\"flex items-center justify-between gap-3 pb-5\"><div className=\"flex items-center gap-3\"><button type=\"button\" onClick={() => navigate('/admin/free')} aria-label=\"Volver\" className=\"text-[34px] font-light leading-none text-slate-500\">←</button><h1 className=\"text-[32px] font-black tracking-[-0.045em] text-slate-950\">Mi cuenta</h1></div><button type=\"button\" onClick={() => window.dispatchEvent(new Event('kawvo:account-tour:start'))} className=\"rounded-full border border-cyan-200 bg-cyan-50 px-3 py-2 text-xs font-black text-cyan-700\">Recorrido</button></div>",'botón recorrido Mi cuenta')
replace_once('app/src/components/admin/free/FreeAccount.tsx',"          <div className=\"overflow-hidden rounded-[22px] bg-[#f5f5f5]\">\n            <div className=\"flex min-h-[92px] items-center gap-3 border-b border-slate-200 px-4 py-3\">","          <div className=\"overflow-hidden rounded-[22px] bg-[#f5f5f5]\">\n            <div data-account-tour=\"identity\" className=\"flex min-h-[92px] items-center gap-3 border-b border-slate-200 px-4 py-3\">",'target identidad cuenta')
replace_once('app/src/components/admin/free/FreeAccount.tsx',"            <SettingsRow icon={<span className=\"text-amber-500\"><UpgradeCrownIcon className=\"h-6 w-6\" /></span>} label=\"Mejora tu plan\" detail=\"Conoce el Plan Plus\" href={basicPlanWhatsAppUrl()} />","            <SettingsRow tour=\"plan\" icon={<span className=\"text-amber-500\"><UpgradeCrownIcon className=\"h-6 w-6\" /></span>} label=\"Mejora tu plan\" detail=\"Conoce el Plan Plus\" href={basicPlanWhatsAppUrl()} />",'target plan')
replace_once('app/src/components/admin/free/FreeAccount.tsx',"            <SettingsRow icon={<svg viewBox=\"0 0 24 24\" className=\"h-6 w-6\" fill=\"none\" stroke=\"currentColor\" strokeWidth=\"1.8\"><path d=\"M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9\"/><path d=\"M10 21h4\"/></svg>} label=\"Notificaciones\"","            <SettingsRow tour=\"notifications-ai\" icon={<svg viewBox=\"0 0 24 24\" className=\"h-6 w-6\" fill=\"none\" stroke=\"currentColor\" strokeWidth=\"1.8\"><path d=\"M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9\"/><path d=\"M10 21h4\"/></svg>} label=\"Notificaciones\"",'target notificaciones')
replace_once('app/src/components/admin/free/FreeAccount.tsx',"              <SettingsRow icon={<svg viewBox=\"0 0 24 24\" className=\"h-6 w-6\" fill=\"none\" stroke=\"currentColor\" strokeWidth=\"1.8\"><rect x=\"6\" y=\"2.5\" width=\"12\" height=\"19\" rx=\"2.5\"/><path d=\"M9 15l3 3 3-3M12 8v10\"/></svg>} label={pwaInstalled ? \"Kawvo está instalada\" : \"Instalar app Kawvo\"}","              <SettingsRow tour=\"products\" icon={<svg viewBox=\"0 0 24 24\" className=\"h-6 w-6\" fill=\"none\" stroke=\"currentColor\" strokeWidth=\"1.8\"><rect x=\"6\" y=\"2.5\" width=\"12\" height=\"19\" rx=\"2.5\"/><path d=\"M9 15l3 3 3-3M12 8v10\"/></svg>} label={pwaInstalled ? \"Kawvo está instalada\" : \"Instalar app Kawvo\"}",'target productos')
replace_once('app/src/components/admin/free/FreeAccount.tsx',"label=\"Team\" detail={teamDetail}","tour=\"team\" label={teamContext.role === 'none' ? 'Crear mi primer Team' : 'Team'} detail={teamDetail}",'CTA Team')
replace_once('app/src/components/admin/free/FreeAccount.tsx',"              <SettingsRow icon=\"▦\" label={qrBusy ? 'Generando QR…' : 'Descargar QR de mi perfil'}","              <SettingsRow tour=\"sharing\" icon=\"▦\" label={qrBusy ? 'Generando QR…' : 'Descargar QR de mi perfil'}",'target compartir')
replace_once('app/src/components/admin/free/FreeAccount.tsx',"            <div className=\"overflow-hidden rounded-[22px] bg-[#f5f5f5]\">\n              {resources.map","            <div data-account-tour=\"help\" className=\"overflow-hidden rounded-[22px] bg-[#f5f5f5]\">\n              {resources.map",'target ayuda')
# only next security occurrence after help
s=Path('app/src/components/admin/free/FreeAccount.tsx').read_text()
needle='<SectionTitle>CUENTA Y SEGURIDAD</SectionTitle>\n            <div className="overflow-hidden rounded-[22px] bg-[#f5f5f5]">'
if needle not in s: raise SystemExit('No encontré seguridad')
s=s.replace(needle,'<SectionTitle>CUENTA Y SEGURIDAD</SectionTitle>\n            <div data-account-tour="security" className="overflow-hidden rounded-[22px] bg-[#f5f5f5]">',1)
# mount tour before main closes via support panel anchor
anchor='      <FreeSupportPanel />'
if anchor not in s: raise SystemExit('No encontré FreeSupportPanel')
s=s.replace(anchor,"      <FreeAccountGuidedTour storageId={String(me?.slug || me?.email || 'free')} />\n"+anchor,1)
Path('app/src/components/admin/free/FreeAccount.tsx').write_text(s); print('✓ montaje recorrido Mi cuenta')

# Team integration
replace_once('app/src/components/admin/free/FreeTeamCorporate.tsx',"import { FreeBackButton } from './FreePanelUi'","import { FreeBackButton } from './FreePanelUi'\nimport FreeTeamGuidedTour from './FreeTeamGuidedTour'",'import tour Team')
replace_once('app/src/components/admin/free/FreeTeamCorporate.tsx',"    <div className=\"mt-3 flex flex-wrap items-end justify-between gap-3\"><div>","    <div data-team-tour=\"header\" className=\"mt-3 flex flex-wrap items-end justify-between gap-3\"><div>",'target header Team')
replace_once('app/src/components/admin/free/FreeTeamCorporate.tsx',"</p></div>{manage&&<div className=\"rounded-2xl border border-slate-200 bg-white px-4 py-3 text-right\"><p className=\"text-[10px] font-black uppercase tracking-wide text-slate-400\">Miembros</p><p className=\"text-2xl font-black\">{memberCount}</p></div>}</div>","</p></div><div className=\"flex items-center gap-2\"><button type=\"button\" onClick={()=>window.dispatchEvent(new Event('kawvo:team-tour:start'))} className=\"rounded-full border border-cyan-200 bg-cyan-50 px-3 py-2 text-xs font-black text-cyan-700\">Recorrido</button>{manage&&<div className=\"rounded-2xl border border-slate-200 bg-white px-4 py-3 text-right\"><p className=\"text-[10px] font-black uppercase tracking-wide text-slate-400\">Miembros</p><p className=\"text-2xl font-black\">{memberCount}</p></div>}</div></div>",'botón recorrido Team')
replace_once('app/src/components/admin/free/FreeTeamCorporate.tsx',"{manage&&<section className=\"mt-5 rounded-[24px] border border-cyan-200 bg-cyan-50 p-4\">","{manage&&<section data-team-tour=\"role\" className=\"mt-5 rounded-[24px] border border-cyan-200 bg-cyan-50 p-4\">",'target rol Team')
replace_once('app/src/components/admin/free/FreeTeamCorporate.tsx',"{isMaster&&<section className=\"mt-6 rounded-[28px] border border-cyan-200 bg-white p-5 shadow-sm\"><p className=\"text-[11px] font-black uppercase tracking-[0.15em] text-cyan-700\">Organización</p>","{isMaster&&<section data-team-tour=\"team-name\" className=\"mt-6 rounded-[28px] border border-cyan-200 bg-white p-5 shadow-sm\"><p className=\"text-[11px] font-black uppercase tracking-[0.15em] text-cyan-700\">Organización</p>",'target nombre Team')
replace_once('app/src/components/admin/free/FreeTeamCorporate.tsx',"{isMaster&&<section className=\"mt-6 rounded-[28px] border border-violet-200 bg-white p-5 shadow-sm\"><p className=\"text-[11px] font-black uppercase tracking-[0.15em] text-violet-700\">Identidad pública</p>","{isMaster&&<section data-team-tour=\"company\" className=\"mt-6 rounded-[28px] border border-violet-200 bg-white p-5 shadow-sm\"><p className=\"text-[11px] font-black uppercase tracking-[0.15em] text-violet-700\">Identidad pública</p>",'target empresa Team')
# permissions/codes combined section
replace_once('app/src/components/admin/free/FreeTeamCorporate.tsx',"{isMaster&&<section className=\"mt-6 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm\"><div className=\"flex flex-wrap items-end justify-between gap-3\"><div><h2 className=\"text-xl font-black\">Generar códigos</h2>","{isMaster&&<section data-team-tour=\"permissions\" className=\"mt-6 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm\"><div className=\"flex flex-wrap items-end justify-between gap-3\"><div><h2 className=\"text-xl font-black\">Generar códigos</h2>",'target permisos Team')
s=Path('app/src/components/admin/free/FreeTeamCorporate.tsx').read_text()
s=s.replace("<p className=\"mt-3 text-xs text-slate-400\">Campos que podrán personalizarse: {selectedLabels.join(' · ')}</p>","<p className=\"mt-3 text-xs font-semibold text-slate-500\">Data variable definida por administración: {selectedLabels.join(' · ')}</p><p className=\"mt-2 text-xs leading-5 text-slate-400\">El Administrador Master decide qué campos cambian por miembro. La información corporativa compartida permanece centralizada.</p>",1)
s=s.replace("<button type=\"button\" onClick={()=>void createCodes()} disabled={busy||!canGenerate}","<button data-team-tour=\"codes\" type=\"button\" onClick={()=>void createCodes()} disabled={busy||!canGenerate}",1)
# assignments next section unique title
s=s.replace("{isMaster&&<section className=\"mt-6 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm\"><div className=\"flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between\"><div><h2 className=\"text-xl font-black\">Códigos y asignaciones</h2>","{isMaster&&<section data-team-tour=\"assignments\" className=\"mt-6 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm\"><div className=\"flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between\"><div><h2 className=\"text-xl font-black\">Códigos y asignaciones</h2>",1)
# members section via first manage&& section after assignments containing Miembros
idx=s.find("{manage&&<section",s.find('Códigos y asignaciones'))
if idx<0: raise SystemExit('No encontré sección miembros Team')
s=s[:idx]+s[idx:].replace('{manage&&<section className="mt-6','{manage&&<section data-team-tour="members" className="mt-6',1)
# mount before closing main
anchor='  </div></main>'
pos=s.rfind(anchor)
if pos<0: raise SystemExit('No encontré cierre Team')
s=s[:pos]+"    <FreeTeamGuidedTour storageId={String(manage?.team?.id || basic?.team?.id || 'team')} firstTeam={Boolean(isMaster && memberCount === 0)} />\n"+s[pos:]
Path('app/src/components/admin/free/FreeTeamCorporate.tsx').write_text(s); print('✓ integración recorrido Team')

print('✓ PATCH V2 COMPLETO')
