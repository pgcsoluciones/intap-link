from pathlib import Path

FILES = {
    'admin': Path('app/src/components/admin/free/FreeServices.tsx'),
    'types': Path('web/src/components/free-profile/IntapLinkGratis.types.ts'),
    'adapter': Path('web/src/components/free-profile/IntapLinkGratis.adapter.ts'),
    'profile': Path('web/src/components/free-profile/IntapLinkGratisProfile.tsx'),
    'enhancements': Path('web/src/components/free-profile/IntapLinkGratisPublicEnhancements.css'),
}

for path in FILES.values():
    if not path.exists():
        raise SystemExit(f'Missing expected file: {path}')

# -----------------------------------------------------------------------------
# ADMIN: editable services section headline + general description.
# Keeps max 3 services and existing individual service limits.
# -----------------------------------------------------------------------------
path = FILES['admin']
text = path.read_text()

text = text.replace(
    "const SERVICE_TITLES = ['Servicios', 'Qué hacemos', 'Lo que ofrezco'] as const\n",
    "const SERVICE_TITLE_LIMIT = 60\nconst SECTION_DESCRIPTION_LIMIT = 240\nconst SERVICE_TITLE_SUGGESTIONS = ['Servicios', 'Qué hacemos', 'Lo que ofrezco'] as const\n",
    1,
)

text = text.replace(
    "  const [sectionTitle, setSectionTitle] = useState<(typeof SERVICE_TITLES)[number]>('Servicios')\n",
    "  const [sectionTitle, setSectionTitle] = useState('Servicios')\n  const [sectionDescription, setSectionDescription] = useState('')\n  const [savingSection, setSavingSection] = useState(false)\n",
    1,
)

old_load = """      const saved = String(td.services_section_title || 'Servicios') as (typeof SERVICE_TITLES)[number]\n      setSectionTitle(SERVICE_TITLES.includes(saved) ? saved : 'Servicios')\n"""
new_load = """      const saved = String(td.services_section_title || 'Servicios').trim().slice(0, SERVICE_TITLE_LIMIT)\n      setSectionTitle(saved || 'Servicios')\n      setSectionDescription(String(td.services_section_description || '').trim().slice(0, SECTION_DESCRIPTION_LIMIT))\n"""
if old_load not in text:
    raise SystemExit('Admin load block not found')
text = text.replace(old_load, new_load, 1)

start = text.find("  const saveSectionTitle = async")
end = text.find("\n\n  const add = async", start)
if start == -1 or end == -1:
    raise SystemExit('Admin saveSectionTitle block not found')
new_save = """  const saveSectionContent = async (nextTitle = sectionTitle, nextDescription = sectionDescription) => {\n    if (savingSection) return\n    const cleanTitle = nextTitle.trim().slice(0, SERVICE_TITLE_LIMIT) || 'Servicios'\n    const cleanDescription = nextDescription.trim().slice(0, SECTION_DESCRIPTION_LIMIT)\n    setSectionTitle(cleanTitle)\n    setSectionDescription(cleanDescription)\n    setSavingSection(true)\n    setError('')\n    const nextTemplate = {\n      ...templateData,\n      services_section_title: cleanTitle,\n      services_section_description: cleanDescription,\n    }\n    setTemplateData(nextTemplate)\n    try {\n      const json: any = await apiPut('/me/profile', { template_data: nextTemplate })\n      if (!json.ok) setError(json.error || 'No se pudo guardar la presentación de Servicios.')\n    } finally {\n      setSavingSection(false)\n    }\n  }\n"""
text = text[:start] + new_save + text[end:]

old_section = """        <section className=\"mt-5 rounded-[22px] border border-slate-200 bg-white p-4\">\n          <p className=\"text-xs font-black text-slate-700\">Título visible de la sección</p>\n          <div className=\"mt-3 grid grid-cols-3 gap-2\">\n            {SERVICE_TITLES.map((option) => (\n              <button key={option} type=\"button\" onClick={() => void saveSectionTitle(option)} className={`rounded-xl px-2 py-2.5 text-[11px] font-black ${sectionTitle === option ? 'bg-cyan-600 text-white' : 'bg-slate-50 text-slate-600'}`}>{option}</button>\n            ))}\n          </div>\n        </section>\n"""
new_section = """        <section className=\"mt-5 rounded-[22px] border border-slate-200 bg-white p-4\">\n          <p className=\"text-xs font-black text-slate-700\">Presentación de la sección</p>\n          <p className=\"mt-1 text-xs leading-5 text-slate-400\">En el perfil se mostrará “Nuestros servicios”, seguido de este título y una descripción general de hasta 4 líneas.</p>\n\n          <label className=\"mt-4 block text-[11px] font-black uppercase tracking-[0.12em] text-slate-400\">Título principal</label>\n          <input\n            value={sectionTitle}\n            onChange={(event) => setSectionTitle(event.target.value.slice(0, SERVICE_TITLE_LIMIT))}\n            onBlur={() => void saveSectionContent()}\n            maxLength={SERVICE_TITLE_LIMIT}\n            placeholder=\"Ej. Soluciones industriales\"\n            className=\"mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:border-cyan-400\"\n          />\n          <div className=\"mt-2 flex flex-wrap gap-2\">\n            {SERVICE_TITLE_SUGGESTIONS.map((option) => (\n              <button key={option} type=\"button\" onClick={() => { setSectionTitle(option); void saveSectionContent(option, sectionDescription) }} className=\"rounded-full bg-slate-50 px-3 py-1.5 text-[10px] font-black text-slate-500\">{option}</button>\n            ))}\n          </div>\n\n          <label className=\"mt-4 block text-[11px] font-black uppercase tracking-[0.12em] text-slate-400\">Descripción general</label>\n          <textarea\n            value={sectionDescription}\n            onChange={(event) => setSectionDescription(event.target.value.slice(0, SECTION_DESCRIPTION_LIMIT))}\n            onBlur={() => void saveSectionContent()}\n            maxLength={SECTION_DESCRIPTION_LIMIT}\n            rows={4}\n            placeholder=\"Describe de forma general qué tipo de soluciones o servicios ofreces.\"\n            className=\"mt-2 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-5 outline-none focus:border-cyan-400\"\n          />\n          <div className=\"mt-1 flex items-center justify-between text-[11px]\">\n            <span className=\"text-slate-400\">Hasta 4 líneas visibles en el perfil</span>\n            <span className=\"font-bold text-slate-500\">{sectionDescription.length}/{SECTION_DESCRIPTION_LIMIT}</span>\n          </div>\n          <button type=\"button\" disabled={savingSection} onClick={() => void saveSectionContent()} className=\"mt-3 w-full rounded-xl bg-cyan-600 px-3 py-2.5 text-xs font-black text-white disabled:opacity-40\">{savingSection ? 'Guardando…' : 'Guardar presentación'}</button>\n        </section>\n"""
if old_section not in text:
    raise SystemExit('Admin section editor block not found')
text = text.replace(old_section, new_section, 1)
path.write_text(text)

# -----------------------------------------------------------------------------
# WEB TYPES: section description.
# -----------------------------------------------------------------------------
path = FILES['types']
text = path.read_text()
anchor = "  servicesTitle: string\n"
if "servicesDescription: string" not in text:
    if anchor not in text:
        raise SystemExit('Types servicesTitle anchor not found')
    text = text.replace(anchor, anchor + "  servicesDescription: string\n", 1)
path.write_text(text)

# -----------------------------------------------------------------------------
# ADAPTER: free-form section title + general description from template_data.
# -----------------------------------------------------------------------------
path = FILES['adapter']
text = path.read_text()
text = text.replace("const SERVICES_TITLES = new Set(['Servicios', 'Qué hacemos', 'Lo que ofrezco'])\n", "", 1)
old = "      servicesTitle: allowedTitle(readString(templateData, 'services_section_title'), SERVICES_TITLES, 'Servicios'),\n"
new = "      servicesTitle: readString(templateData, 'services_section_title').slice(0, 60) || 'Servicios',\n      servicesDescription: readString(templateData, 'services_section_description').slice(0, 240),\n"
if old not in text:
    if "servicesDescription:" not in text:
        raise SystemExit('Adapter services title anchor not found')
else:
    text = text.replace(old, new, 1)
path.write_text(text)

# -----------------------------------------------------------------------------
# PUBLIC PROFILE: kicker + headline + 4-line general description, then 3 cards.
# Individual cards show 3-line description + current Ver detalles CTA.
# -----------------------------------------------------------------------------
path = FILES['profile']
text = path.read_text()
old = """          {services.length > 0 && (\n            <section className=\"ilx-section\">\n              <h2>{profile.servicesTitle}</h2>\n              <div className=\"ilx-services\" style={{ '--ilx-service-count': Math.max(1, services.length) } as CSSProperties}>\n                {services.map((service) => (\n                  <button key={service.id} type=\"button\" className=\"ilx-service\" onClick={() => setModal({ kind: 'service', item: service })}>\n                    <div className=\"ilx-service-media\">{service.image ? <img src={service.image} alt={service.title} loading=\"lazy\" decoding=\"async\" /> : <span>{serviceIcon(service.iconKey)}</span>}</div>\n                    <div className=\"ilx-service-copy\"><h3>{service.title}</h3></div>\n                  </button>\n                ))}\n              </div>\n            </section>\n          )}\n"""
new = """          {services.length > 0 && (\n            <section className=\"ilx-section ilx-services-section\">\n              <div className=\"ilx-services-heading\">\n                <span className=\"ilx-services-kicker\">Nuestros servicios</span>\n                <h2>{profile.servicesTitle}</h2>\n                {profile.servicesDescription && <p>{profile.servicesDescription}</p>}\n              </div>\n              <div className=\"ilx-services\" style={{ '--ilx-service-count': Math.max(1, services.length) } as CSSProperties}>\n                {services.map((service) => (\n                  <button key={service.id} type=\"button\" className=\"ilx-service\" onClick={() => setModal({ kind: 'service', item: service })}>\n                    <div className=\"ilx-service-media\">{service.image ? <img src={service.image} alt={service.title} loading=\"lazy\" decoding=\"async\" /> : <span>{serviceIcon(service.iconKey)}</span>}</div>\n                    <div className=\"ilx-service-copy\">\n                      <h3>{service.title}</h3>\n                      <p>{service.description}</p>\n                      <span className=\"ilx-service-more\">Ver detalles</span>\n                    </div>\n                  </button>\n                ))}\n              </div>\n            </section>\n          )}\n"""
if old not in text:
    if 'ilx-services-heading' not in text:
        raise SystemExit('Public services block not found')
else:
    text = text.replace(old, new, 1)
path.write_text(text)

# -----------------------------------------------------------------------------
# PUBLIC CSS: final override after existing compact service rules.
# Three cards stay side-by-side; description = 3 lines; section description = 4.
# -----------------------------------------------------------------------------
path = FILES['enhancements']
text = path.read_text()
marker = '/* INTAP LINK GRATIS · SERVICES SECTION V1 */'
if marker not in text:
    text += r'''

/* INTAP LINK GRATIS · SERVICES SECTION V1 */
.ilx-services-section {
  overflow: visible;
}

.ilx-services-heading {
  margin-bottom: 18px;
}

.ilx-services-kicker {
  display: block;
  margin-bottom: 7px;
  color: var(--ilx-accent);
  font-size: 12px;
  font-weight: 850;
  letter-spacing: .02em;
}

.ilx-services-heading h2 {
  margin: 0;
}

.ilx-services-heading > p {
  display: -webkit-box;
  margin: 10px 0 0;
  overflow: hidden;
  color: var(--ilx-muted);
  font-size: 14px;
  line-height: 1.55;
  -webkit-line-clamp: 4;
  -webkit-box-orient: vertical;
}

.ilx-services {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  align-items: stretch;
  gap: 8px;
}

.ilx-service {
  width: 100%;
  max-width: none;
  min-width: 0;
  min-height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-radius: 16px;
  text-align: left;
}

.ilx-service-media {
  width: 100%;
  min-height: 0;
  aspect-ratio: 1 / 1;
}

.ilx-service-copy {
  width: 100%;
  min-height: 0;
  flex: 1;
  padding: 11px 9px 10px;
  align-items: stretch;
  justify-content: flex-start;
  text-align: left;
}

.ilx-service-copy h3 {
  display: -webkit-box;
  min-height: 2.5em;
  overflow: hidden;
  color: var(--ilx-text);
  font-size: 12px;
  font-weight: 800;
  line-height: 1.25;
  text-align: left;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.ilx-service-copy p {
  display: -webkit-box;
  min-height: 4.35em;
  margin: 7px 0 10px;
  overflow: hidden;
  color: var(--ilx-muted);
  font-size: 10.5px;
  line-height: 1.45;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
}

.ilx-service-more {
  min-height: 34px;
  margin-top: auto;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--ilx-primary);
  border-radius: 999px;
  color: var(--ilx-primary);
  font-size: 10.5px;
  font-weight: 800;
  text-align: center;
}

.ilx-service:hover .ilx-service-more {
  background: var(--ilx-primary);
  color: #fff;
}

@media (max-width: 560px) {
  .ilx-services-heading {
    margin-bottom: 16px;
  }

  .ilx-services-heading > p {
    font-size: 13.5px;
    line-height: 1.5;
  }

  .ilx-services {
    gap: 7px;
  }

  .ilx-service {
    border-radius: 14px;
  }

  .ilx-service-copy {
    padding: 10px 7px 9px;
  }

  .ilx-service-copy h3 {
    font-size: 11px;
  }

  .ilx-service-copy p {
    font-size: 10px;
  }

  .ilx-service-more {
    min-height: 32px;
    padding-inline: 4px;
    font-size: 10px;
  }
}
'''
path.write_text(text)

print('Applied services section presentation + 3-card public layout.')
