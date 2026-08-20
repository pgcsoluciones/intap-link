export type ProfileLanguageCode = 'es' | 'en'

export type ProfileLanguagePolicy = {
  defaultLanguage: ProfileLanguageCode
  enabled: ProfileLanguageCode[]
}

type LanguageFallback = {
  defaultLanguage?: ProfileLanguageCode
  enabled?: readonly ProfileLanguageCode[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(
    value &&
    typeof value === 'object' &&
    !Array.isArray(value),
  )
}

function isProfileLanguageCode(
  value: unknown,
): value is ProfileLanguageCode {
  return value === 'es' || value === 'en'
}

/**
 * Convención reusable para perfiles INTAP LINK.
 *
 * template_data puede incluir:
 *
 * {
 *   "languages": {
 *     "default": "es",
 *     "enabled": ["es", "en"]
 *   },
 *   "translations": {
 *     "en": {
 *       "headline": "...",
 *       "about": "..."
 *     }
 *   }
 * }
 *
 * No requiere columnas ni migraciones nuevas.
 */
export function resolveProfileLanguagePolicy(
  templateData: unknown,
  fallback: LanguageFallback = {},
): ProfileLanguagePolicy {
  const root = isRecord(templateData)
    ? templateData
    : {}

  const languages = isRecord(root.languages)
    ? root.languages
    : {}

  const configuredEnabled =
    Array.isArray(languages.enabled)
      ? languages.enabled.filter(isProfileLanguageCode)
      : []

  const fallbackEnabled = (
    fallback.enabled ?? ['es']
  ).filter(isProfileLanguageCode)

  const sourceEnabled =
    configuredEnabled.length > 0
      ? configuredEnabled
      : fallbackEnabled

  const enabled = Array.from(
    new Set<ProfileLanguageCode>(sourceEnabled),
  )

  const configuredDefault =
    isProfileLanguageCode(languages.default)
      ? languages.default
      : undefined

  const defaultLanguage =
    configuredDefault ??
    fallback.defaultLanguage ??
    'es'

  if (!enabled.includes(defaultLanguage)) {
    enabled.unshift(defaultLanguage)
  }

  return {
    defaultLanguage,
    enabled,
  }
}

export function resolveRequestedProfileLanguage(
  search: string,
  policy: ProfileLanguagePolicy,
): ProfileLanguageCode {
  const requested =
    new URLSearchParams(search).get('lang')

  return (
    isProfileLanguageCode(requested) &&
    policy.enabled.includes(requested)
  )
    ? requested
    : policy.defaultLanguage
}

export function getProfileTranslation(
  templateData: unknown,
  language: ProfileLanguageCode,
): Record<string, unknown> {
  const root = isRecord(templateData)
    ? templateData
    : {}

  const translations = isRecord(root.translations)
    ? root.translations
    : {}

  const translation =
    translations[language]

  return isRecord(translation)
    ? translation
    : {}
}
