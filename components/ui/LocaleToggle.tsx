'use client'

import { useState, useEffect } from 'react'
import { getLocaleFromCookie, setLocaleCookie, LOCALE_LABELS, type Locale } from '@/lib/i18n'

export default function LocaleToggle() {
  const [locale, setLocale] = useState<Locale>('en')

  useEffect(() => { setLocale(getLocaleFromCookie()) }, [])

  const toggle = () => {
    const next: Locale = locale === 'en' ? 'bn' : 'en'
    setLocaleCookie(next)
  }

  return (
    <button
      onClick={toggle}
      className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
      title="Switch language / ভাষা পরিবর্তন"
    >
      <span className="text-sm">{locale === 'en' ? '🇧🇩' : '🇬🇧'}</span>
      {locale === 'en' ? 'বাংলা' : 'English'}
    </button>
  )
}
