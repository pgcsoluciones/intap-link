#!/usr/bin/env python3
from pathlib import Path

p = Path('app/src/components/admin/free/FreeAccount.tsx')
s = p.read_text(encoding='utf-8')

def replace_once(old: str, new: str, label: str):
    global s
    if old not in s:
        raise SystemExit(f'ERROR: no encontré patrón para {label}')
    s = s.replace(old, new, 1)
    print(f'✓ {label}')

replace_once(
"  const [showAi, setShowAi] = useState(false)\n",
"  const [showAi, setShowAi] = useState(false)\n  const [showCredentials, setShowCredentials] = useState(false)\n  const [credentialsFeedback, setCredentialsFeedback] = useState('')\n",
"estado del panel Credenciales",
)

replace_once(
"  const openNotifications = () => navigate('/admin/free/notifications?from=account')\n",
"  const openNotifications = () => navigate('/admin/free/notifications?from=account')\n\n  const copyPublicProfileUrl = async () => {\n    if (!publicUrl) return\n    setCredentialsFeedback('')\n    try {\n      await navigator.clipboard.writeText(publicUrl)\n      setCredentialsFeedback('Enlace copiado.')\n    } catch {\n      setCredentialsFeedback('No pudimos copiar el enlace.')\n    }\n  }\n",
"acción copiar enlace público",
)

needle = "            <SettingsRow tour=\"plan\" icon={<span className=\"text-amber-500\"><UpgradeCrownIcon className=\"h-6 w-6\" /></span>} label=\"Mejora tu plan\" detail=\"Conoce el Plan Plus\" href={basicPlanWhatsAppUrl()} />\n"
insert = "            <SettingsRow icon={<svg viewBox=\"0 0 24 24\" className=\"h-6 w-6\" fill=\"none\" stroke=\"currentColor\" strokeWidth=\"1.8\"><rect x=\"4\" y=\"10\" width=\"16\" height=\"10\" rx=\"2\"/><path d=\"M8 10V7a4 4 0 0 1 8 0v3\"/></svg>} label=\"Credenciales\" detail=\"Correo, usuario y acceso a tu perfil\" onClick={() => setShowCredentials((value) => !value)} />\n            {showCredentials && (\n              <div className=\"border-b border-slate-200 bg-white/80 px-5 py-5\">\n                <div className=\"space-y-4\">\n                  <div>\n                    <p className=\"text-[11px] font-black uppercase tracking-[0.12em] text-slate-400\">Correo de acceso</p>\n                    <p className=\"mt-1 break-all text-[15px] font-bold text-slate-900\">{me?.email || 'No disponible'}</p>\n                    <p className=\"mt-1 text-xs leading-5 text-slate-500\">Tu acceso a Kawvo se confirma mediante un enlace seguro enviado a este correo.</p>\n                  </div>\n                  <div className=\"border-t border-slate-100 pt-4\">\n                    <p className=\"text-[11px] font-black uppercase tracking-[0.12em] text-slate-400\">Contraseña</p>\n                    <p className=\"mt-1 text-[15px] font-bold text-slate-900\">No requerida</p>\n                    <p className=\"mt-1 text-xs leading-5 text-slate-500\">Esta cuenta usa acceso por enlace seguro, por lo que no necesitas recordar una contraseña.</p>\n                  </div>\n                  <div className=\"border-t border-slate-100 pt-4\">\n                    <p className=\"text-[11px] font-black uppercase tracking-[0.12em] text-slate-400\">Nombre de usuario</p>\n                    <div className=\"mt-1 flex items-center justify-between gap-3\"><p className=\"min-w-0 truncate text-[15px] font-bold text-slate-900\">{me?.slug ? `@${me.slug}` : 'Sin usuario'}</p><button type=\"button\" onClick={() => navigate('/admin/free/identifier')} className=\"shrink-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-cyan-700\">Editar</button></div>\n                    <p className=\"mt-1 text-xs leading-5 text-slate-500\">Al cambiar tu nombre de usuario también cambiará el enlace público de tu perfil.</p>\n                  </div>\n                  <div className=\"border-t border-slate-100 pt-4\">\n                    <p className=\"text-[11px] font-black uppercase tracking-[0.12em] text-slate-400\">Enlace del perfil</p>\n                    <p className=\"mt-1 break-all text-sm font-semibold text-slate-700\">{publicUrl || 'Disponible cuando tengas un nombre de usuario'}</p>\n                    {publicUrl && <button type=\"button\" onClick={() => void copyPublicProfileUrl()} className=\"mt-3 rounded-xl bg-slate-950 px-4 py-2.5 text-xs font-black text-white\">Copiar enlace</button>}\n                    {credentialsFeedback && <p className=\"mt-2 text-xs font-semibold text-slate-500\">{credentialsFeedback}</p>}\n                  </div>\n                </div>\n              </div>\n            )}\n" + needle
replace_once(needle, insert, "sección visual Credenciales")

p.write_text(s, encoding='utf-8')
print('✓ PATCH CREDENCIALES V1 COMPLETO')
