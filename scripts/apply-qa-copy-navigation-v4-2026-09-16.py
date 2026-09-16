#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def replace_once(path: str, old: str, new: str, label: str):
    p = ROOT / path
    text = p.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'✗ {label}: esperaba 1 coincidencia y encontré {count}')
    p.write_text(text.replace(old, new, 1))
    print(f'✓ {label}')

# Copy + jerarquía visual en los tres recorridos.
for path in [
    'app/src/components/admin/free/FreeGuidedTour.tsx',
    'app/src/components/admin/free/FreeAccountGuidedTour.tsx',
    'app/src/components/admin/free/FreeTeamGuidedTour.tsx',
]:
    replace_once(
        path,
        'className="rounded-xl px-2 py-2 text-xs font-black text-slate-500">Ya entendí · no mostrar solo</button>',
        'className="rounded-xl px-2 py-2 text-sm font-black text-slate-700">Ya entendí <span className="block text-[11px] font-bold text-slate-400">(no volver a mostrar)</span></button>',
        f'copy Ya entendí en {Path(path).name}',
    )

# Notificaciones: conservar el origen para que Volver regrese al panel correcto.
path = 'app/src/components/admin/free/FreeNotifications.tsx'
replace_once(
    path,
    "import { useNavigate } from 'react-router-dom'",
    "import { useLocation, useNavigate } from 'react-router-dom'",
    'useLocation en Notificaciones',
)
replace_once(
    path,
    "  const navigate = useNavigate()\n",
    "  const navigate = useNavigate()\n  const location = useLocation()\n  const fromAccount = new URLSearchParams(location.search).get('from') === 'account'\n  const backPath = fromAccount ? '/admin/free/account' : '/admin/free'\n  const backLabel = fromAccount ? 'Regresar a Mi cuenta' : 'Regresar al panel principal'\n",
    'origen dinámico de Notificaciones',
)
replace_once(
    path,
    '<button type="button" onClick={() => navigate(\'/admin/free/account\')} aria-label="Regresar a Mi cuenta" className="text-[34px] font-light leading-none text-slate-500">←</button>',
    '<button type="button" onClick={() => navigate(backPath)} aria-label={backLabel} className="text-[34px] font-light leading-none text-slate-500">←</button>',
    'botón Volver dinámico en Notificaciones',
)
replace_once(
    path,
    '<p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">Mi cuenta</p>',
    '<p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">{fromAccount ? \'Mi cuenta\' : \'Panel principal\'}</p>',
    'contexto visual de Notificaciones',
)

print('✓ PATCH QA COPY + NAVEGACIÓN V4 COMPLETO')
