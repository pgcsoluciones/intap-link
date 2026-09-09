#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
PUBLIC_CODE="${PUBLIC_CODE:-4BXYMTNSK5}"
TEAM_CODE="${TEAM_CODE:-TEAM-2X7G-SHPJ}"
CFG="wrangler.toml"

cd "$ROOT/api" || exit 1

q(){
  local sql="$1"
  echo
  echo "--- $2"
  npx wrangler d1 execute intap_db --remote --config "$CFG" --command="$sql"
}

cat <<EOF
============================================================
KAWVO TEAM · AUDITORIA CASO ASSIGN 409 · SOLO LECTURA
============================================================
Producto:   $PUBLIC_CODE
Código Team: $TEAM_CODE
NO modifica D1. Solo SELECT/PRAGMA.
============================================================
EOF

q "SELECT a.id,a.public_code,a.product_type,a.status,a.owner_user_id,a.profile_id,a.activated_at,a.updated_at FROM intap_artifacts a WHERE a.public_code='$PUBLIC_CODE' LIMIT 1;" "Artifact exacto"

q "SELECT ac.id,ac.artifact_id,ac.status,ac.created_at,ac.used_at,ac.expires_at FROM artifact_activation_codes ac JOIN intap_artifacts a ON a.id=ac.artifact_id WHERE a.public_code='$PUBLIC_CODE' ORDER BY ac.created_at DESC;" "Activation codes del artifact"

q "SELECT tc.id,tc.team_id,tc.code,tc.status,tc.artifact_id,tc.member_profile_id,tc.used_by_user_id,tc.used_at,tc.expires_at,tc.permissions_json,tc.created_at,tc.updated_at FROM team_link_codes tc WHERE tc.code='$TEAM_CODE' LIMIT 1;" "Código Team exacto"

q "SELECT tw.id,tw.name,tw.owner_user_id,tw.master_profile_id,tw.status,p.slug master_slug,p.name master_name,p.plan_id,p.is_published FROM team_workspaces tw JOIN team_link_codes tc ON tc.team_id=tw.id LEFT JOIN profiles p ON p.id=tw.master_profile_id WHERE tc.code='$TEAM_CODE' LIMIT 1;" "Workspace + Master del código"

q "SELECT pc.profile_id,pc.whatsapp,pc.email,pc.phone,pc.hours,pc.address,pc.map_url FROM profile_contact pc JOIN team_workspaces tw ON tw.master_profile_id=pc.profile_id JOIN team_link_codes tc ON tc.team_id=tw.id WHERE tc.code='$TEAM_CODE' LIMIT 1;" "Contacto Master usado por INSERT ... SELECT"

q "SELECT tm.id,tm.team_id,tm.user_id,tm.profile_id,tm.artifact_id,tm.invite_code_id,tm.status,tm.admin_role,tm.joined_at FROM team_members tm WHERE tm.invite_code_id=(SELECT id FROM team_link_codes WHERE code='$TEAM_CODE' LIMIT 1) OR tm.artifact_id=(SELECT id FROM intap_artifacts WHERE public_code='$PUBLIC_CODE' LIMIT 1);" "Conflictos existentes por code/artifact"

q "SELECT id,email FROM users WHERE email LIKE 'seat-%@team.internal.kawvo' ORDER BY created_at DESC LIMIT 5;" "Últimos synthetic seat users"

q "SELECT p.id,p.slug,p.user_id,p.name,p.plan_id,p.is_published,p.created_at FROM profiles p WHERE p.slug LIKE (SELECT lower(p2.slug)||'-%' FROM team_workspaces tw JOIN team_link_codes tc ON tc.team_id=tw.id JOIN profiles p2 ON p2.id=tw.master_profile_id WHERE tc.code='$TEAM_CODE' LIMIT 1) ORDER BY p.created_at DESC LIMIT 10;" "Slugs Team relacionados"

q "PRAGMA table_info(users);" "Schema users"
q "PRAGMA table_info(profiles);" "Schema profiles"
q "PRAGMA table_info(profile_contact);" "Schema profile_contact"
q "PRAGMA table_info(team_members);" "Schema team_members"
q "PRAGMA table_info(intap_artifacts);" "Schema intap_artifacts"
q "PRAGMA table_info(artifact_activation_codes);" "Schema artifact_activation_codes"
q "PRAGMA table_info(team_link_codes);" "Schema team_link_codes"

q "PRAGMA index_list(users);" "Indexes users"
q "PRAGMA index_list(profiles);" "Indexes profiles"
q "PRAGMA index_list(profile_contact);" "Indexes profile_contact"
q "PRAGMA index_list(team_members);" "Indexes team_members"
q "PRAGMA index_list(intap_artifacts);" "Indexes intap_artifacts"
q "PRAGMA index_list(team_link_codes);" "Indexes team_link_codes"

q "SELECT name,tbl_name,sql FROM sqlite_master WHERE type='trigger' AND tbl_name IN('users','profiles','profile_contact','team_members','intap_artifacts','artifact_activation_codes','team_link_codes') ORDER BY tbl_name,name;" "Triggers que pueden abortar el batch"

q "SELECT name,tbl_name,sql FROM sqlite_master WHERE type='index' AND tbl_name IN('users','profiles','profile_contact','team_members','intap_artifacts','artifact_activation_codes','team_link_codes') AND sql IS NOT NULL ORDER BY tbl_name,name;" "Unique/custom indexes relevantes"

q "SELECT (SELECT COUNT(*) FROM team_link_codes WHERE code='$TEAM_CODE' AND used_at IS NULL AND status NOT IN('used','disabled','expired')) code_still_usable,(SELECT COUNT(*) FROM intap_artifacts WHERE public_code='$PUBLIC_CODE' AND owner_user_id IS NULL AND status IN('available','unassigned')) artifact_still_free,(SELECT COUNT(*) FROM artifact_activation_codes ac JOIN intap_artifacts a ON a.id=ac.artifact_id WHERE a.public_code='$PUBLIC_CODE' AND ac.status='active' AND (ac.expires_at IS NULL OR ac.expires_at>datetime('now'))) active_activation_code;" "Postcondición segura después del 409"

echo
cat <<EOF
============================================================
FIN AUDITORIA READ-ONLY
============================================================
Si code_still_usable=1, artifact_still_free=1 y active_activation_code=1,
el intento 409 no consumió ni dañó el producto.
============================================================
EOF
