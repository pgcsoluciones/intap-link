#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
BASE_SHA="e3d5b0d4e2445a3321e5a014519fa118b6213493"
LOG_DIR="/tmp/kawvo-team-contact-vcard-crop-v2-2026-09-09"

fail(){ echo; echo "✗ ERROR: $1"; exit 1; }
step(){ echo; echo "▶ $1"; }

cd "$ROOT" || fail "No existe $ROOT"
rm -rf "$LOG_DIR" && mkdir -p "$LOG_DIR"

echo "============================================================"
echo "KAWVO TEAM · CONTACTOS + VCARD + CROP · PRODUCCION · V2"
echo "============================================================"
echo "Incluye:"
echo "  1) Crop real al editar foto de miembro Team"
echo "  2) Teléfono y WhatsApp independientes"
echo "  3) Email de miembro funcional en perfil público"
echo "  4) Guardar contacto con teléfono, WhatsApp y email separados"
echo "No cambia todavía el diseño de las 3 cards de Servicios."
echo "============================================================"

step "git fetch github main"
git fetch github main
git merge-base --is-ancestor "$BASE_SHA" github/main || fail "main ya no contiene el baseline esperado"

step "git checkout main"
git checkout main
git reset --hard github/main
[[ -z "$(git status --porcelain)" ]] || fail "Working tree sucio antes de aplicar el lote"

step "Aplicar ajustes exactos"
python3 <<'PY'
from pathlib import Path

def replace_once(path, old, new):
    p=Path(path)
    s=p.read_text()
    if old not in s:
        raise SystemExit(f"Patrón no encontrado en {path}: {old[:100]!r}")
    if s.count(old)!=1:
        raise SystemExit(f"Patrón ambiguo en {path}: {s.count(old)} coincidencias")
    p.write_text(s.replace(old,new,1))

# 1) Crop en edición Team
path='app/src/components/admin/free/FreeTeamMemberEdit.tsx'
replace_once(path,
"import { FreeBackButton } from './FreePanelUi'",
"import { FreeBackButton } from './FreePanelUi'\nimport ImageCropModal from '../ImageCropModal'")
replace_once(path,
"const [member,setMember]=useState<Member|null>(null);const [loading,setLoading]=useState(true);const [saving,setSaving]=useState(false);const [uploading,setUploading]=useState(false);const [revoking,setRevoking]=useState(false);const [error,setError]=useState('');const [message,setMessage]=useState('')",
"const [member,setMember]=useState<Member|null>(null);const [loading,setLoading]=useState(true);const [saving,setSaving]=useState(false);const [uploading,setUploading]=useState(false);const [revoking,setRevoking]=useState(false);const [error,setError]=useState('');const [message,setMessage]=useState('');const [cropFile,setCropFile]=useState<File|null>(null)")
old_upload="const upload=async(event:React.ChangeEvent<HTMLInputElement>)=>{const file=event.target.files?.[0];if(inputRef.current)inputRef.current.value='';if(!file||!member||uploading||!canEdit('photo'))return;setUploading(true);setError('');setMessage('');const form=new FormData();form.append('file',file);const json:any=await apiUpload(`/me/team/members/${member.id}/avatar`,form).catch(()=>({ok:false}));setUploading(false);if(!json?.ok){setError(json?.error||'No pudimos actualizar la foto.');return}setMember({...member,avatar_url:json.avatar_url});setMessage('Foto del miembro actualizada.')}"
new_upload="const choosePhoto=(event:React.ChangeEvent<HTMLInputElement>)=>{const file=event.target.files?.[0];if(inputRef.current)inputRef.current.value='';if(!file||!member||uploading||!canEdit('photo'))return;setCropFile(file)}\n  const uploadCropped=async(blob:Blob)=>{if(!member||uploading||!canEdit('photo'))return;setCropFile(null);setUploading(true);setError('');setMessage('');const form=new FormData();form.append('file',blob,'avatar.jpg');const json:any=await apiUpload(`/me/team/members/${member.id}/avatar`,form).catch(()=>({ok:false}));setUploading(false);if(!json?.ok){setError(json?.error||'No pudimos actualizar la foto.');return}setMember({...member,avatar_url:json.avatar_url});setMessage('Foto del miembro actualizada.')}"
replace_once(path,old_upload,new_upload)
replace_once(path,"onChange={upload}/>","onChange={choosePhoto}/>")
replace_once(path,
"return <main className=\"min-h-screen bg-[#f7f9fc] font-['Inter'] text-slate-950\">",
"return <>{cropFile&&<ImageCropModal file={cropFile} aspectRatio={1} outputWidth={400} onSave={uploadCropped} onCancel={()=>setCropFile(null)}/>}<main className=\"min-h-screen bg-[#f7f9fc] font-['Inter'] text-slate-950\">")
replace_once(path,"</>}</div></main>\n}","</>}</div></main></>\n}")

# 2) Tipos públicos separados
path='web/src/components/free-profile/IntapLinkGratis.types.ts'
replace_once(path,
"  phone: string\n  whatsappGreetingName: string",
"  phone: string\n  whatsapp: string\n  email: string\n  whatsappGreetingName: string")

# 3) Adapter: phone / whatsapp / email independientes
path='web/src/components/free-profile/IntapLinkGratis.adapter.ts'
replace_once(path,
"function resolveQuickActions(data: UnknownRecord, phone: string, instagram: string, location: string): FreeProfileQuickAction[] {",
"function resolveQuickActions(data: UnknownRecord, phone: string, whatsapp: string, email: string, instagram: string, location: string): FreeProfileQuickAction[] {")
replace_once(path,
"    if (type === 'email') url = normalizeEmailUrl(storedUrl)",
"    if (type === 'email') url = email ? `mailto:${email}` : normalizeEmailUrl(storedUrl)")
replace_once(path,
"  const fallback: FreeProfileQuickAction[] = []\n  if (phone) fallback.push({ type: 'call', label: 'Llamar', url: `tel:+${phone}` })\n  if (instagram) fallback.push({ type: 'instagram', label: 'Instagram', url: instagram })",
"  const fallback: FreeProfileQuickAction[] = []\n  if (phone) fallback.push({ type: 'call', label: 'Llamar', url: `tel:+${phone}` })\n  if (email) fallback.push({ type: 'email', label: 'Email', url: `mailto:${email}` })\n  if (instagram) fallback.push({ type: 'instagram', label: 'Instagram', url: instagram })")
replace_once(path,
"  const realPhoneSource = readString(data, 'whatsapp_number', 'whatsappNumber') || readString(contact, 'whatsapp', 'phone') || whatsappLink\n  const phone = normalizePhone(realPhoneSource) || (starterGenerated ? STARTER_PHONE : '')",
"  const realPhoneSource = readString(contact, 'phone')\n  const realWhatsappSource = readString(data, 'whatsapp_number', 'whatsappNumber') || readString(contact, 'whatsapp') || whatsappLink\n  const phone = normalizePhone(realPhoneSource) || (starterGenerated ? STARTER_PHONE : '')\n  const whatsapp = normalizePhone(realWhatsappSource) || phone\n  const email = readString(contact, 'email')")
replace_once(path,
"      phone,\n      whatsappGreetingName: greetingName,",
"      phone,\n      whatsapp,\n      email,\n      whatsappGreetingName: greetingName,")
replace_once(path,
"      quickActions: resolveQuickActions(data, phone, instagram, location),",
"      quickActions: resolveQuickActions(data, phone, whatsapp, email, instagram, location),")

# 4) Perfil público y vCard
path='web/src/components/free-profile/IntapLinkGratisProfile.tsx'
replace_once(path,
"function whatsappUrl(profile: FreeProfileData, subject?: string) {\n  if (!profile.phone) return ''",
"function whatsappUrl(profile: FreeProfileData, subject?: string) {\n  if (!profile.whatsapp) return ''")
replace_once(path,
"  return `https://wa.me/${profile.phone}?text=${encodeURIComponent(message)}`",
"  return `https://wa.me/${profile.whatsapp}?text=${encodeURIComponent(message)}`")
old_vcard = """      profile.phone ? `TEL;TYPE=CELL:${profile.phone}` : '',
      `URL:${canonicalUrl}`,"""
new_vcard = """      profile.phone ? `TEL;TYPE=CELL,VOICE:${profile.phone}` : '',
      profile.whatsapp && profile.whatsapp !== profile.phone ? `TEL;TYPE=CELL,WHATSAPP:${profile.whatsapp}` : '',
      profile.email ? `EMAIL;TYPE=INTERNET:${escapeVCard(profile.email)}` : '',
      `URL:${canonicalUrl}`,"""
replace_once(path,old_vcard,new_vcard)
replace_once(path,
"  const hasPhone = Boolean(profile.phone)",
"  const hasWhatsapp = Boolean(profile.whatsapp)")
replace_once(path,
"          {hasPhone && <a className=\"ilx-main-cta\" href={whatsappUrl(profile)}",
"          {hasWhatsapp && <a className=\"ilx-main-cta\" href={whatsappUrl(profile)}")

print('✓ Parches aplicados')
PY

step "Verificar invariantes del lote"
grep -q "ImageCropModal" app/src/components/admin/free/FreeTeamMemberEdit.tsx || fail "Crop no quedó conectado"
grep -q "const realPhoneSource = readString(contact, 'phone')" web/src/components/free-profile/IntapLinkGratis.adapter.ts || fail "Teléfono independiente no quedó conectado"
grep -q "const whatsapp = normalizePhone(realWhatsappSource)" web/src/components/free-profile/IntapLinkGratis.adapter.ts || fail "WhatsApp independiente no quedó conectado"
grep -q "EMAIL;TYPE=INTERNET" web/src/components/free-profile/IntapLinkGratisProfile.tsx || fail "Email no quedó en vCard"
grep -q "TEL;TYPE=CELL,WHATSAPP" web/src/components/free-profile/IntapLinkGratisProfile.tsx || fail "WhatsApp no quedó en vCard"
git diff --check

step "npm ci"
npm ci 2>&1 | tee "$LOG_DIR/npm-ci.log"

step "Build App"
npm run build -w app 2>&1 | tee "$LOG_DIR/app-build.log"

step "Build Web"
npm run build -w web 2>&1 | tee "$LOG_DIR/web-build.log"

step "Typecheck API"
(cd api && npx tsc --noEmit) 2>&1 | tee "$LOG_DIR/api-tsc.log"

step "Commit funcional"
git add app/src/components/admin/free/FreeTeamMemberEdit.tsx web/src/components/free-profile/IntapLinkGratis.types.ts web/src/components/free-profile/IntapLinkGratis.adapter.ts web/src/components/free-profile/IntapLinkGratisProfile.tsx
git commit -m "fix: preserve Team contact fields and crop member avatars"
PRODUCT_SHA="$(git rev-parse HEAD)"
echo "✓ SHA funcional: $PRODUCT_SHA"

step "Push main"
git push github HEAD:main

step "Deploy API Producción"
(cd api && npx wrangler deploy) 2>&1 | tee "$LOG_DIR/api-deploy.log"

step "Deploy App Producción"
npx wrangler pages deploy app/dist --project-name intap-web2 --branch main 2>&1 | tee "$LOG_DIR/app-deploy.log"

step "Deploy Web Producción"
npx wrangler pages deploy web/dist --project-name intap-link --branch main 2>&1 | tee "$LOG_DIR/web-deploy.log"

step "Smoke"
for url in "https://app.intaprd.com/admin/free/team" "https://intaprd.com/" "https://api.intaprd.com/api/health"; do
  code="$(curl -sS -o /dev/null -w '%{http_code}' "$url")"
  [[ "$code" == "200" ]] || fail "$url -> HTTP $code"
  echo "✓ $url -> HTTP 200"
done

TAG="prod-team-contact-vcard-crop-v2-2026-09-09-$(date +%H%M%S)"
git tag -a "$TAG" "$PRODUCT_SHA" -m "Team contact vCard and avatar crop release v2"
git push github "$TAG"

echo
echo "============================================================"
echo "✓ KAWVO TEAM · CONTACTOS + VCARD + CROP V2 DESPLEGADO"
echo "============================================================"
echo "SHA: $PRODUCT_SHA"
echo "Tag: $TAG"
echo "  ✓ Crop al editar foto Team"
echo "  ✓ Teléfono independiente de WhatsApp"
echo "  ✓ Email público del miembro"
echo "  ✓ vCard con teléfono/WhatsApp/email separados"
echo "Servicios: pendiente de referencia visual"
echo "Logs: $LOG_DIR"
echo "============================================================"
