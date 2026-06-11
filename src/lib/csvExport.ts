import type { ConsumptionInterval, TariffConfig, AgileRate } from '../types'
import { gasToKwh, calcElecCost, calcGasCost } from './costCalculator'

interface CsvRow {
  period_start: string
  period_end: string
  electricity_kwh: string
  electricity_cost_pence: string
  gas_kwh: string
  gas_cost_pence: string
}

export function exportTrendsCsv(
  elecIntervals: ConsumptionInterval[],
  gasIntervals: ConsumptionInterval[],
  tariff: TariffConfig,
  agileRates: AgileRate[],
  filename: string
): void {
  // Build a map of 30-min slots keyed by interval_start
  const elecMap = new Map<string, ConsumptionInterval>()
  for (const i of elecIntervals) elecMap.set(i.interval_start, i)

  const gasMap = new Map<string, ConsumptionInterval>()
  for (const i of gasIntervals) gasMap.set(i.interval_start, i)

  const allKeys = Array.from(
    new Set([...elecMap.keys(), ...gasMap.keys()])
  ).sort()

  const rows: CsvRow[] = allKeys.map(key => {
    const elec = elecMap.get(key)
    const gas = gasMap.get(key)

    const elecKwh = elec?.consumption ?? 0
    const gasKwh = gas ? gasToKwh(gas.consumption) : 0

    const elecCost = elec
      ? calcElecCost([elec], tariff, agileRates)
      : 0
    const gasCost = gas
      ? calcGasCost([gas], tariff)
      : 0

    return {
      period_start: key,
      period_end: elec?.interval_end ?? gas?.interval_end ?? '',
      electricity_kwh: elecKwh.toFixed(4),
      electricity_cost_pence: elecCost.toFixed(4),
      gas_kwh: gasKwh.toFixed(4),
      gas_cost_pence: gasCost.toFixed(4),
    }
  })

  const header = 'period_start,period_end,electricity_kwh,electricity_cost_pence,gas_kwh,gas_cost_pence'
  const body = rows.map(r =>
    `${r.period_start},${r.period_end},${r.electricity_kwh},${r.electricity_cost_pence},${r.gas_kwh},${r.gas_cost_pence}`
  ).join('\n')

  const csv = header + '\n' + body
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
