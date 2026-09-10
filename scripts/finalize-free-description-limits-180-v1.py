#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def replace_exact(path: str, old: str, new: str, expected: int = 1) -> None:
    file = ROOT / path
    text = file.read_text()
    count = text.count(old)
    if count != expected:
        raise SystemExit(f"{path}: esperado {expected} ocurrencias de {old!r}, encontradas {count}")
    file.write_text(text.replace(old, new))
    print(f"✓ {path}: {count} reemplazo(s)")


def replace_optional(path: str, old: str, new: str) -> None:
    file = ROOT / path
    text = file.read_text()
    count = text.count(old)
    if count:
        file.write_text(text.replace(old, new))
        print(f"✓ {path}: {count} reemplazo(s) opcional(es)")
    else:
        print(f"✓ {path}: texto informativo opcional no presente; se continúa")


# Asistente IA: validación, lectura del contexto, límites comunicados al modelo y copy editorial.
replace_exact(
    'api/src/ai-profile-assistant.ts',
    'description: strictText(item?.description, 90)',
    'description: strictText(item?.description, 180)',
    expected=2,
)
replace_exact(
    'api/src/ai-profile-assistant.ts',
    'description: text(row.description, 90)',
    'description: text(row.description, 180)',
    expected=2,
)
replace_exact(
    'api/src/ai-profile-assistant.ts',
    'portfolio_description: 90',
    'portfolio_description: 180',
)
replace_exact(
    'api/src/ai-profile-assistant.ts',
    'service_description: 90',
    'service_description: 180',
)
replace_exact(
    'api/src/ai-profile-assistant.ts',
    'portafolio máximo 5, título 80 y descripción 90; servicios máximo 3, título 60 y descripción 90;',
    'portafolio máximo 5, título 80 y descripción 180; servicios máximo 3, título 60 y descripción 180;',
)

# Revisión editable de la propuesta IA en el panel Free.
replace_exact(
    'app/src/components/admin/free/FreeAiProfileAssistant.tsx',
    'e.target.value.slice(0,90)',
    'e.target.value.slice(0,180)',
    expected=2,
)
replace_exact(
    'app/src/components/admin/free/FreeAiProfileAssistant.tsx',
    'maxLength={90}',
    'maxLength={180}',
    expected=1,
)
# Este texto explicativo no está presente en todas las revisiones del componente.
# No debe bloquear el cierre si no existe.
replace_optional(
    'app/src/components/admin/free/FreeAiProfileAssistant.tsx',
    'Título 80 caracteres y descripción 90.',
    'Título 80 caracteres y descripción 180.',
)

# QA y documentación canónica.
replace_exact(
    'scripts/qa-demo-ai-preview.mjs',
    'service.description.length <= 90',
    'service.description.length <= 180',
)
replace_exact(
    'scripts/qa-demo-ai-preview.mjs',
    'service desc <=90',
    'service desc <=180',
)
replace_exact(
    'scripts/test-ai-profile-canonical-limits.mjs',
    'const DESCRIPTION_LIMIT = 90',
    'const DESCRIPTION_LIMIT = 180',
    expected=2,
)
replace_exact(
    'docs/KAWVO_AI_PROFILE_CANONICAL_FIELDS.md',
    'Descripción de cada trabajo: máximo 90 caracteres',
    'Descripción de cada trabajo: máximo 180 caracteres',
)
replace_exact(
    'docs/KAWVO_AI_PROFILE_CANONICAL_FIELDS.md',
    'Descripción por servicio: máximo 90 caracteres.',
    'Descripción por servicio: máximo 180 caracteres.',
)

# Verificaciones de los puntos runtime ya corregidos previamente.
checks = {
    'app/src/components/admin/free/FreePortfolio.tsx': ['const DESCRIPTION_LIMIT = 180'],
    'app/src/components/admin/free/FreeServices.tsx': ['const DESCRIPTION_LIMIT = 180', 'const SECTION_DESCRIPTION_LIMIT = 240'],
    'web/src/components/free-profile/IntapLinkGratis.adapter.ts': [
        "description: readString(item, 'description').slice(0, 180)",
        ").slice(0, 180)",
        "description: service.description.slice(0, 180)",
    ],
    'api/src/routes/demo-ai.ts': ['description: clean(item?.description, 180)', 'service_description: 180'],
    'web/src/components/free-profile/IntapLinkGratis.experience.ts': [
        "name: 'Kawvo'",
        "accent: '#0B61C9'",
        "button: '#0B61C9'",
    ],
    'web/src/components/free-profile/IntapLinkGratisProfile.tsx': [
        'function readableText(background: string)',
        "const onAction = readableText(action)",
        "'--ilx-on-action': onAction",
    ],
    'web/src/components/free-profile/IntapLinkGratisRebuilt.css': [
        'background:\n    var(--ilx-action);',
        'color: #fff;',
    ],
}
for path, needles in checks.items():
    text = (ROOT / path).read_text()
    for needle in needles:
        if needle not in text:
            raise SystemExit(f'{path}: falta verificación {needle!r}')

# Barrera: no permitir que los editores/runtime principales vuelvan a limitar
# descripciones de servicios/portafolio a 90.
critical_files = [
    'app/src/components/admin/free/FreePortfolio.tsx',
    'app/src/components/admin/free/FreeServices.tsx',
    'app/src/components/admin/free/FreeAiProfileAssistant.tsx',
    'web/src/components/free-profile/IntapLinkGratis.adapter.ts',
    'api/src/ai-profile-assistant.ts',
    'api/src/routes/demo-ai.ts',
]
for path in critical_files:
    text = (ROOT / path).read_text()
    suspicious = [
        'description, 90)',
        'description: 90',
        'description 90',
        'slice(0,90)',
        'slice(0, 90)',
        'maxLength={90}',
    ]
    hits = [needle for needle in suspicious if needle in text]
    if hits:
        raise SystemExit(f'{path}: todavía contiene límites de descripción 90: {hits}')

print('\n✓ Cierre 180 validado: Portafolio y Servicios no se recortan por debajo de 180 en los flujos Free principales.')
print('✓ Los límites superiores (bio 300, sección Servicios 240, etc.) permanecen sin reducirse.')
print('✓ Paleta base Kawvo: azul, blanco y negro; verde queda fuera del preset principal.')
print('✓ Contraste: botones de acción oscuros usan texto/iconos claros mediante --ilx-on-action; CTA principal permanece blanco.')
