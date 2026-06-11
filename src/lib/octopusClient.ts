import type {
  ConsumptionInterval,
  AgileRate,
  Credentials,
  GroupBy,
} from '../types'

const BASE = 'https://api.octopus.energy/v1'

function authHeader(apiKey: string): HeadersInit {
  return {
    Authorization: 'Basic ' + btoa(apiKey + ':'),
  }
}

export async function fetchElectricityConsumption(
  creds: Credentials,
  periodFrom: string,
  periodTo: string,
  groupBy: GroupBy = 'halfhour'
): Promise<ConsumptionInterval[]> {
  const { apiKey, electricity } = creds
  const params = new URLSearchParams({
    period_from: periodFrom,
    period_to: periodTo,
    page_size: '25000',
    order_by: 'period',
  })
  if (groupBy !== 'halfhour') params.set('group_by', groupBy)

  const url = `${BASE}/electricity-meter-points/${electricity.mpan}/meters/${electricity.serialNumber}/consumption/?${params}`
  const res = await fetch(url, { headers: authHeader(apiKey) })
  if (!res.ok) throw new Error(`Electricity API error: ${res.status}`)
  const json = await res.json()
  return json.results as ConsumptionInterval[]
}

export async function fetchGasConsumption(
  creds: Credentials,
  periodFrom: string,
  periodTo: string,
  groupBy: GroupBy = 'halfhour'
): Promise<ConsumptionInterval[]> {
  if (!creds.gas) return []
  const { apiKey, gas } = creds
  const params = new URLSearchParams({
    period_from: periodFrom,
    period_to: periodTo,
    page_size: '25000',
    order_by: 'period',
  })
  if (groupBy !== 'halfhour') params.set('group_by', groupBy)

  const url = `${BASE}/gas-meter-points/${gas.mprn}/meters/${gas.serialNumber}/consumption/?${params}`
  const res = await fetch(url, { headers: authHeader(apiKey) })
  if (!res.ok) throw new Error(`Gas API error: ${res.status}`)
  const json = await res.json()
  return json.results as ConsumptionInterval[]
}

// Fetch Agile half-hourly rates.
// productCode e.g. 'AGILE-24-10-01', region e.g. 'C' (London)
// Falls back to region C if not provided.
export async function fetchAgileRates(
  productCode: string,
  periodFrom: string,
  periodTo: string,
  region = 'C'
): Promise<AgileRate[]> {
  const tariffCode = `E-1R-${productCode}-${region}`
  const params = new URLSearchParams({
    period_from: periodFrom,
    period_to: periodTo,
    page_size: '1500',
    order_by: 'period',
  })
  const url = `${BASE}/products/${productCode}/electricity-tariffs/${tariffCode}/standard-unit-rates/?${params}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Agile rates API error: ${res.status}`)
  const json = await res.json()
  return (json.results ?? []) as AgileRate[]
}

// Fetch average Agile rates over the last N days (for cost comparison)
export async function fetchAgileRatesForPeriod(
  productCode: string,
  region: string,
  days = 30
): Promise<AgileRate[]> {
  const to = new Date()
  const from = new Date()
  from.setDate(from.getDate() - days)
  return fetchAgileRates(productCode, from.toISOString(), to.toISOString(), region)
}

// Look up available Agile products (for auto-detect)
export async function fetchLatestAgileProduct(): Promise<string | null> {
  try {
    const url = `${BASE}/products/?brand=OCTOPUS_ENERGY&is_variable=true&is_business=false`
    const res = await fetch(url)
    if (!res.ok) return null
    const json = await res.json()
    const agile = (json.results as Array<{ code: string; display_name: string }>)
      .find(p => p.code.startsWith('AGILE-') && !p.code.includes('OUTGOING'))
    return agile?.code ?? null
  } catch {
    return null
  }
}

// Validate API key by fetching account info
export async function validateCredentials(creds: Credentials): Promise<boolean> {
  try {
    const res = await fetch(`${BASE}/accounts/${creds.accountNumber}/`, {
      headers: authHeader(creds.apiKey),
    })
    return res.ok
  } catch {
    return false
  }
}

export async function fetchAccountMeters(
  apiKey: string,
  accountNumber: string
): Promise<import('../types').AccountMeterInfo> {
  const res = await fetch(`${BASE}/accounts/${accountNumber}/`, {
    headers: authHeader(apiKey),
  })
  if (!res.ok) throw new Error(`Account API error: ${res.status}`)
  const json = await res.json()

  const elecPoints: { mpan: string; serialNumber: string; isExport: boolean; tariffCode?: string }[] = []
  const gasPoints: { mprn: string; serialNumber: string }[] = []

  for (const prop of json.properties ?? []) {
    for (const ep of prop.electricity_meter_points ?? []) {
      const latestAgreement = (ep.agreements ?? []).find((a: { valid_to: string | null }) => !a.valid_to)
      for (const meter of ep.meters ?? []) {
        elecPoints.push({
          mpan: ep.mpan,
          serialNumber: meter.serial_number,
          isExport: meter.is_export ?? false,
          tariffCode: latestAgreement?.tariff_code,
        })
      }
    }
    for (const gp of prop.gas_meter_points ?? []) {
      for (const meter of gp.meters ?? []) {
        gasPoints.push({ mprn: gp.mprn, serialNumber: meter.serial_number })
      }
    }
  }

  return { electricity: elecPoints, gas: gasPoints }
}

export async function fetchOutgoingConsumption(
  creds: Credentials,
  periodFrom: string,
  periodTo: string,
  groupBy: GroupBy = 'halfhour'
): Promise<ConsumptionInterval[]> {
  if (!creds.outgoing) return []
  const { apiKey, outgoing } = creds
  const params = new URLSearchParams({
    period_from: periodFrom,
    period_to: periodTo,
    page_size: '25000',
    order_by: 'period',
  })
  if (groupBy !== 'halfhour') params.set('group_by', groupBy)

  const url = `${BASE}/electricity-meter-points/${outgoing.mpan}/meters/${outgoing.serialNumber}/consumption/?${params}`
  const res = await fetch(url, { headers: authHeader(apiKey) })
  if (!res.ok) throw new Error(`Outgoing API error: ${res.status}`)
  const json = await res.json()
  return json.results as ConsumptionInterval[]
}
