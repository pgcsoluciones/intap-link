#!/usr/bin/env python3
from pathlib import Path

p = Path('web/src/components/demo/KawvoLinkDemo.tsx')
s = p.read_text()
old = """    const phone = isAiGenerated
      ? normalizePhone(form.samePhoneAsWhatsapp === false ? (form.phone || '') : form.whatsapp)
      : normalizePhone(form.whatsapp)
    const email = String(form.email || '').trim().slice(0, 120)
    const quickActions = [
      ...(phone ? [{ type: 'call' as const, label: 'Llamar', url: `tel:+${phone}` }] : []),"""
new = """    const callPhone = isAiGenerated
      ? normalizePhone(form.samePhoneAsWhatsapp === false ? (form.phone || '') : form.whatsapp)
      : normalizePhone(form.whatsapp)
    const email = String(form.email || '').trim().slice(0, 120)
    const quickActions = [
      ...(callPhone ? [{ type: 'call' as const, label: 'Llamar', url: `tel:+${callPhone}` }] : []),"""
if new not in s:
    if old not in s:
        raise SystemExit('No encontré bloque phone/callPhone')
    s = s.replace(old, new, 1)
old2 = "bio: form.bio.trim() || 'Aquí aparecerá una descripción breve sobre ti o tu negocio.', phone: phone || whatsapp,"
new2 = "bio: form.bio.trim() || 'Aquí aparecerá una descripción breve sobre ti o tu negocio.', phone: whatsapp,"
if new2 not in s:
    if old2 not in s:
        raise SystemExit('No encontré phone de profile')
    s = s.replace(old2, new2, 1)
p.write_text(s)
print('✓ WhatsApp CTA conserva WhatsApp; botón Llamar usa el teléfono de llamadas')
