from pathlib import Path
import re

branch_files = {
    'profile': Path('web/src/components/free-profile/IntapLinkGratisProfile.tsx'),
    'rebuilt': Path('web/src/components/free-profile/IntapLinkGratisRebuilt.css'),
    'enhancements': Path('web/src/components/free-profile/IntapLinkGratisPublicEnhancements.css'),
    'dashboard': Path('app/src/components/admin/free/FreeDashboard.tsx'),
}

for path in branch_files.values():
    if not path.exists():
        raise SystemExit(f'Missing expected file: {path}')

# 1) Public watermark copy. Tolerate a previous partial run.
path = branch_files['profile']
text = path.read_text()
old_copy = '<a href="/">Crea tu perfil gratis con <strong>INTAP Link</strong></a>'
new_copy = '<a href="/">Creado con <strong>INTAP Link</strong> · Crea el tuyo gratis</a>'
if old_copy in text:
    text = text.replace(old_copy, new_copy, 1)
elif new_copy not in text:
    raise SystemExit('Expected public watermark copy not found')
path.write_text(text)

# 2) More separation before Save contact. Match the current selector regardless of min-height.
path = branch_files['enhancements']
text = path.read_text()
pattern = r'(\.ilx-save-contact\s*\{.*?\bmin-height:\s*\d+px;\s*)margin:\s*(?:0|\d+px)\s+0\s+4px;'
replacement = r'\1margin: 16px 0 4px;'
updated, count = re.subn(pattern, replacement, text, count=1, flags=re.S)
if count == 0:
    if 'margin: 16px 0 4px;' not in text:
        raise SystemExit('Expected save-contact block not found')
else:
    text = updated
path.write_text(text)

# 3) Larger public watermark typography. Tolerate already-updated footer.
path = branch_files['rebuilt']
text = path.read_text()
old_footer = '''.ilx-footer {
  padding: 22px 0 8px;

  text-align: center;

  color:
    var(--ilx-muted);

  font-size: 10px;
}'''
new_footer = '''.ilx-footer {
  padding: 24px 0 8px;

  text-align: center;

  color:
    var(--ilx-muted);

  font-size: 13px;
  line-height: 1.45;
}

.ilx-footer > a:first-child {
  font-weight: 650;
}

.ilx-footer > a:first-child strong {
  color: var(--ilx-primary);
  font-weight: 850;
}'''
if old_footer in text:
    text = text.replace(old_footer, new_footer, 1)
elif '.ilx-footer > a:first-child strong {' not in text:
    raise SystemExit('Expected footer block not found')
path.write_text(text)

# 4) Free dashboard watermark upsell selector + banner. Tolerate reruns.
path = branch_files['dashboard']
text = path.read_text()
old_import = "import { FreeUpgradeCard } from './FreePanelUi'"
new_import = "import { FreeUpgradeCard, basicPlanWhatsAppUrl } from './FreePanelUi'"
if old_import in text:
    text = text.replace(old_import, new_import, 1)
elif new_import not in text:
    raise SystemExit('Expected FreePanelUi import not found')

old_state = "  const [hasSuperAdminAccess, setHasSuperAdminAccess] = useState(false)"
new_state = old_state + "\n  const [watermarkUpsellOpen, setWatermarkUpsellOpen] = useState(false)"
if 'watermarkUpsellOpen' not in text:
    if old_state not in text:
        raise SystemExit('Expected dashboard state anchor not found')
    text = text.replace(old_state, new_state, 1)

if 'Quitar marca de agua' not in text:
    anchor = '''        </article>

        {hasSuperAdminAccess && ('''
    insert = '''        </article>

        <section className="overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-sm">
          <button
            type="button"
            onClick={() => setWatermarkUpsellOpen((current) => !current)}
            className="flex w-full items-center justify-between gap-4 p-4 text-left"
            aria-expanded={watermarkUpsellOpen}
          >
            <span className="min-w-0">
              <span className="block text-sm font-black text-slate-900">Quitar marca de agua</span>
              <span className="mt-0.5 block text-xs font-semibold text-slate-400">Disponible en Plan Básico</span>
            </span>
            <span
              aria-hidden="true"
              className={`relative h-7 w-12 shrink-0 rounded-full transition ${watermarkUpsellOpen ? 'bg-violet-600' : 'bg-slate-200'}`}
            >
              <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition ${watermarkUpsellOpen ? 'left-6' : 'left-1'}`} />
            </span>
          </button>

          {watermarkUpsellOpen && (
            <div className="border-t border-violet-100 bg-violet-50/70 p-4">
              <p className="text-sm font-black text-slate-900">Haz tu perfil más tuyo</p>
              <p className="mt-1 text-xs leading-5 text-slate-600">Puedes quitar la marca de agua y disfrutar otros beneficios. Pásate al Plan Básico.</p>
              <a
                href={basicPlanWhatsAppUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex min-h-10 items-center justify-center rounded-xl bg-white px-3.5 py-2 text-xs font-black text-violet-700 shadow-sm"
              >
                Conocer Plan Básico
              </a>
            </div>
          )}
        </section>

        {hasSuperAdminAccess && ('''
    if anchor not in text:
        raise SystemExit('Expected insertion anchor not found')
    text = text.replace(anchor, insert, 1)

path.write_text(text)

print('Applied public watermark CTA, spacing, and Free panel watermark upsell selector.')
