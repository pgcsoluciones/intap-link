#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
PUBLIC_CODE="4BXYMTNSK5"
TEAM_CODE="TEAM-2X7G-SHPJ"
PROFILE_ID="77d6994e-6682-414a-b482-392cbf380fe9"

fail(){ echo; echo "✗ ERROR: $1"; exit 1; }
q(){ (cd "$ROOT/api" && npx wrangler d1 execute intap_db --remote --config wrangler.toml --command="$1"); }

cd "$ROOT" || fail "No existe $ROOT"

echo "============================================================"
echo "KAWVO TEAM · AUDITORIA SOLO LECTURA · CASO ACTIVADO"
echo "Producto:   $PUBLIC_CODE"
echo "Team code:  $TEAM_CODE"
echo "Profile ID: $PROFILE_ID"
echo "============================================================"

echo; echo "▶ Artifact + Team code + activation"
q "SELECT a.id artifact_id,a.public_code,a.status artifact_status,a.owner_user_id,a.profile_id,a.activated_at,tc.id team_code_id,tc.team_id,tc.status team_code_status,tc.used_at,tc.member_profile_id,tc.artifact_id code_artifact_id,ac.id activation_code_id,ac.status activation_status,ac.used_at activation_used_at FROM intap_artifacts a JOIN team_link_codes tc ON tc.code='$TEAM_CODE' LEFT JOIN artifact_activation_codes ac ON ac.artifact_id=a.id ORDER BY ac.created_at DESC LIMIT 1;"

echo; echo "▶ Team member exacto"
q "SELECT tm.id member_id,tm.team_id,tm.user_id,tm.profile_id,tm.artifact_id,tm.invite_code_id,tm.status,tm.admin_role,tm.permissions_json,tm.joined_at,tm.updated_at FROM team_members tm WHERE tm.profile_id='$PROFILE_ID' OR tm.artifact_id=(SELECT id FROM intap_artifacts WHERE public_code='$PUBLIC_CODE') LIMIT 5;"

echo; echo "▶ Perfil creado"
q "SELECT p.id,p.user_id,p.slug,p.name,p.plan_id,p.is_published,p.category,p.subcategory,p.theme_id,p.layout_id,p.free_palette_id,p.avatar_url,p.hero_url,p.created_at,p.updated_at,p.template_data FROM profiles p WHERE p.id='$PROFILE_ID' LIMIT 1;"

echo; echo "▶ Contacto del miembro"
q "SELECT profile_id,whatsapp,email,phone,hours,address,map_url FROM profile_contact WHERE profile_id='$PROFILE_ID' LIMIT 1;"

echo; echo "▶ Team + Master"
q "SELECT tw.id team_id,tw.name team_name,tw.owner_user_id,tw.master_profile_id,tw.status,p.slug master_slug,p.name master_name,p.is_published master_published FROM team_workspaces tw JOIN profiles p ON p.id=tw.master_profile_id WHERE tw.id=(SELECT team_id FROM team_link_codes WHERE code='$TEAM_CODE') LIMIT 1;"

echo; echo "▶ Integridad de relaciones"
q "SELECT (SELECT COUNT(*) FROM team_members tm WHERE tm.profile_id='$PROFILE_ID' AND tm.artifact_id=(SELECT id FROM intap_artifacts WHERE public_code='$PUBLIC_CODE')) member_artifact_ok,(SELECT COUNT(*) FROM intap_artifacts a WHERE a.public_code='$PUBLIC_CODE' AND a.profile_id='$PROFILE_ID' AND a.status='activated') artifact_profile_ok,(SELECT COUNT(*) FROM team_link_codes tc WHERE tc.code='$TEAM_CODE' AND tc.member_profile_id='$PROFILE_ID' AND tc.status='used') code_profile_ok;"

echo; echo "▶ Conteos Master vs miembro"
q "WITH x AS (SELECT master_profile_id FROM team_workspaces WHERE id=(SELECT team_id FROM team_link_codes WHERE code='$TEAM_CODE')) SELECT (SELECT COUNT(*) FROM profile_links WHERE profile_id=(SELECT master_profile_id FROM x)) master_links,(SELECT COUNT(*) FROM profile_links WHERE profile_id='$PROFILE_ID') member_links,(SELECT COUNT(*) FROM profile_gallery WHERE profile_id=(SELECT master_profile_id FROM x)) master_gallery,(SELECT COUNT(*) FROM profile_gallery WHERE profile_id='$PROFILE_ID') member_gallery,(SELECT COUNT(*) FROM profile_products WHERE profile_id=(SELECT master_profile_id FROM x)) master_products,(SELECT COUNT(*) FROM profile_products WHERE profile_id='$PROFILE_ID') member_products,(SELECT COUNT(*) FROM profile_social_links WHERE profile_id=(SELECT master_profile_id FROM x)) master_social,(SELECT COUNT(*) FROM profile_social_links WHERE profile_id='$PROFILE_ID') member_social,(SELECT COUNT(*) FROM profile_modules WHERE profile_id=(SELECT master_profile_id FROM x)) master_modules,(SELECT COUNT(*) FROM profile_modules WHERE profile_id='$PROFILE_ID') member_modules,(SELECT COUNT(*) FROM profile_faqs WHERE profile_id=(SELECT master_profile_id FROM x)) master_faqs,(SELECT COUNT(*) FROM profile_faqs WHERE profile_id='$PROFILE_ID') member_faqs,(SELECT COUNT(*) FROM profile_videos WHERE profile_id=(SELECT master_profile_id FROM x)) master_videos,(SELECT COUNT(*) FROM profile_videos WHERE profile_id='$PROFILE_ID') member_videos,(SELECT COUNT(*) FROM profile_bank_accounts WHERE profile_id=(SELECT master_profile_id FROM x)) master_banks,(SELECT COUNT(*) FROM profile_bank_accounts WHERE profile_id='$PROFILE_ID') member_banks;"

echo; echo "▶ Scan status actual"
curl -sS "https://api.intaprd.com/api/v1/public/artifacts/scan/status?public_code=$PUBLIC_CODE" || true
printf '\n'

echo; echo "============================================================"
echo "✓ AUDITORIA SOLO LECTURA COMPLETADA"
echo "No se modificó D1 ni se consumió ningún recurso adicional."
echo "============================================================"
