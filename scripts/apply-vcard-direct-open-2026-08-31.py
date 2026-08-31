#!/usr/bin/env python3
from pathlib import Path

path = Path('web/src/components/free-profile/IntapLinkGratisProfile.tsx')
s = path.read_text()
old = """    const blob = new Blob([content], { type: 'text/vcard;charset=utf-8' })
    const file = new File([blob], profile.vcardFileName || `${profile.slug || 'contacto'}.vcf`, { type: 'text/vcard' })
    try {
      if (navigator.share && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: `Guardar contacto de ${profile.name}` })
        return
      }
    } catch (error: any) {
      if (error?.name === 'AbortError') return
    }
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = file.name
    anchor.rel = 'noopener'
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 1500)
"""
new = """    const blob = new Blob([content], { type: 'text/vcard;charset=utf-8' })
    const fileName = profile.vcardFileName || `${profile.slug || 'contacto'}.vcf`
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    const isMobileContactFlow = /iphone|ipad|ipod|android/i.test(window.navigator.userAgent)

    anchor.href = url
    anchor.rel = 'noopener'

    if (isMobileContactFlow) {
      // En móvil dejamos que el sistema operativo abra/interprete el vCard.
      // iOS presenta la ficha del contacto; Android usa su manejador de VCF cuando está disponible.
      anchor.target = '_self'
    } else {
      // En escritorio conservamos la descarga tradicional como respaldo.
      anchor.download = fileName
    }

    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), isMobileContactFlow ? 60000 : 1500)
"""
if old not in s:
    raise SystemExit('No se encontró el bloque vCard esperado; no se modificó nada.')
s = s.replace(old, new, 1)
path.write_text(s)
print('✓ vCard: móvil abre directamente el VCF; escritorio conserva descarga.')
