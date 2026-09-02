#!/usr/bin/env python3
from pathlib import Path

path = Path('app/src/components/admin/free/FreeAccount.tsx')
text = path.read_text()

old_state = "  const [pwaInstalled, setPwaInstalled] = useState(() => window.matchMedia('(display-mode: standalone)').matches || Boolean((window.navigator as any).standalone) || localStorage.getItem('kawvo_pwa_installed') === '1')"
new_state = "  const [pwaInstalled, setPwaInstalled] = useState(() => window.matchMedia('(display-mode: standalone)').matches || Boolean((window.navigator as any).standalone))"
if old_state not in text:
    raise SystemExit('No encontré el estado PWA esperado para corregirlo')
text = text.replace(old_state, new_state, 1)

old_row = "              {!pwaInstalled && <SettingsRow icon={<svg viewBox=\"0 0 24 24\" className=\"h-6 w-6\" fill=\"none\" stroke=\"currentColor\" strokeWidth=\"1.8\"><rect x=\"6\" y=\"2.5\" width=\"12\" height=\"19\" rx=\"2.5\"/><path d=\"M9 15l3 3 3-3M12 8v10\"/></svg>} label=\"Instalar app Kawvo\" detail={pwaInstallReady ? \"Instálala en este dispositivo\" : \"Accede a Kawvo como una app\"} onClick={() => void installPwa()} />}"
new_row = "              <SettingsRow icon={<svg viewBox=\"0 0 24 24\" className=\"h-6 w-6\" fill=\"none\" stroke=\"currentColor\" strokeWidth=\"1.8\"><rect x=\"6\" y=\"2.5\" width=\"12\" height=\"19\" rx=\"2.5\"/><path d=\"M9 15l3 3 3-3M12 8v10\"/></svg>} label={pwaInstalled ? \"Kawvo está instalada\" : \"Instalar app Kawvo\"} detail={pwaInstalled ? \"La estás usando como app en este dispositivo\" : (pwaInstallReady ? \"Instálala en este dispositivo\" : \"Accede a Kawvo como una app\")} onClick={() => pwaInstalled ? undefined : void installPwa()} />"
if old_row not in text:
    raise SystemExit('No encontré la fila PWA esperada para hacerla persistente')
text = text.replace(old_row, new_row, 1)

path.write_text(text)
print('✓ Mi cuenta siempre muestra el estado/acción de la app Kawvo')
