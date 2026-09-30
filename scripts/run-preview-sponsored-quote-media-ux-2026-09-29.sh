#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
BRANCH="feature/sponsored-banner-per-code"
EXPECTED_MAIN_SHA="a68416bed8a136f2cc96d500453df6ab4d415e06"
APP_PROJECT="intap-web2"
WEB_PROJECT="intap-link"
LOG_DIR="$ROOT/.preview-sponsored-quote-banner-logs"
APP_LOG="$LOG_DIR/app-pages.log"
WEB_LOG="$LOG_DIR/web-pages.log"
WORKER_LOG="$LOG_DIR/worker-preview.log"
PREVIEW_CFG="$ROOT/api/wrangler.preview.toml"
PREVIEW_CFG_BAK="$LOG_DIR/wrangler.preview.toml.bak"

fail(){ echo; echo "✗ ERROR: $1"; exit 1; }
run(){ echo; echo "▶ $*"; "$@" || fail "$*"; }

[ "$(grep -c '^UNEXPECTED=' "$0")" -eq 1 ] || fail "Runner corrupto: bloque de validación duplicado"
cd "$ROOT" || fail "No existe $ROOT"
rm -rf "$LOG_DIR" && mkdir -p "$LOG_DIR"

cat <<'EOF'
============================================================
KAWVO LINK · PERFIL PATROCINADO · MEDIA UX · PREVIEW QA
============================================================
Incluye:
- cintillo patrocinado activable/desactivable por código beneficiario
- CTA Solicitar cotización debajo del horario
- formulario universal con envío por WhatsApp o correo
- footer KawLink siempre visible
Producción NO se toca
============================================================
EOF

run git fetch github main "$BRANCH"
[ "$(git rev-parse github/main)" = "$EXPECTED_MAIN_SHA" ] || fail "main cambió; detener y auditar antes de desplegar"
run git switch "$BRANCH"
run git pull --ff-only github "$BRANCH"
# Si el usuario ejecutó chmod +x, Git puede marcar solo el bit ejecutable del propio runner.
# Bash ya está ejecutando el archivo, así que restauramos únicamente ese cambio de modo antes del control de limpieza.
git restore -- scripts/run-preview-sponsored-quote-media-ux-2026-09-29.sh 2>/dev/null || true
[ -z "$(git status --porcelain)" ] || { git status --short; fail "Árbol local no limpio"; }

ALLOWED='^(api/migrations-preview/0075_sponsored_banner_per_artifact\.sql|api/migrations-preview/0076_sponsored_profile_email\.sql|api/migrations-preview/0077_sponsored_profile_email_repair\.sql|api/migrations-preview/0078_sponsored_quote_media\.sql|api/migrations-preview/0079_sponsored_quote_media_batch\.sql|api/migrations-preview/0080_appointments_core\.sql|api/migrations-preview/0081_sponsored_public_actions\.sql|api/migrations-preview/0082_user_push_subscriptions\.sql|api/migrations/0076_sponsored_banner_per_artifact\.sql|api/migrations/0077_sponsored_profile_email\.sql|api/migrations/0078_sponsored_quote_media\.sql|api/migrations/0079_sponsored_quote_media_batch\.sql|api/migrations/0080_appointments_core\.sql|api/migrations/0081_sponsored_public_actions\.sql|api/migrations/0082_user_push_subscriptions\.sql|api/src/appointments-core\.ts|api/src/sponsored-appointments\.ts|api/src/pwa-push\.ts|api/src/sponsored-profiles\.ts|api/src/lib/admin-auth\.ts|api/src/sponsored-public\.ts|api/src/sponsored-admin-extra\.ts|api/src/sponsored-quote-media\.ts|api/src/preview-free-entry\.ts|api/src/preview-frontdoor-entry\.ts|api/src/account-home-route\.ts|api/wrangler\.preview\.toml|api/wrangler\.toml|functions/_middleware\.ts|app/public/sw\.js|app/src/components/admin/free/FreePwaHome\.tsx|app/src/components/notifications/PwaNotificationBridge\.tsx|app/src/App\.tsx|app/src/components/appointments/AppointmentManager\.tsx|app/src/components/admin/SuperAdminSponsors\.tsx|app/src/components/admin/sponsored/SponsoredDashboard\.tsx|app/src/components/admin/sponsored/SponsorDashboard\.tsx|app/src/components/admin/sponsored/SponsoredExperienceTools\.tsx|app/src/components/admin/sponsored/SponsoredAppointments\.tsx|web/src/components/PublicProfile\.tsx|web/src/components/appointments/AppointmentRequestModal\.tsx|web/src/components/appointments/AppointmentOwnerBar\.tsx|web/src/components/sponsored/SponsoredProfile\.tsx|web/src/components/sponsored/QuoteAudioRecorder\.tsx|web/src/components/sponsored/QuoteMediaAttachments\.tsx|web/src/components/sponsored/SponsoredAppointmentModal\.tsx|web/src/components/sponsored/SponsoredQuoteMediaViewer\.tsx|scripts/generate-vapid-jwk\.mjs|scripts/test-sponsored-profile-contract\.mjs|scripts/run-preview-sponsored-banner-quote-2026-09-29\.sh|scripts/run-preview-sponsored-quote-media-ux-2026-09-29\.sh|scripts/run-production-sponsored-banner-quote-2026-09-29\.sh)$'
UNEXPECTED="$(git diff --name-only github/main...HEAD | grep -Ev "$ALLOWED" || true)"
[ -z "$UNEXPECTED" ] || { echo "$UNEXPECTED"; fail "Hay archivos fuera del alcance"; }

run git diff --check github/main...HEAD
run node scripts/test-sponsored-profile-contract.mjs
run npm ci
run npm run build:preview -w app
run npm run build -w web
run bash -lc 'cd api && npx tsc --noEmit'

echo; echo "▶ Verificar VAPID Preview para Web Push"
if ! (cd api && npx wrangler secret list --config wrangler.preview.toml 2>/dev/null | grep -F 'VAPID_PRIVATE_JWK' >/dev/null); then
  echo "  Creando clave VAPID Preview estable..."
  node scripts/generate-vapid-jwk.mjs | (cd api && npx wrangler secret put VAPID_PRIVATE_JWK --config wrangler.preview.toml) >/dev/null || fail "Configurar VAPID_PRIVATE_JWK Preview"
  echo "✓ VAPID_PRIVATE_JWK creada en Preview"
else
  echo "✓ VAPID_PRIVATE_JWK ya existe en Preview"
fi

if [ "${SKIP_MIGRATIONS:-0}" = "1" ]; then
  echo; echo "▶ Migraciones D1 Preview omitidas por SKIP_MIGRATIONS=1"
else
  echo; echo "▶ Aplicar migraciones SOLO D1 Preview"
  (
    cd api
    npx wrangler d1 migrations apply intap_db_preview --remote --config wrangler.preview.toml
  ) || fail "Migraciones D1 Preview"
fi

echo; echo "▶ Verificar esquema D1 Preview antes de desplegar"
BANNER_SCHEMA="$(cd api && npx wrangler d1 execute intap_db_preview --remote --config wrangler.preview.toml --command "SELECT name FROM pragma_table_info('sponsor_artifacts') WHERE name='banner_enabled';" 2>/dev/null || true)"
EMAIL_SCHEMA="$(cd api && npx wrangler d1 execute intap_db_preview --remote --config wrangler.preview.toml --command "SELECT name FROM pragma_table_info('sponsored_profiles') WHERE name='email';" 2>/dev/null || true)"
echo "$BANNER_SCHEMA" | grep -F 'banner_enabled' >/dev/null || fail "D1 Preview no tiene sponsor_artifacts.banner_enabled"
echo "$EMAIL_SCHEMA" | grep -F 'email' >/dev/null || fail "D1 Preview no tiene sponsored_profiles.email"
QUOTE_MEDIA_TABLE="$(cd api && npx wrangler d1 execute intap_db_preview --remote --config wrangler.preview.toml --command "SELECT name FROM sqlite_master WHERE type='table' AND name='sponsored_quote_media';" 2>/dev/null || true)"
echo "$QUOTE_MEDIA_TABLE" | grep -F 'sponsored_quote_media' >/dev/null || fail "D1 Preview no tiene sponsored_quote_media"
QUOTE_MEDIA_BATCH="$(cd api && npx wrangler d1 execute intap_db_preview --remote --config wrangler.preview.toml --command "SELECT name FROM pragma_table_info('sponsored_quote_media') WHERE name='batch_id';" 2>/dev/null || true)"
echo "$QUOTE_MEDIA_BATCH" | grep -F 'batch_id' >/dev/null || fail "D1 Preview no tiene sponsored_quote_media.batch_id"
APPOINTMENT_TABLES="$(cd api && npx wrangler d1 execute intap_db_preview --remote --config wrangler.preview.toml --command "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('appointment_settings','appointment_availability','appointment_reasons','appointment_blocks','appointment_requests') ORDER BY name;" 2>/dev/null || true)"
for table in appointment_settings appointment_availability appointment_reasons appointment_blocks appointment_requests; do
  echo "$APPOINTMENT_TABLES" | grep -F "$table" >/dev/null || fail "D1 Preview no tiene $table"
done
PUBLIC_ACTION_COLUMNS="$(cd api && npx wrangler d1 execute intap_db_preview --remote --config wrangler.preview.toml --command "SELECT name FROM pragma_table_info('sponsored_profiles') WHERE name IN ('quote_button_visible','appointment_button_visible') ORDER BY name;" 2>/dev/null || true)"
echo "$PUBLIC_ACTION_COLUMNS" | grep -F 'quote_button_visible' >/dev/null || fail "D1 Preview no tiene sponsored_profiles.quote_button_visible"
echo "$PUBLIC_ACTION_COLUMNS" | grep -F 'appointment_button_visible' >/dev/null || fail "D1 Preview no tiene sponsored_profiles.appointment_button_visible"
PUSH_TABLE="$(cd api && npx wrangler d1 execute intap_db_preview --remote --config wrangler.preview.toml --command "SELECT name FROM sqlite_master WHERE type='table' AND name='user_push_subscriptions';" 2>/dev/null || true)"
echo "$PUSH_TABLE" | grep -F 'user_push_subscriptions' >/dev/null || fail "D1 Preview no tiene user_push_subscriptions"
echo "✓ Esquema D1 Preview verificado"

echo; echo "▶ Deploy App Pages Preview"
(npx wrangler pages deploy app/dist --project-name "$APP_PROJECT" --branch "$BRANCH") 2>&1 | tee "$APP_LOG"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy App Preview"
APP_ORIGIN="$(grep -Eo 'https://[0-9a-f]{8,}\.intap-web2\.pages\.dev' "$APP_LOG" | tail -1)"
[ -n "$APP_ORIGIN" ] || fail "No pude detectar App origin"

echo; echo "▶ Deploy Web Pages Preview"
(npx wrangler pages deploy web/dist --project-name "$WEB_PROJECT" --branch "$BRANCH") 2>&1 | tee "$WEB_LOG"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy Web Preview"
WEB_ORIGIN="$(grep -Eo 'https://[0-9a-f]{8,}\.intap-link\.pages\.dev' "$WEB_LOG" | tail -1)"
[ -n "$WEB_ORIGIN" ] || fail "No pude detectar Web origin"

cp "$PREVIEW_CFG" "$PREVIEW_CFG_BAK"
restore_cfg(){ cp "$PREVIEW_CFG_BAK" "$PREVIEW_CFG" 2>/dev/null || true; }
trap restore_cfg EXIT

python3 - "$PREVIEW_CFG" "$APP_ORIGIN" "$WEB_ORIGIN" <<'PY'
from pathlib import Path
import re,sys
p=Path(sys.argv[1]); app=sys.argv[2]; web=sys.argv[3]
s=p.read_text()
s,n1=re.subn(r'APP_PAGES_ORIGIN\s*=\s*"[^"]+"',f'APP_PAGES_ORIGIN = "{app}"',s,count=1)
s,n2=re.subn(r'WEB_PAGES_ORIGIN\s*=\s*"[^"]+"',f'WEB_PAGES_ORIGIN = "{web}"',s,count=1)
if n1 != 1 or n2 != 1:
    raise SystemExit(f"No pude fijar origins Preview: APP={n1} WEB={n2}")
p.write_text(s)
PY

echo; echo "▶ Deploy Worker Preview"
(
  cd api
  npx wrangler deploy --config wrangler.preview.toml --dry-run
  npx wrangler deploy --config wrangler.preview.toml
) 2>&1 | tee "$WORKER_LOG"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy Worker Preview"
restore_cfg
trap - EXIT

sleep 4
echo; echo "▶ Smoke HTTP Preview"
for url in   "https://app.preview.intaprd.com/admin/login"   "https://app.preview.intaprd.com/superadmin/sponsors"   "https://preview.intaprd.com"
do
  code="$(curl -sS -L -o /dev/null -w '%{http_code}' "$url")"
  echo "✓ $url -> HTTP $code"
  [ "$code" = "200" ] || fail "$url respondió HTTP $code"
done

rm -rf "$LOG_DIR"
[ -z "$(git status --porcelain)" ] || { git status --short; fail "Runner dejó cambios locales"; }

cat <<EOF
============================================================
✓ PERFIL PATROCINADO LISTO EN PREVIEW
============================================================
Feature SHA: $(git rev-parse HEAD)
App origin:  $APP_ORIGIN
Web origin:  $WEB_ORIGIN

QA Super Admin:
https://app.preview.intaprd.com/superadmin/sponsors

Validar:
1. Código beneficiario muestra Cintillo Activo/Inactivo.
2. Master muestra "No aplica".
3. Desactivar cintillo oculta solo patrocinio del perfil público.
4. "Desarrollado por KawLink" permanece visible.
5. Debajo del horario aparece "Solicitar cotización / información".
6. Debajo de cada acción pública visible aparece su enlace de compartir por WhatsApp.
7. Modal pide nombre, teléfono, correo opcional y cotización / información.
8. Entrega, sector y forma de pago son opcionales.
9. Al completar nombre, teléfono y cotización / información aparece el selector de envío.
10. Si el negocio tiene WhatsApp y correo, permite elegir; si solo tiene uno, usa ese canal.
11. Correo abre la aplicación predeterminada con destinatario, asunto y solicitud precargados.
12. Al enviar, el navegador vuelve al home limpio del perfil.
13. CRM del patrocinador muestra el correo del patrocinado.
14. Super Admin muestra el correo del patrocinado.
15. El modal permanece centrado, sin scroll horizontal.
16. Adjuntar media permite hasta 3 imágenes O 1 audio O 2 archivos por solicitud, sin mezclar tipos.
17. Las imágenes del lote se optimizan antes de subir.
18. Un mismo visitante puede adjuntar como máximo 9 imágenes por perfil en una ventana de 24 horas.
19. Un lote de imágenes llega al mensaje con un solo enlace.
20. Ese enlace abre las imágenes como galería navegable.
21. En la galería, cada imagen se descarga individualmente desde la imagen visible.
22. Los enlaces temporales de media no muestran imagen, favicon ni tarjeta gráfica de Kawvo Link.
23. El dueño puede mostrar Cotizar, Agendar o ambos; nunca dejar el perfil sin una acción.
24. Agenda pide nombre, teléfono, correo opcional, fecha, hora, motivo y detalles.
25. Agenda ofrece motivos universales: visita, llamada, reunión/cita, evaluación/chequeo, compra/retiro, servicio/atención u otro.
26. Agenda se envía únicamente por WhatsApp y queda pendiente de confirmación.
27. La solicitud de cotización puede enviarse con texto + media o solo media.
28. Al enviar cotización, formulario y adjuntos quedan limpios.
29. El endpoint efímero rechaza archivos vencidos y el cron los elimina de R2/D1.
30. Producción NO tocada.
31. Agenda está inactiva por defecto; Agendar solo puede hacerse visible cuando el módulo está activo.
32. El dueño configura duración, anticipación, horizonte, días y franjas horarias.
33. Puede bloquear un día completo o una franja y volver a habilitarla.
34. Puede usar motivos predeterminados o personalizarlos.
35. El calendario público solo ofrece horas disponibles; solicitudes pendientes no bloquean el slot.
36. Al enviar, la solicitud queda persistida y luego abre WhatsApp.
37. Nueva solicitud crea notificación para el dueño del perfil.
38. Propietario logueado ve barra rápida en su perfil público con campana y solicitudes pendientes.
39. Confirmar desde barra o panel bloquea la hora; doble confirmación concurrente se rechaza.
40. Rechazar no ocupa la hora; Liberar horario devuelve una cita confirmada a disponibilidad.
41. El panel completo de Agenda vive en /admin/sponsored/agenda y usa componentes/core reutilizables para Free/Plus/Trial.
42. Portada PWA muestra acceso rápido a Agenda y contador rojo de solicitudes pendientes.
43. Badge rojo en icono PWA refleja notificaciones no leídas cuando Badging API está disponible.
44. Nueva solicitud de agenda reproduce el sonido elegido mientras Kawvo está activa; modo sin sonido intenta vibración.
45. PWA ofrece Agenda ascendente, Campana suave, Pulso corto y Sin sonido.
46. Con permiso del sistema, una nueva agenda muestra notificación cuando la app está oculta y tocarla abre la acción.
47. Web Push registra el dispositivo y entrega la solicitud aunque la PWA esté cerrada, si el navegador/SO lo soporta.
48. Cotizar / información y Agendar tienen visibilidad configurable desde el panel.
49. Si Cotizar se oculta, Agenda debe permanecer activa y visible; si Agenda se desactiva, Cotizar debe estar visible.
50. Compartir formulario abre ?cotizar=1 y Compartir agendar abre ?agendar=1 mediante WhatsApp.
============================================================
EOF
