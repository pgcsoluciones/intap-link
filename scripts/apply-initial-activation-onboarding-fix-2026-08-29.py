from pathlib import Path


def replace_once(path: str, old: str, new: str, label: str) -> None:
    p = Path(path)
    text = p.read_text()
    if new in text:
        print(f'· {label}: ya aplicado')
        return
    if old not in text:
        raise SystemExit(f'No encontré patrón esperado para {label} en {path}')
    p.write_text(text.replace(old, new, 1))
    print(f'✓ {label}')

# Flujo principal de activación por escaneo: una primera activación no debe saltarse onboarding.
replace_once(
    'app/src/components/admin/ScanActivationEntry.tsx',
    """    clearCode()\n    const nextUrl = String(result.data?.next_url || '')\n    if (nextUrl) {\n      window.location.assign(nextUrl)\n      return\n    }\n    navigate('/admin/free', { replace: true })\n""",
    """    clearCode()\n    await apiPost('/me/notifications/welcome', {}).catch(() => undefined)\n\n    const meAfterActivation: any = await apiGet('/me').catch(() => ({ ok: false }))\n    const hasActivity = Boolean(\n      meAfterActivation?.ok &&\n      String(meAfterActivation.data?.category || '').trim() &&\n      String(meAfterActivation.data?.subcategory || '').trim()\n    )\n\n    // En la primera activación el perfil base recién creado todavía no tiene\n    // actividad/subcategoría. Ese caso debe entrar al onboarding guiado.\n    if (!hasActivity) {\n      navigate('/admin/free/onboarding/intro', { replace: true })\n      return\n    }\n\n    // Si el usuario ya tenía un perfil configurado y solo agregó otro producto,\n    // respetamos el destino normal sin obligarlo a repetir onboarding.\n    const nextUrl = String(result.data?.next_url || '')\n    if (nextUrl) {\n      window.location.assign(nextUrl)\n      return\n    }\n    navigate('/admin/free', { replace: true })\n""",
    'Scan activation: primera activación entra a onboarding',
)

# Flujo alterno /admin/artifacts/activate (scan): misma regla.
replace_once(
    'app/src/components/admin/free/onboarding/FreeArtifactActivation.tsx',
    """      sessionStorage.setItem('kawvo_free_artifact_activated', activatedCode)\n      await apiPost('/me/notifications/welcome', {}).catch(() => undefined)\n      navigate('/admin/free', { replace: true })\n      return\n""",
    """      sessionStorage.setItem('kawvo_free_artifact_activated', activatedCode)\n      await apiPost('/me/notifications/welcome', {}).catch(() => undefined)\n\n      const meAfterActivation: any = await apiGet('/me').catch(() => ({ ok: false }))\n      const hasActivity = Boolean(\n        meAfterActivation?.ok &&\n        String(meAfterActivation.data?.category || '').trim() &&\n        String(meAfterActivation.data?.subcategory || '').trim()\n      )\n      navigate(hasActivity ? '/admin/free' : '/admin/free/onboarding/intro', { replace: true })\n      return\n""",
    'Artifact activation scan: primera activación entra a onboarding',
)

# Flujo legacy: evita repetir onboarding a usuarios ya configurados, pero lo exige en alta inicial.
replace_once(
    'app/src/components/admin/free/onboarding/FreeArtifactActivation.tsx',
    """    sessionStorage.removeItem(PENDING_PUBLIC_CODE)\n    sessionStorage.setItem('kawvo_free_artifact_activated', result.data?.public_code || product.public_code)\n    await apiPost('/me/notifications/welcome', {}).catch(() => undefined)\n    navigate('/admin/free/onboarding/intro', { replace: true })\n""",
    """    sessionStorage.removeItem(PENDING_PUBLIC_CODE)\n    sessionStorage.setItem('kawvo_free_artifact_activated', result.data?.public_code || product.public_code)\n    await apiPost('/me/notifications/welcome', {}).catch(() => undefined)\n\n    const meAfterActivation: any = await apiGet('/me').catch(() => ({ ok: false }))\n    const hasActivity = Boolean(\n      meAfterActivation?.ok &&\n      String(meAfterActivation.data?.category || '').trim() &&\n      String(meAfterActivation.data?.subcategory || '').trim()\n    )\n    navigate(hasActivity ? '/admin/free' : '/admin/free/onboarding/intro', { replace: true })\n""",
    'Artifact activation legacy: onboarding solo cuando corresponde',
)

print('✓ Fix de onboarding posterior a activación preparado.')
