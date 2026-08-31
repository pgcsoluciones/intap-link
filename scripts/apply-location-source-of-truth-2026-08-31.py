from pathlib import Path


def replace_exact(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f'No se encontró el bloque esperado en {path}')
    p.write_text(text.replace(old, new, 1))
    print(f'✓ actualizado {path}')


replace_exact(
    'app/src/components/admin/free/FreeQuickActions.tsx',
    """  useEffect(() => {\n    apiGet('/me/free/quick-actions').then((json: any) => {\n      if (!json?.ok) return setError(json?.error || 'No pudimos cargar tus botones de contacto.')\n      const data = (json.data || {}) as QuickActionsPayload\n      setSelected((data.selected || []).map((item) => item.type).slice(0, MAX_SELECTED))\n      const nextValues: Partial<Record<QuickActionType, string>> = {}\n      OPTIONS.forEach((option) => {\n        const stored = data.values?.[option.type] || data.selected?.find((item) => item.type === option.type)?.url || ''\n        nextValues[option.type] = displayValue(option.type, stored)\n      })\n      setValues(nextValues)\n    }).catch(() => setError('No pudimos cargar tus accesos rápidos.')).finally(() => setLoading(false))\n  }, [])\n""",
    """  useEffect(() => {\n    Promise.all([apiGet('/me/free/quick-actions'), apiGet('/me/contact')]).then(([json, contactJson]: any[]) => {\n      if (!json?.ok) return setError(json?.error || 'No pudimos cargar tus botones de contacto.')\n      const data = (json.data || {}) as QuickActionsPayload\n      const canonicalMapUrl = contactJson?.ok ? String(contactJson.data?.map_url || '').trim() : ''\n      setSelected((data.selected || []).map((item) => item.type).slice(0, MAX_SELECTED))\n      const nextValues: Partial<Record<QuickActionType, string>> = {}\n      OPTIONS.forEach((option) => {\n        const stored = option.type === 'location' && canonicalMapUrl\n          ? canonicalMapUrl\n          : data.values?.[option.type] || data.selected?.find((item) => item.type === option.type)?.url || ''\n        nextValues[option.type] = displayValue(option.type, stored)\n      })\n      setValues(nextValues)\n    }).catch(() => setError('No pudimos cargar tus accesos rápidos.')).finally(() => setLoading(false))\n  }, [])\n""",
)

replace_exact(
    'app/src/components/admin/free/FreeQuickActions.tsx',
    """    const items = selected.map((type) => ({ type, url: normalizeActionUrl(type, values[type] || '') }))\n    setSaving(true)\n    try {\n      const json: any = await apiPut('/me/free/quick-actions', { items })\n""",
    """    setSaving(true)\n    try {\n      const contactJson: any = selected.includes('location') ? await apiGet('/me/contact') : null\n      const canonicalMapUrl = contactJson?.ok ? String(contactJson.data?.map_url || '').trim() : ''\n      const items = selected.map((type) => ({\n        type,\n        url: normalizeActionUrl(type, type === 'location' && canonicalMapUrl ? canonicalMapUrl : values[type] || ''),\n      }))\n      const json: any = await apiPut('/me/free/quick-actions', { items })\n""",
)

replace_exact(
    'web/src/components/free-profile/IntapLinkGratis.adapter.ts',
    """    const url = readString(link, 'url')\n    if (!url) return null\n    return { type, label: QUICK_ACTION_LABELS[type], url, sortOrder: Number(link.sort_order ?? link.sortOrder ?? 999) }\n""",
    """    const storedUrl = readString(link, 'url')\n    const url = type === 'location' && location ? location : storedUrl\n    if (!url) return null\n    return { type, label: QUICK_ACTION_LABELS[type], url, sortOrder: Number(link.sort_order ?? link.sortOrder ?? 999) }\n""",
)

replace_exact(
    'web/src/components/free-profile/IntapLinkGratis.adapter.ts',
    """  const realLocation = findSocialUrl(socialLinks, 'free_location') || readString(contact, 'map_url') || mapLink\n""",
    """  // La ubicación configurada en profile_contact es la fuente canónica.\n  // Los social_links solo conservan la selección/orden del botón, no una coordenada paralela.\n  const realLocation = readString(contact, 'map_url') || findSocialUrl(socialLinks, 'location') || findSocialUrl(socialLinks, 'free_location') || mapLink\n""",
)

print('✓ parche de ubicación canónica aplicado')
