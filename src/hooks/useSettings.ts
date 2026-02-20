import { useCallback, useEffect, useState } from 'react'

export interface AppSettings {
  notifyOnComplete: boolean
  thinkingLevel: 'off' | 'low' | 'medium' | 'high'
  defaultModel?: string
  defaultAgent?: string
  toolApprovalEnabled: boolean
}

const DEFAULT_SETTINGS: AppSettings = {
  notifyOnComplete: true,
  thinkingLevel: 'off',
  toolApprovalEnabled: false,
}

const STORE_KEY = 'appSettings'

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    window.api.store.get(STORE_KEY).then((stored) => {
      if (stored && typeof stored === 'object') {
        setSettings({ ...DEFAULT_SETTINGS, ...(stored as Partial<AppSettings>) })
      }
      setLoaded(true)
    }).catch((err) => {
      console.error('[useSettings] Failed to load settings:', err)
      setLoaded(true)
    })
  }, [])

  const updateSetting = useCallback(<K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setSettings((prev) => {
      const next = { ...prev, [key]: value }
      window.api.store.set(STORE_KEY, next).catch((err) =>
        console.error('[useSettings] Failed to save:', err)
      )
      return next
    })
  }, [])

  return { settings, updateSetting, loaded }
}
