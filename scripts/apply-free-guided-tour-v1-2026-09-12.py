#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PATH = ROOT / 'app/src/components/admin/free/FreeDashboard.tsx'
text = PATH.read_text(encoding='utf-8')


def replace_once(old: str, new: str, label: str) -> None:
    global text
    if new in text:
        print(f'✓ {label}: ya aplicado')
        return
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'✗ {label}: esperaba 1 coincidencia y encontré {count}')
    text = text.replace(old, new, 1)
    print(f'✓ {label}')


replace_once(
    "import FreeNotificationBell from './FreeNotificationBell'\n",
    "import FreeNotificationBell from './FreeNotificationBell'\nimport FreeGuidedTour from './FreeGuidedTour'\n",
    'import recorrido guiado',
)

replace_once(
    "<div className=\"flex items-center gap-2\"><FreeNotificationBell />",
    "<div data-tour=\"header-actions\" className=\"flex items-center gap-2\"><FreeNotificationBell /><button type=\"button\" onClick={() => window.dispatchEvent(new Event('kawvo:free-tour:start'))} className=\"rounded-full border border-cyan-200 bg-cyan-50 px-3 py-2 text-xs font-black text-cyan-700 shadow-sm\" aria-label=\"Abrir recorrido guiado\">Guía</button>",
    'grupo avisos/cuenta + botón Guía',
)

replace_once(
    "<div className=\"flex items-center gap-4\"><div className=\"relative shrink-0\">",
    "<div data-tour=\"profile-summary\" className=\"flex items-center gap-4\"><div className=\"relative shrink-0\">",
    'resumen de perfil señalado',
)

replace_once(
    "<button type=\"button\" onClick={() => navigate('/admin/free/onboarding/identity?from=panel')} className=\"mt-5 flex w-full items-center justify-between rounded-2xl border-2 border-cyan-300 bg-cyan-50 px-4 py-4 text-left shadow-sm\">",
    "<button data-tour=\"profile-required\" type=\"button\" onClick={() => navigate('/admin/free/onboarding/identity?from=panel')} className=\"mt-5 flex w-full items-center justify-between rounded-2xl border-2 border-cyan-300 bg-cyan-50 px-4 py-4 text-left shadow-sm\">",
    'datos indispensables señalados',
)

replace_once(
    "'estos 4 datos esenciales'",
    "'estos 5 datos esenciales'",
    'copy de cinco datos esenciales',
)

replace_once(
    "<div className=\"mt-3 flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3\">",
    "<div data-tour=\"publication\" className=\"mt-3 flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3\">",
    'publicación señalada',
)

preview_old = """          {me?.slug ? <a href={`/api/v1/me/free/profile-preview/${encodeURIComponent(me.slug)}?full=1`} target=\"_blank\" rel=\"noopener noreferrer\" className=\"mt-2 flex w-full items-center justify-center rounded-2xl border border-cyan-200 bg-white px-4 py-3 text-sm font-black text-cyan-700\">Ver vista previa</a> : <button type=\"button\" disabled className=\"mt-2 w-full rounded-2xl bg-slate-100 px-4 py-3 text-sm font-black text-slate-400\">Ver vista previa</button>}
          <button type=\"button\" disabled={!designEditable} onClick={() => navigate('/admin/free/editor')} className=\"mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-600 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400\">Diseño, plantilla y colores</button>"""
preview_new = """          <div data-tour=\"preview-design\">
            {me?.slug ? <a href={`/api/v1/me/free/profile-preview/${encodeURIComponent(me.slug)}?full=1`} target=\"_blank\" rel=\"noopener noreferrer\" className=\"mt-2 flex w-full items-center justify-center rounded-2xl border border-cyan-200 bg-white px-4 py-3 text-sm font-black text-cyan-700\">Ver vista previa</a> : <button type=\"button\" disabled className=\"mt-2 w-full rounded-2xl bg-slate-100 px-4 py-3 text-sm font-black text-slate-400\">Ver vista previa</button>}
            <button type=\"button\" disabled={!designEditable} onClick={() => navigate('/admin/free/editor')} className=\"mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-600 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400\">Diseño, plantilla y colores</button>
          </div>"""
replace_once(preview_old, preview_new, 'grupo vista previa/diseño señalado')

replace_once(
    "<div className=\"grid grid-cols-1 gap-3\">{freeItems.map(renderEditItem)}</div>",
    "<div data-tour=\"content-tools\" className=\"grid grid-cols-1 gap-3\">{freeItems.map(renderEditItem)}</div>",
    'herramientas de contenido señaladas',
)

replace_once(
    "{publicUrl && <article className=\"rounded-[24px] border border-slate-200 bg-white p-5\">",
    "{publicUrl && <article data-tour=\"public-link\" className=\"rounded-[24px] border border-slate-200 bg-white p-5\">",
    'enlace público señalado',
)

replace_once(
    "<article className={`rounded-[24px] border p-5 ${bankSummary.allowed ? 'border-emerald-200 bg-emerald-50/50' : 'border-slate-200 bg-white'}`}>",
    "<article data-tour=\"bank-accounts\" className={`rounded-[24px] border p-5 ${bankSummary.allowed ? 'border-emerald-200 bg-emerald-50/50' : 'border-slate-200 bg-white'}`}>",
    'cuentas bancarias señaladas',
)

replace_once(
    "{!isTeamMember && <button type=\"button\" disabled={!baseReady} onClick={() => navigate('/admin/free/ai-profile')} className=\"flex w-full items-center gap-3 rounded-[22px] border border-cyan-200 bg-gradient-to-br from-white to-cyan-50 p-4 text-left shadow-sm disabled:opacity-50\">",
    "{!isTeamMember && <button data-tour=\"ai-helper\" type=\"button\" disabled={!baseReady} onClick={() => navigate('/admin/free/ai-profile')} className=\"flex w-full items-center gap-3 rounded-[22px] border border-cyan-200 bg-gradient-to-br from-white to-cyan-50 p-4 text-left shadow-sm disabled:opacity-50\">",
    'asistente IA señalado',
)

replace_once(
    "{!isTeamMember && <section className=\"overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-sm\">",
    "{!isTeamMember && <section data-tour=\"watermark\" className=\"overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-sm\">",
    'opción de marca de agua señalada',
)

replace_once(
    "    </main>\n  </>\n}",
    "      <FreeGuidedTour storageId={String(me?.profile_id || me?.email || 'free')} />\n    </main>\n  </>\n}",
    'montaje del recorrido guiado',
)

PATH.write_text(text, encoding='utf-8')
print('✓ integración del recorrido guiado completada sin tocar lógica de negocio')
