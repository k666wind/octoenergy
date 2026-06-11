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

export function useDataFetch() {
  const {
    config,
    isCacheStale,
    setElectricityData,
    setGasData,
    setOutgoingData,
    setAgileRates,
    setLoading,
    setError,
    touchRefresh,
  } = useAppStore()

  const fetchAll = useCallback(
    async (force = false) => {
      if (!config) return
      if (!force && !isCacheStale()) return

      setLoading(true)
      setError(null)

      const { periodFrom, periodTo } = getPeriod()

      try {
        // Fetch electricity (always)
        const elec = await fetchElectricityConsumption(
          config.credentials,
          periodFrom,
          periodTo,
          'halfhour'
        )
        setElectricityData(elec)

        // Fetch gas (only if configured)
        if (config.credentials.gas) {
          const gas = await fetchGasConsumption(
            config.credentials,
            periodFrom,
            periodTo,
            'halfhour'
          )
          setGasData(gas)
        }

        // Fetch outgoing/solar (only if configured)
        if (config.credentials.outgoing) {
          const outgoing = await fetchOutgoingConsumption(
            config.credentials,
            periodFrom,
            periodTo,
            'halfhour'
          )
          setOutgoingData(outgoing)
        }

        // Fetch Agile rates if on Agile tariff
        if (config.tariff.type === 'agile' && config.tariff.agileProductCode) {
          const region = config.tariff.dnoRegion ?? 'C'
          const rates = await fetchAgileRates(
            config.tariff.agileProductCode,
            periodFrom,
            periodTo,
            region
          )
          setAgileRates(rates)
        }

        touchRefresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    },
    [config, isCacheStale, setElectricityData, setGasData, setOutgoingData, setAgileRates, setLoading, setError, touchRefresh]
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
