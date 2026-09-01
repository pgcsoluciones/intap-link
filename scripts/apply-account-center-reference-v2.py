#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
path = ROOT / 'app/src/components/admin/free/FreeDashboard.tsx'
text = path.read_text()
old = '''            <button type="button" onClick={() => navigate('/admin/free/account')} aria-label="Mi cuenta" title="Mi cuenta" className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-lg font-black text-slate-600 shadow-sm transition hover:bg-slate-50">◎</button>'''
new = '''            <button type="button" onClick={() => navigate('/admin/free/account')} aria-label="Mi cuenta" className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 shadow-sm transition hover:bg-slate-50">Mi cuenta</button>'''
if old in text:
    text = text.replace(old, new, 1)
elif new not in text:
    raise SystemExit('No encontré el acceso actual de Mi cuenta en la barra superior')
path.write_text(text)
print('✓ Barra superior: Mi cuenta se muestra como texto junto a la campana')
