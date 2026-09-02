#!/usr/bin/env python3
from pathlib import Path

path = Path('app/src/components/admin/free/FreeAccount.tsx')
text = path.read_text()

old = "  const publicUrl = me?.slug ? `${webUrl}/${me.slug}` : ''\n"
new = "  const publicUrl = me?.slug ? `${webUrl}/${me.slug}` : ''\n  const pwaInstallUrl = `${window.location.origin}/admin/free/home`\n"
if old not in text:
    raise SystemExit('No pude insertar pwaInstallUrl')
text = text.replace(old, new, 1)

old_modal = '''            <p className="mt-4 text-sm leading-6 text-slate-600">En iPhone o iPad, abre el menú Compartir del navegador y elige <strong>Agregar a pantalla de inicio</strong>.</p>
            <p className="mt-3 text-sm leading-6 text-slate-500">En Android, abre el menú del navegador y selecciona <strong>Instalar aplicación</strong> o <strong>Agregar a pantalla principal</strong>.</p>'''
new_modal = '''            <p className="mt-4 text-sm leading-6 text-slate-600">Abre esta dirección en el navegador del dispositivo donde quieres instalar Kawvo:</p>
            <a href={pwaInstallUrl} className="mt-2 block break-all rounded-xl bg-slate-50 px-3 py-3 text-sm font-bold text-cyan-700 underline">{pwaInstallUrl}</a>
            <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">
              <p><strong>iPhone o iPad · Safari</strong></p>
              <p>1. Abre el enlace de arriba en Safari.</p>
              <p>2. Toca el botón <strong>Compartir</strong>: es el icono de un cuadrado con una flecha hacia arriba, normalmente en la barra inferior o superior de Safari.</p>
              <p>3. Desliza las opciones y toca <strong>Agregar a pantalla de inicio</strong>.</p>
              <p>4. Confirma tocando <strong>Agregar</strong>.</p>
            </div>
            <div className="mt-3 rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">
              <p><strong>Android · Chrome</strong></p>
              <p>1. Abre el enlace de arriba en Chrome.</p>
              <p>2. Toca el menú de <strong>tres puntos (⋮)</strong>, normalmente arriba a la derecha.</p>
              <p>3. Toca <strong>Instalar aplicación</strong> o <strong>Agregar a pantalla principal</strong>.</p>
              <p>4. Confirma la instalación.</p>
            </div>'''
if old_modal not in text:
    raise SystemExit('No pude localizar instrucciones PWA existentes')
text = text.replace(old_modal, new_modal, 1)

path.write_text(text)
print('✓ URL de instalación e instrucciones guiadas PWA añadidas')
