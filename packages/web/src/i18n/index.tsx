import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import zh from './zh'
import en from './en'

export type Locale = 'zh' | 'en'
type MessageKey = keyof typeof zh
type Messages = Record<MessageKey, string>

const locales: Record<Locale, Messages> = { zh, en }

interface I18nContextValue {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (key: MessageKey) => string
}

const I18nContext = createContext<I18nContextValue>({
  locale: 'zh',
  setLocale: () => {},
  t: (key) => key,
})

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    return (localStorage.getItem('bv-locale') as Locale) || 'zh'
  })

  const setLocale = useCallback((l: Locale) => {
    localStorage.setItem('bv-locale', l)
    setLocaleState(l)
  }, [])

  const t = useCallback((key: MessageKey): string => {
    return locales[locale][key] ?? key
  }, [locale])

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useI18n() {
  return useContext(I18nContext)
}
