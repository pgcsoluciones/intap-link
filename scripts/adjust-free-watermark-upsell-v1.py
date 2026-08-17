from pathlib import Path

branch_files = {
    'profile': Path('web/src/components/free-profile/IntapLinkGratisProfile.tsx'),
    'rebuilt': Path('web/src/components/free-profile/IntapLinkGratisRebuilt.css'),
    'enhancements': Path('web/src/components/free-profile/IntapLinkGratisPublicEnhancements.css'),
    'dashboard': Path('app/src/components/admin/free/FreeDashboard.tsx'),
}

for key, path in branch_files.items():
    if not path.exists():
        raise SystemExit(f'Missing expected file: {path}')

# 1) Public watermark copy
path = branch_files['profile']
text = path.read_text()
old = '<a href="/">Crea tu perfil gratis con <strong>INTAP Link</strong></a>'
new = '<a href="/">Creado con <strong>INTAP Link</strong> · Crea el tuyo gratis</a>'
if old not in text:
    raise SystemExit('Expected public watermark copy not found')
text = text.replace(old, new, 1)
path.write_text(text)

# 2) More separation before Save contact
path = branch_files['enhancements']
text = path.read_text()
old = '''.ilx-save-contact {\n  width: 100%;\n  min-height: 54px;\n  margin: 0 0 4px;'''
if old not in text:
    # tolerate previous min-height if branch changed slightly
    old = '''.ilx-save-contact {\n  width: 100%;\n  min-height: 50px;\n  margin: 0 0 4px;'''
new = old.replace('margin: 0 0 4px;', 'margin: 16px 0 4px;')
if old not in text:
    raise SystemExit('Expected save-contact block not found')
text = text.replace(old, new, 1)
path.write_text(text)

# 3) Larger public watermark typography
path = branch_files['rebuilt']
text = path.read_text()
old = '''.ilx-footer {\n  padding: 22px 0 8px;\n\n  text-align: center;\n\n  color:\n    var(--ilx-muted);\n\n  font-size: 10px;\n}'''
new = '''.ilx-footer {\n  padding: 24px 0 8px;\n\n  text-align: center;\n\n  color:\n    var(--ilx-muted);\n\n  font-size: 13px;\n  line-height: 1.45;\n}\n\n.ilx-footer > a:first-child {\n  font-weight: 650;\n}\n\n.ilx-footer > a:first-child strong {\n  color: var(--ilx-primary);\n  font-weight: 850;\n}'''
if old not in text:
    raise SystemExit('Expected footer block not found')
text = text.replace(old, new, 1)
path.write_text(text)

# 4) Free dashboard watermark upsell selector + banner
path = branch_files['dashboard']
text = path.read_text()
old_import = "import { FreeUpgradeCard } from './FreePanelUi'"
new_import = "import { FreeUpgradeCard, basicPlanWhatsAppUrl } from './FreePanelUi'"
if old_import not in text:
    raise SystemExit('Expected FreePanelUi import not found')
text = text.replace(old_import, new_import, 1)

old_state = "  const [hasSuperAdminAccess, setHasSuperAdminAccess] = useState(false)"
new_state = old_state + "\n  const [watermarkUpsellOpen, setWatermarkUpsellOpen] = useState(false)"
if old_state not in text:
    raise SystemExit('Expected dashboard state anchor not found')
text = text.replace(old_state, new_state, 1)

anchor = '''        </article>\n\n        {hasSuperAdminAccess && ('''
insert = '''        </article>\n\n        <section className="overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-sm">\n          <button\n            type="button"\n            onClick={() => setWatermarkUpsellOpen((current) => !current)}\n            className="flex w-full items-center justify-between gap-4 p-4 text-left"\n            aria-expanded={watermarkUpsellOpen}\n          >\n            <span className="min-w-0">\n              <span className="block text-sm font-black text-slate-900">Quitar marca de agua</span>\n              <span className="mt-0.5 block text-xs font-semibold text-slate-400">Disponible en Plan Básico</span>\n            </span>\n            <span\n              aria-hidden="true"\n              className={`relative h-7 w-12 shrink-0 rounded-full transition ${watermarkUpsellOpen ? 'bg-violet-600' : 'bg-slate-200'}`}\n            >\n              <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition ${watermarkUpsellOpen ? 'left-6' : 'left-1'}`} />\n            </span>\n          </button>\n\n          {watermarkUpsellOpen && (\n            <div className="border-t border-violet-100 bg-violet-50/70 p-4">\n              <p className="text-sm font-black text-slate-900">Haz tu perfil más tuyo</p>\n              <p className="mt-1 text-xs leading-5 text-slate-600">Puedes quitar la marca de agua y disfrutar otros beneficios. Pásate al Plan Básico.</p>\n              <a\n                href={basicPlanWhatsAppUrl()}\n                target="_blank"\n                rel="noopener noreferrer"\n                className="mt-3 inline-flex min-h-10 items-center justify-center rounded-xl bg-white px-3.5 py-2 text-xs font-black text-violet-700 shadow-sm"\n              >\n                Conocer Plan Básico\n              </a>\n            </div>\n          )}\n        </section>\n\n        {hasSuperAdminAccess && ('''
if anchor not in text:
    raise SystemExit('Expected insertion anchor not found')
text = text.replace(anchor, insert, 1)
path.write_text(text)

print('Applied public watermark CTA, spacing, and Free panel watermark upsell selector.')
