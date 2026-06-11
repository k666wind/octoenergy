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
  return intervals.reduce((sum, interval) => {
    const rate = rates.find(
      (r) =>
        r.valid_from <= interval.interval_start &&
        (!r.valid_to || r.valid_to >= interval.interval_end)
    )
    if (!rate) return sum
    return sum + interval.consumption * rate.value_inc_vat
  }, 0)
}

// Count unique calendar days represented in a set of intervals
export function uniqueDaysCount(intervals: ConsumptionInterval[]): number {
  return new Set(intervals.map(i => i.interval_start.slice(0, 10))).size
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
    const day = interval.interval_start.slice(0, 10)
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

// Group by month
export function groupByMonth(
  intervals: ConsumptionInterval[]
): Record<string, ConsumptionInterval[]> {
  const groups: Record<string, ConsumptionInterval[]> = {}
  for (const interval of intervals) {
    const key = interval.interval_start.slice(0, 7) // YYYY-MM
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
