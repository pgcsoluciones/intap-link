from pathlib import Path

p = Path('app/src/components/admin/free/FreeTeamCorporate.tsx')
s = p.read_text(encoding='utf-8')
original = s

def ensure(old: str, new: str, label: str):
    global s
    if new in s:
        print(f'✓ {label} ya aplicado')
        return
    if old not in s:
        raise SystemExit(f'No encontré patrón para: {label}')
    s = s.replace(old, new, 1)
    print(f'✓ {label}')

ensure(
    '{isMaster&&<section className="mt-6 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-4"><div><p className="text-[11px] font-black uppercase tracking-[0.15em] text-cyan-700">Datos bancarios</p><h2 className="mt-1 text-xl font-black">Mostrar en perfiles de miembros</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Elige si los miembros del Team mostrarán las cuentas bancarias definidas por el Administrador Master.</p>',
    '{isMaster&&<section data-team-tour="banking" className="mt-6 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-4"><div><p className="text-[11px] font-black uppercase tracking-[0.15em] text-cyan-700">Datos bancarios</p><h2 className="mt-1 text-xl font-black">Cuentas bancarias del Team</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Como Administrador Master decides si las cuentas bancarias administradas por la empresa estarán disponibles en los perfiles vinculados. La información permanece bajo control de administración.</p>',
    'cuentas bancarias como función independiente',
)

ensure(
    '{isMaster&&<section data-team-tour="permissions" className="mt-6 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">',
    '{isMaster&&<section className="mt-6 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">',
    'quita target mezclado del bloque generador',
)

ensure(
    '<div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{PERMISSIONS.map(([key,label])=>{',
    '<div data-team-tour="variable-data" className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{PERMISSIONS.map(([key,label])=>{',
    'data variable como función independiente',
)

s = s.replace('Campos habilitados: {(row.permissions||[])', 'Data variable: {(row.permissions||[])')

if s != original:
    p.write_text(s, encoding='utf-8')
    print('✓ PATCH TEAM V4 COMPLETO')
else:
    print('✓ PATCH TEAM V4 YA ESTABA APLICADO')
