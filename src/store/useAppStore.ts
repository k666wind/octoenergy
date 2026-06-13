import { create } from 'zustand'
import type {
  AppConfig,
  Language,
  Credentials,
  TariffConfig,
  AppCache,
  ConsumptionInterval,
  AgileRate,
  BudgetConfig,
  AgileAlertConfig,
  PropertyInfo,
} from '../types'

const STORAGE_KEY = 'octoenergy_config'
const CACHE_KEY = 'octoenergy_cache'
const CACHE_TTL_MS = 60 * 60 * 1000 // 1 hour

function loadConfig(): AppConfig | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as AppConfig
    // Migrate legacy configs missing optional fields
    if (!('budget' in parsed)) parsed.budget = undefined
    // Migrate legacy configs missing outgoing fields
    const rawCreds = parsed.credentials as any
    const rawTariff = parsed.tariff as any
    if (!('outgoing' in rawCreds)) rawCreds.outgoing = null
    if (!('outgoingType' in rawTariff)) {
      rawTariff.outgoingType = 'fixed'
      rawTariff.outgoingFixedRate = 0
    }
    return parsed
  } catch {
    return null
  }
}

function loadCache(): AppCache {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return { lastRefresh: null }
    return JSON.parse(raw) as AppCache
  } catch {
    return { lastRefresh: null }
  }
}

function saveConfig(config: AppConfig): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
}

function saveCache(cache: AppCache): void {
  localStorage.setItem(CACHE_KEY, JSON.stringify(cache))
}

interface AppState {
  config: AppConfig | null
  cache: AppCache
  isLoading: boolean
  error: string | null
  isSetupComplete: boolean

  // Actions
  setLanguage: (lang: Language) => void
  saveCredentials: (creds: Credentials) => void
  saveTariff: (tariff: TariffConfig) => void
  completeSetup: (creds: Credentials, tariff: TariffConfig) => void
  importSettings: (creds: Credentials, tariff: TariffConfig) => void
  resetAll: () => void

  setElectricityData: (data: ConsumptionInterval[]) => void
  setGasData: (data: ConsumptionInterval[]) => void
  setOutgoingData: (data: ConsumptionInterval[]) => void
  setAgileRates: (rates: AgileRate[]) => void
  setBudget: (budget: BudgetConfig | null) => void
  updateTariff: (tariff: TariffConfig) => void
  setLoading: (v: boolean) => void
  setError: (msg: string | null) => void
  setRangeElectricityData: (data: import('../types').ConsumptionInterval[]) => void
  setRangeGasData: (data: import('../types').ConsumptionInterval[]) => void
  justSetup: boolean
  setJustSetup: (v: boolean) => void
  isCacheStale: () => boolean
  touchRefresh: () => void
  setAgileAlert: (cfg: AgileAlertConfig | null) => void
  setProperties: (props: PropertyInfo[]) => void
  setSelectedProperty: (index: number) => void
}

const savedConfig = loadConfig()
const savedCache = loadCache()

export const useAppStore = create<AppState>((set, get) => ({
  config: savedConfig,
  cache: savedCache,
  isLoading: false,
  error: null,
  isSetupComplete: savedConfig !== null,
  justSetup: false,

  setLanguage: (lang) => {
    const config = get().config
    if (!config) return
    const updated = { ...config, language: lang }
    saveConfig(updated)
    set({ config: updated })
  },

  saveCredentials: (creds) => {
    const config = get().config
    if (!config) return
    const updated = { ...config, credentials: creds }
    saveConfig(updated)
    set({ config: updated })
  },

  saveTariff: (tariff) => {
    const config = get().config
    if (!config) return
    const updated = { ...config, tariff }
    saveConfig(updated)
    set({ config: updated })
  },

  completeSetup: (creds, tariff) => {
    const config: AppConfig = {
      version: '2.0',
      language: get().config?.language ?? 'en',
      credentials: creds,
      tariff,
    }
    saveConfig(config)
    set({ config, isSetupComplete: true, justSetup: true })
  },

  importSettings: (creds, tariff) => {
    const existing = get().config
    const config: AppConfig = {
      version: '2.0',
      language: existing?.language ?? 'en',
      credentials: creds,
      tariff,
    }
    saveConfig(config)
    // Clear old cache
    const freshCache: AppCache = { lastRefresh: null }
    saveCache(freshCache)
    set({ config, cache: freshCache, isSetupComplete: true })
  },

  resetAll: () => {
    localStorage.removeItem(STORAGE_KEY)
    localStorage.removeItem(CACHE_KEY)
    set({
      config: null,
      cache: { lastRefresh: null },
      isSetupComplete: false,
      error: null,
    })
  },

  setElectricityData: (data) => {
    const cache: AppCache = {
      ...get().cache,
      electricityConsumption: { data, fetchedAt: new Date().toISOString() },
    }
    saveCache(cache)
    set({ cache })
  },

  setGasData: (data) => {
    const cache: AppCache = {
      ...get().cache,
      gasConsumption: { data, fetchedAt: new Date().toISOString() },
    }
    saveCache(cache)
    set({ cache })
  },

  setOutgoingData: (data) => {
    const cache: AppCache = {
      ...get().cache,
      outgoingConsumption: { data, fetchedAt: new Date().toISOString() },
    }
    saveCache(cache)
    set({ cache })
  },

  setAgileRates: (rates) => {
    const cache: AppCache = {
      ...get().cache,
      agileRates: { data: rates, fetchedAt: new Date().toISOString() },
    }
    saveCache(cache)
    set({ cache })
  },

  setBudget: (budget) => {
    const config = get().config
    if (!config) return
    const updated = { ...config, budget: budget ?? undefined }
    saveConfig(updated)
    set({ config: updated })
  },

  updateTariff: (tariff) => {
    const config = get().config
    if (!config) return
    const updated = { ...config, tariff }
    saveConfig(updated)
    set({ config: updated })
  },

  setLoading: (v) => set({ isLoading: v }),
  setError: (msg) => set({ error: msg }),

  setRangeElectricityData: (data) => {
    const cache: AppCache = {
      ...get().cache,
      rangeElectricity: { data, fetchedAt: new Date().toISOString() },
    }
    set({ cache })
  },

  setRangeGasData: (data) => {
    const cache: AppCache = {
      ...get().cache,
      rangeGas: { data, fetchedAt: new Date().toISOString() },
    }
    set({ cache })
  },

  setJustSetup: (v) => set({ justSetup: v }),

  isCacheStale: () => {
    const { lastRefresh } = get().cache
    if (!lastRefresh) return true
    return Date.now() - new Date(lastRefresh).getTime() > CACHE_TTL_MS
  },

  touchRefresh: () => {
    const cache: AppCache = { ...get().cache, lastRefresh: new Date().toISOString() }
    saveCache(cache)
    set({ cache })
  },

  setAgileAlert: (cfg) => {
    const config = get().config
    if (!config) return
    const updated = { ...config, agileAlert: cfg ?? undefined }
    saveConfig(updated)
    set({ config: updated })
  },

  setProperties: (props) => {
    const config = get().config
    if (!config) return
    const updated = { ...config, properties: props }
    saveConfig(updated)
    set({ config: updated })
  },

  setSelectedProperty: (index) => {
    const config = get().config
    if (!config) return
    const props = config.properties
    if (!props || index < 0 || index >= props.length) return
    const prop = props[index]
    // Pick first non-export elec meter and first gas meter from the selected property
    const elecMeter = prop.electricity.find(e => !e.isExport) ?? prop.electricity[0]
    const gasMeter = prop.gas[0] ?? null
    const exportMeter = prop.electricity.find(e => e.isExport) ?? null
    const updatedCreds: Credentials = {
      ...config.credentials,
      electricity: elecMeter
        ? { mpan: elecMeter.mpan, serialNumber: elecMeter.serialNumber }
        : config.credentials.electricity,
      gas: gasMeter
        ? { mprn: gasMeter.mprn, serialNumber: gasMeter.serialNumber }
        : null,
      outgoing: exportMeter
        ? { mpan: exportMeter.mpan, serialNumber: exportMeter.serialNumber }
        : null,
    }
    const updated = { ...config, credentials: updatedCreds, selectedPropertyIndex: index }
    saveConfig(updated)
    // Clear cache so new meters are fetched fresh
    const freshCache: AppCache = { lastRefresh: null }
    saveCache(freshCache)
    set({ config: updated, cache: freshCache })
  },
}))
