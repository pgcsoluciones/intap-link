from pathlib import Path

p=Path('app/src/components/admin/free/FreeAccount.tsx')
s=p.read_text()
repls=[
('tour="notifications-ai"','tour="notifications"'),
('            <SettingsRow icon="✧" label="Cuotas de IA"','            <SettingsRow tour="ai" icon="✧" label="Cuotas de IA"'),
('              <SettingsRow tour="products" icon={<svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="6" y="2.5" width="12" height="19" rx="2.5"/><path d="M9 15l3 3 3-3M12 8v10"/></svg>} label={pwaInstalled ? "Kawvo está instalada" : "Instalar app Kawvo"}',
 '              <SettingsRow tour="install-app" icon={<svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="6" y="2.5" width="12" height="19" rx="2.5"/><path d="M9 15l3 3 3-3M12 8v10"/></svg>} label={pwaInstalled ? "Kawvo está instalada" : "Instalar app Kawvo"}'),
('              <SettingsRow icon={<svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M6 7h12l1 13H5L6 7Z"/><path d="M9 9V6a3 3 0 0 1 6 0v3"/></svg>} label="Mis productos"',
 '              <SettingsRow tour="products" icon={<svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M6 7h12l1 13H5L6 7Z"/><path d="M9 9V6a3 3 0 0 1 6 0v3"/></svg>} label="Mis productos"'),
('              <SettingsRow tour="sharing" icon="▦" label={qrBusy ? \'Generando QR…\' : \'Descargar QR de mi perfil\'}',
 '              <SettingsRow tour="qr" icon="▦" label={qrBusy ? \'Generando QR…\' : \'Descargar QR de mi perfil\'}'),
('              {bankActive && <SettingsRow icon={<svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8">',
 '              {bankActive && <SettingsRow tour="bank-transfer" icon={<svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8">'),
('              <SettingsRow icon={<svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="9" cy="8" r="3"/><circle cx="16" cy="9" r="2.5"/>',
 '              <SettingsRow tour="invite" icon={<svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="9" cy="8" r="3"/><circle cx="16" cy="9" r="2.5"/>'),
('            <div data-account-tour="help" className="overflow-hidden rounded-[22px] bg-[#f5f5f5]">',
 '            <div data-account-tour={resources.length > 0 ? "resources" : undefined} className="overflow-hidden rounded-[22px] bg-[#f5f5f5]">'),
('          <div className="mt-8" id="account-support">',
 '          <div className="mt-8" id="account-support" data-account-tour="support">'),
]
for old,new in repls:
    if old not in s:
        raise SystemExit(f'No encontré patrón:\n{old}')
    s=s.replace(old,new,1)
p.write_text(s)
print('✓ targets de Mi cuenta separados por función')
