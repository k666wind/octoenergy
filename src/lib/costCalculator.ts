import type { ConsumptionInterval, TariffConfig, AgileRate } from '../types'

// Gas: SMETS2 meters report m3, need to convert to kWh
// Rough conversion: 1 m3 ≈ 11.1 kWh (varies by calorific value)
const GAS_M3_TO_KWH = 11.1

export function gasToKwh(value: number, unit: 'm3' | 'kwh' = 'm3'): number {
  return unit === 'm3' ? value * GAS_M3_TO_KWH : value
}

export function totalKwh(intervals: ConsumptionInterval[]): number {
  return intervals.reduce((sum, i) => sum + i.consumption, 0)
}

// Fixed tariff cost in pence
export function fixedCost(
  kwh: number,
  unitRatePence: number,
  standingChargePence = 0
): number {
  return kwh * unitRatePence + standingChargePence
}

// Agile/Tracker: match each interval to its rate
export function agileCost(
  intervals: ConsumptionInterval[],
  rates: AgileRate[]
): number {
  // Pre-convert to epoch ms — API may return Z or +00:00; string compare fails
  const ratesMs = rates.map(r => ({
    fromMs: new Date(r.valid_from).getTime(),
    toMs: r.valid_to ? new Date(r.valid_to).getTime() : Infinity,
    value: r.value_inc_vat,
  }))
  return intervals.reduce((sum, interval) => {
    const startMs = new Date(interval.interval_start).getTime()
    const endMs = new Date(interval.interval_end).getTime()
    const rate = ratesMs.find(r => r.fromMs <= startMs && r.toMs >= endMs)
    if (!rate) return sum
    return sum + interval.consumption * rate.value
  }, 0)
}

// Count unique UK calendar days in a set of intervals
function toUkDate(isoStr: string): string {
  return new Date(isoStr).toLocaleDateString('en-GB', {
    timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit',
  }).split('/').reverse().join('-')
}
export function uniqueDaysCount(intervals: ConsumptionInterval[]): number {
  return new Set(intervals.map(i => toUkDate(i.interval_start))).size
}

export function calcElecCost(
  intervals: ConsumptionInterval[],
  tariff: TariffConfig,
  agileRates: AgileRate[] = [],
  includeStanding = false
): number {
  const kwh = totalKwh(intervals)
  if (tariff.type === 'fixed') {
    const days = includeStanding ? uniqueDaysCount(intervals) : 0
    const standing = days * tariff.fixed.electricityStandingCharge
    return fixedCost(kwh, tariff.fixed.electricityUnitRate, standing)
  }
  const unitCost = agileCost(intervals, agileRates)
  if (includeStanding) {
    const days = uniqueDaysCount(intervals)
    return unitCost + days * tariff.fixed.electricityStandingCharge
  }
  return unitCost
}

export function calcGasCost(
  intervals: ConsumptionInterval[],
  tariff: TariffConfig,
  includeStanding = false
): number {
  const kwh = intervals.reduce((sum, i) => sum + gasToKwh(i.consumption), 0)
  if (tariff.type === 'fixed') {
    const days = includeStanding ? uniqueDaysCount(intervals) : 0
    const standing = days * tariff.fixed.gasStandingCharge
    return fixedCost(kwh, tariff.fixed.gasUnitRate, standing)
  }
  return 0 // Agile gas not offered by Octopus
}

export function penceToPounds(pence: number): string {
  return (pence / 100).toFixed(2)
}

export function formatKwh(kwh: number): string {
  return kwh.toFixed(2)
}

// Group intervals by calendar day
export function groupByDay(
  intervals: ConsumptionInterval[]
): Record<string, ConsumptionInterval[]> {
  const groups: Record<string, ConsumptionInterval[]> = {}
  for (const interval of intervals) {
    const day = toUkDate(interval.interval_start)
    if (!groups[day]) groups[day] = []
    groups[day].push(interval)
  }
  return groups
}

// Group by ISO week (Monday start)
// Use UTC date to avoid local timezone shifting day boundaries.
export function groupByWeek(
  intervals: ConsumptionInterval[]
): Record<string, ConsumptionInterval[]> {
  const groups: Record<string, ConsumptionInterval[]> = {}
  for (const interval of intervals) {
    // Octopus returns UTC ISO strings — parse as UTC to preserve correct date
    const d = new Date(interval.interval_start)
    const dayOfWeek = d.getUTCDay() // 0=Sun, 1=Mon … 6=Sat
    const daysToMonday = (dayOfWeek + 6) % 7   // Mon=0, Tue=1, … Sun=6
    const monday = new Date(d)
    monday.setUTCDate(d.getUTCDate() - daysToMonday)
    const key = monday.toISOString().slice(0, 10) // YYYY-MM-DD of that Monday
    if (!groups[key]) groups[key] = []
    groups[key].push(interval)
  }
  return groups
}

// Group by UK local month
export function groupByMonth(
  intervals: ConsumptionInterval[]
): Record<string, ConsumptionInterval[]> {
  const groups: Record<string, ConsumptionInterval[]> = {}
  for (const interval of intervals) {
    const key = toUkDate(interval.interval_start).slice(0, 7) // YYYY-MM in UK time
    if (!groups[key]) groups[key] = []
    groups[key].push(interval)
  }
  return groups
}

export function calcOutgoingEarnings(
  intervals: ConsumptionInterval[],
  exportRatePence: number
): number {
  const kwh = totalKwh(intervals)
  return kwh * exportRatePence
}
