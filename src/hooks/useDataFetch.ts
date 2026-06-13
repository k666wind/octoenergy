import { useCallback } from 'react'
import { useAppStore } from '../store/useAppStore'
import {
  fetchElectricityConsumption,
  fetchGasConsumption,
  fetchOutgoingConsumption,
  fetchAgileRates,
} from '../lib/octopusClient'

// Fetch last 30 days of data (30-min intervals)
function getPeriod() {
  const to = new Date()
  const from = new Date()
  from.setDate(from.getDate() - 30)
  return {
    periodFrom: from.toISOString(),
    periodTo: to.toISOString(),
  }
}

// Exponential backoff retry — max 3 attempts: 1s, 2s, 4s
async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 3): Promise<T> {
  let attempt = 0
  while (true) {
    try {
      return await fn()
    } catch (err) {
      attempt++
      if (attempt >= maxAttempts) throw err
      await new Promise(res => setTimeout(res, Math.pow(2, attempt - 1) * 1000))
    }
  }
}

export function useDataFetch() {
  const config         = useAppStore(s => s.config)
  const setElectricityData = useAppStore(s => s.setElectricityData)
  const setGasData         = useAppStore(s => s.setGasData)
  const setOutgoingData    = useAppStore(s => s.setOutgoingData)
  const setAgileRates      = useAppStore(s => s.setAgileRates)
  const setLoading         = useAppStore(s => s.setLoading)
  const setError           = useAppStore(s => s.setError)
  const touchRefresh       = useAppStore(s => s.touchRefresh)
  // Read isCacheStale via getState() inside the callback — avoids unstable reference
  // that would cause fetchAll useCallback to regenerate on every store update
  const storeGetState      = useAppStore.getState

  const fetchAll = useCallback(
    async (force = false) => {
      if (!config) return
      if (!force && !storeGetState().isCacheStale()) return

      setLoading(true)
      setError(null)

      const { periodFrom, periodTo } = getPeriod()

      try {
        // Fetch electricity (always)
        const elec = await withRetry(() => fetchElectricityConsumption(
          config.credentials,
          periodFrom,
          periodTo,
          'halfhour'
        ))
        setElectricityData(elec)

        // Fetch gas (only if configured)
        if (config.credentials.gas) {
          const gas = await withRetry(() => fetchGasConsumption(
            config.credentials,
            periodFrom,
            periodTo,
            'halfhour'
          ))
          setGasData(gas)
        }

        // Fetch outgoing/solar (only if configured)
        if (config.credentials.outgoing) {
          const outgoing = await withRetry(() => fetchOutgoingConsumption(
            config.credentials,
            periodFrom,
            periodTo,
            'halfhour'
          ))
          setOutgoingData(outgoing)
        }

        // Fetch Agile rates if on Agile tariff
        if (config.tariff.type === 'agile' && config.tariff.agileProductCode) {
          const region = config.tariff.dnoRegion ?? 'C'
          const rates = await withRetry(() => fetchAgileRates(
            config.tariff.agileProductCode!,
            periodFrom,
            periodTo,
            region
          ))
          setAgileRates(rates)
        }

        touchRefresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    },
    [config, storeGetState, setElectricityData, setGasData, setOutgoingData, setAgileRates, setLoading, setError, touchRefresh]
  )


  const fetchRangeData = useCallback(
    async (from: string, to: string): Promise<{
      elec: import('../types').ConsumptionInterval[]
      gas: import('../types').ConsumptionInterval[]
    }> => {
      if (!config) return { elec: [], gas: [] }
      const [elec, gas] = await Promise.all([
        fetchElectricityConsumption(config.credentials, from, to, 'halfhour'),
        config.credentials.gas
          ? fetchGasConsumption(config.credentials, from, to, 'halfhour')
          : Promise.resolve([]),
      ])
      return { elec, gas }
    },
    [config]
  )

  return { fetchAll, fetchRangeData }
}
