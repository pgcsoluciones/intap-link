from pathlib import Path


def replace_once(path: str, old: str, new: str, label: str):
    p = Path(path)
    s = p.read_text()
    if old not in s:
        raise SystemExit(f'✗ No encontré ancla: {label} en {path}')
    s = s.replace(old, new, 1)
    p.write_text(s)
    print(f'✓ {label}')

# 1) Branding global: el logo oficial remoto puede no existir en Preview.
# Conserva el logo oficial como primera opción y usa el ícono local como fallback.
brand = Path('app/src/kawvo-brand.ts')
s = brand.read_text()
old = """  logo.src = logoUrl(MARK_LOGO_PATH)\n  logo.alt = 'Kawvo'\n  applyScreenLogoSizing(logo)\n"""
new = """  logo.src = logoUrl(MARK_LOGO_PATH)\n  logo.alt = 'Kawvo'\n  logo.onerror = () => {\n    logo.onerror = null\n    logo.src = '/kawvo-icon.svg'\n    logo.dataset.kawvoBrandMark = '1'\n  }\n  applyScreenLogoSizing(logo)\n"""
if old not in s:
    raise SystemExit('✗ No encontré creación del logo Kawvo')
s = s.replace(old, new, 1)
old2 = """      image.src = logoUrl(MARK_LOGO_PATH)\n      applyScreenLogoSizing(image)\n      image.dataset.kawvoBrandMark = '1'\n"""
new2 = """      image.src = logoUrl(MARK_LOGO_PATH)\n      image.onerror = () => {\n        image.onerror = null\n        image.src = '/kawvo-icon.svg'\n      }\n      applyScreenLogoSizing(image)\n      image.dataset.kawvoBrandMark = '1'\n"""
if old2 not in s:
    raise SystemExit('✗ No encontré reemplazo legacy del logo Kawvo')
s = s.replace(old2, new2, 1)
brand.write_text(s)
print('✓ fallback local del logo Kawvo en paneles')

# 2) Dashboard Free: avatar optimizado en navegador antes de subir.
replace_once(
    'app/src/components/admin/free/FreeDashboard.tsx',
    "import { apiGet, apiPost, apiPut, apiUpload } from '../../../lib/api'\n",
    "import { apiGet, apiPost, apiPut, apiUpload } from '../../../lib/api'\nimport { optimizeImageBlobForUpload } from '../../../lib/imageUploadOptimization'\n",
    'import optimizador Dashboard',
)
replace_once(
    'app/src/components/admin/free/FreeDashboard.tsx',
    "      const form = new FormData(); form.append('file', blob, 'avatar.jpg')\n",
    "      const optimized = await optimizeImageBlobForUpload(blob, { maxDimension: 400, quality: 0.82, baseName: 'avatar' })\n      const form = new FormData(); form.append('file', optimized, optimized.name)\n",
    'avatar Dashboard optimizado',
)

# 3) Mi cuenta: mismo criterio.
replace_once(
    'app/src/components/admin/free/FreeAccount.tsx',
    "import { apiDelete, apiGet, apiPost, apiUpload } from '../../../lib/api'\n",
    "import { apiDelete, apiGet, apiPost, apiUpload } from '../../../lib/api'\nimport { optimizeImageBlobForUpload } from '../../../lib/imageUploadOptimization'\n",
    'import optimizador Mi cuenta',
)
replace_once(
    'app/src/components/admin/free/FreeAccount.tsx',
    "      const form = new FormData()\n      form.append('file', blob, 'avatar.jpg')\n",
    "      const optimized = await optimizeImageBlobForUpload(blob, { maxDimension: 400, quality: 0.82, baseName: 'avatar' })\n      const form = new FormData()\n      form.append('file', optimized, optimized.name)\n",
    'avatar Mi cuenta optimizado',
)

# 4) Identidad Free: avatar 400px y portada 1200px, ambos optimizados por navegador.
replace_once(
    'app/src/components/admin/free/onboarding/FreeOnboardingIdentity.tsx',
    "import { apiGet, apiPut, apiUpload } from '../../../../lib/api'\n",
    "import { apiGet, apiPut, apiUpload } from '../../../../lib/api'\nimport { optimizeImageBlobForUpload } from '../../../../lib/imageUploadOptimization'\n",
    'import optimizador Identidad',
)
replace_once(
    'app/src/components/admin/free/onboarding/FreeOnboardingIdentity.tsx',
    "      const form = new FormData()\n      form.append('file', blob, 'avatar.jpg')\n",
    "      const optimized = await optimizeImageBlobForUpload(blob, { maxDimension: 400, quality: 0.82, baseName: 'avatar' })\n      const form = new FormData()\n      form.append('file', optimized, optimized.name)\n",
    'avatar Identidad optimizado',
)
replace_once(
    'app/src/components/admin/free/onboarding/FreeOnboardingIdentity.tsx',
    "    try { const form=new FormData(); form.append('file',blob,'hero.jpg'); const result:any=await apiUpload('/me/profile/hero',form); if(result?.ok&&result.hero_url)setHeroUrl(result.hero_url); else setError(result?.error||'No pudimos subir la portada.') }\n",
    "    try { const optimized=await optimizeImageBlobForUpload(blob,{maxDimension:1200,quality:0.82,baseName:'hero'}); const form=new FormData(); form.append('file',optimized,optimized.name); const result:any=await apiUpload('/me/profile/hero',form); if(result?.ok&&result.hero_url)setHeroUrl(result.hero_url); else setError(result?.error||'No pudimos subir la portada.') }\n",
    'portada Identidad optimizada',
)

# 5) Team Assign: la foto recortada se vuelve a comprimir a formato eficiente antes de R2.
replace_once(
    'app/src/components/admin/free/FreeTeamAssign.tsx',
    "import { apiGet, apiPost, apiUpload } from '../../../lib/api'\n",
    "import { apiGet, apiPost, apiUpload } from '../../../lib/api'\nimport { optimizeImageBlobForUpload } from '../../../lib/imageUploadOptimization'\n",
    'import optimizador Team Assign',
)
replace_once(
    'app/src/components/admin/free/FreeTeamAssign.tsx',
    "      const form = new FormData()\n      form.append('file', photo, 'avatar.jpg')\n",
    "      const optimized = await optimizeImageBlobForUpload(photo, { maxDimension: 400, quality: 0.82, baseName: 'avatar' })\n      const form = new FormData()\n      form.append('file', optimized, optimized.name)\n",
    'foto Team Assign optimizada',
)

# 6) Team Member Edit.
replace_once(
    'app/src/components/admin/free/FreeTeamMemberEdit.tsx',
    "import { apiGet, apiPost, apiPut, apiUpload } from '../../../lib/api'\n",
    "import { apiGet, apiPost, apiPut, apiUpload } from '../../../lib/api'\nimport { optimizeImageBlobForUpload } from '../../../lib/imageUploadOptimization'\n",
    'import optimizador Team Member Edit',
)
replace_once(
    'app/src/components/admin/free/FreeTeamMemberEdit.tsx',
    "const form=new FormData();form.append('file',blob,'avatar.jpg');const json:any=await apiUpload(`/me/team/members/${member.id}/avatar`,form)",
    "const optimized=await optimizeImageBlobForUpload(blob,{maxDimension:400,quality:0.82,baseName:'avatar'});const form=new FormData();form.append('file',optimized,optimized.name);const json:any=await apiUpload(`/me/team/members/${member.id}/avatar`,form)",
    'foto Team Member Edit optimizada',
)

print('✓ PATCH V5 COMPLETO')
