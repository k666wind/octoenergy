export type Language = 'en' | 'zh'
export type TariffType = 'fixed' | 'agile' | 'tracker'
export type FuelType = 'electricity' | 'gas'
export type GroupBy = 'halfhour' | 'day' | 'week' | 'month'
export type OutgoingTariffType = 'fixed' | 'agile_export'

// UK DNO region codes for Agile tariff URL construction
export type DnoRegion = 'A'|'B'|'C'|'D'|'E'|'F'|'G'|'H'|'J'|'K'|'L'|'M'|'N'|'P'

export interface ElectricityCredentials {
  mpan: string
  serialNumber: string
}

export interface GasCredentials {
  mprn: string
  serialNumber: string
}

export interface OutgoingCredentials {
  mpan: string
  serialNumber: string
}

export interface Credentials {
  apiKey: string
  accountNumber: string
  electricity: ElectricityCredentials
  gas: GasCredentials | null
  outgoing: OutgoingCredentials | null
}

export interface FixedRates {
  electricityUnitRate: number   // pence/kWh
  electricityStandingCharge: number // pence/day
  gasUnitRate: number           // pence/kWh
  gasStandingCharge: number     // pence/day
}

export interface TariffConfig {
  type: TariffType
  fixed: FixedRates
  outgoingType: OutgoingTariffType
  outgoingFixedRate: number     // p/kWh, used if outgoingType === 'fixed'
  dnoRegion?: DnoRegion         // for Agile tariff API calls
  agileProductCode?: string     // e.g. 'AGILE-24-10-01'
}

export interface BudgetConfig {
  monthlyLimitPounds: number    // 0 = disabled
}

export interface AppConfig {
  version: string
  language: Language
  credentials: Credentials
  tariff: TariffConfig
  budget?: BudgetConfig
}

export interface ConsumptionInterval {
  consumption: number           // kWh (elec) or m3 (gas SMETS2) or kWh (gas SMETS1)
  interval_start: string        // ISO
  interval_end: string          // ISO
}

export interface ConsumptionData {
  results: ConsumptionInterval[]
  count: number
}

export interface AgileRate {
  value_exc_vat: number
  value_inc_vat: number         // pence/kWh
  valid_from: string
  valid_to: string
}

export interface TariffRateData {
  results: AgileRate[]
}

export interface CacheEntry<T> {
  data: T
  fetchedAt: string             // ISO
}

export interface AppCache {
  electricityConsumption?: CacheEntry<ConsumptionInterval[]>
  gasConsumption?: CacheEntry<ConsumptionInterval[]>
  outgoingConsumption?: CacheEntry<ConsumptionInterval[]>
  agileRates?: CacheEntry<AgileRate[]>
  rangeElectricity?: CacheEntry<ConsumptionInterval[]>
  rangeGas?: CacheEntry<ConsumptionInterval[]>
  lastRefresh: string | null
}

export interface AccountMeterInfo {
  electricity: { mpan: string; serialNumber: string; isExport: boolean; tariffCode?: string }[]
  gas: { mprn: string; serialNumber: string }[]
}

export interface DailySummary {
  date: string                  // YYYY-MM-DD
  electricityKwh: number
  gasKwh: number
  electricityCost: number       // pence
  gasCost: number               // pence
}

export interface ExportData {
  exportVersion: string
  exportedAt: string
  credentials: Credentials
  tariff: TariffConfig
}
