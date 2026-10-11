/**
 * Locale cookie helpers — used by the language toggle button.
 * Guard screens default to 'bn' (Bangla).
 * Resident/Admin screens default to 'en'.
 */
export const SUPPORTED_LOCALES = ['en', 'bn'] as const
export type Locale = (typeof SUPPORTED_LOCALES)[number]

export const LOCALE_LABELS: Record<Locale, string> = {
  en: 'English',
  bn: 'বাংলা',
}

export function getLocaleFromCookie(): Locale {
  if (typeof document === 'undefined') return 'en'
  const match = document.cookie.match(/(?:^|;\s*)locale=([^;]*)/)
  const val = match?.[1]
  return (val && SUPPORTED_LOCALES.includes(val as Locale)) ? (val as Locale) : 'en'
}

export function setLocaleCookie(locale: Locale) {
  document.cookie = `locale=${locale}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`
  window.location.reload()
}
