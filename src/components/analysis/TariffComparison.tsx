import { useState, useEffect } from 'react'
import { TrendingDown, TrendingUp, Zap, RefreshCw } from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'
import { t } from '../../lib/i18n'
import {
  totalKwh,
  calcElecCost,
  agileCost,
  penceToPounds,
} from '../../lib/costCalculator'
import { fetchAgileRates, fetchLatestAgileProduct } from '../../lib/octopusClient'
import type { AgileRate, DnoRegion } from '../../types'

export function TariffComparison() {
  const lang = useAppStore(s => s.config?.language ?? 'en')
  const config = useAppStore(s => s.config)
  const cache = useAppStore(s => s.cache)

  const [agileRates, setAgileRates] = useState<AgileRate[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [agileProduct, setAgileProduct] = useState(config?.tariff.agileProductCode ?? '')
  const [region, setRegion] = useState<DnoRegion>(config?.tariff.dnoRegion ?? 'C')

  const elecAll = cache.electricityConsumption?.data ?? []
  const tariff = config?.tariff

  // Use cached agile rates if available
  useEffect(() => {
    if (cache.agileRates?.data?.length) {
      setAgileRates(cache.agileRates.data)
    }
  }, [cache.agileRates])

  async function loadRates() {
    setLoading(true)
    setError('')
    try {
      let product = agileProduct
      if (!product) {
        const latest = await fetchLatestAgileProduct()
        if (latest) {
          product = latest
          setAgileProduct(latest)
        } else {
          throw new Error('Could not find an Agile product. Enter product code manually.')
        }
      }
      const to = new Date()
      const from = new Date()
      from.setDate(from.getDate() - 30)
      const rates = await fetchAgileRates(product, from.toISOString(), to.toISOString(), region)
      setAgileRates(rates)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch rates')
    } finally {
      setLoading(false)
    }
  }

  if (!tariff || !elecAll.length) {
    return (
      <div className="card" style={{ color: 'var(--color-muted)', textAlign: 'center', padding: '2rem 0', fontSize: '0.85rem' }}>
        {t(lang, 'noData')}
      </div>
    )
  }

  const currentCostPence = calcElecCost(elecAll, tariff, cache.agileRates?.data ?? [])
  const fixedCostPence = elecAll.reduce((sum: number, i: import('../../types').ConsumptionInterval) => sum + i.consumption * tariff.fixed.electricityUnitRate, 0)
  const agileCostPence = agileRates.length > 0 ? agileCost(elecAll, agileRates) : null

  const scenarios = [
    {
      id: 'current',
      label: t(lang, 'currentTariff'),
      sublabel: tariff.type === 'fixed' ? `${tariff.fixed.electricityUnitRate}p/kWh` : tariff.type,
      costPence: currentCostPence,
      color: 'var(--color-accent)',
      highlight: true,
    },
    ...(tariff.type !== 'fixed' ? [{
      id: 'fixed',
      label: t(lang, 'fixedScenario'),
      sublabel: `${tariff.fixed.electricityUnitRate}p/kWh`,
      costPence: fixedCostPence,
      color: 'var(--color-elec)',
      highlight: false,
    }] : []),
    ...(agileCostPence !== null && tariff.type !== 'agile' ? [{
      id: 'agile',
      label: t(lang, 'agileScenario'),
      sublabel: `avg ${agileRates.length > 0 ? (agileRates.reduce((s, r) => s + r.value_inc_vat, 0) / agileRates.length).toFixed(1) : '?'}p/kWh`,
      costPence: agileCostPence,
      color: 'var(--color-solar)',
      highlight: false,
    }] : []),
  ]

  const totalKwhAll = totalKwh(elecAll)
  const maxCost = Math.max(...scenarios.map(s => s.costPence))
  const cheapest = [...scenarios].sort((a, b) => a.costPence - b.costPence)[0]
  const diff = currentCostPence - cheapest.costPence
  const isSaving = diff > 0 && cheapest.id !== 'current'

  const DNO_REGIONS = ['A','B','C','D','E','F','G','H','J','K','L','M','N','P'] as const

  return (
    <div style={{ padding: '0 0 1rem' }}>
      <div style={{ marginBottom: '1rem' }}>
        <h2 style={{ margin: '0 0 0.2rem', fontSize: '1.1rem', fontWeight: 800 }}>{t(lang, 'comparisonTitle')}</h2>
        <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--color-muted)' }}>
          {t(lang, 'comparisonSubtitle')} · {totalKwhAll.toFixed(1)} kWh
        </p>
      </div>

      {/* Scenario bars */}
      <div className="card" style={{ marginBottom: '0.75rem' }}>
        {scenarios.map(s => (
          <div key={s.id} style={{ marginBottom: '0.9rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
              <div>
                <span style={{
                  fontSize: '0.82rem', fontWeight: s.highlight ? 800 : 600,
                  color: s.highlight ? 'var(--color-text)' : 'var(--color-muted)',
                }}>
                  {s.label}
                </span>
                <span style={{ fontSize: '0.7rem', color: 'var(--color-muted)', marginLeft: 6 }}>{s.sublabel}</span>
                {s.id === cheapest.id && (
                  <span style={{
                    marginLeft: 6, fontSize: '0.65rem', fontWeight: 700,
                    color: 'var(--color-success)', background: 'rgba(52,211,153,0.1)',
                    padding: '1px 5px', borderRadius: 10,
                  }}>CHEAPEST</span>
                )}
              </div>
              <span style={{ fontSize: '0.9rem', fontWeight: 700, color: s.color }}>
                £{penceToPounds(s.costPence)}
              </span>
            </div>
            <div style={{ height: 6, borderRadius: 3, background: 'var(--color-surface)', overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 3,
                background: s.color,
                width: `${maxCost > 0 ? (s.costPence / maxCost) * 100 : 0}%`,
                opacity: s.highlight ? 1 : 0.6,
                transition: 'width 0.5s ease',
              }} />
            </div>
          </div>
        ))}

        {/* Summary */}
        {isSaving && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)',
            borderRadius: 8, padding: '0.6rem 0.8rem', marginTop: '0.2rem',
          }}>
            <TrendingDown size={14} style={{ color: 'var(--color-success)', flexShrink: 0 }} />
            <span style={{ fontSize: '0.8rem', color: 'var(--color-success)' }}>
              {cheapest.label} {lang === 'zh' ? '可節省' : 'could save'}{' '}
              <strong>£{penceToPounds(diff)}</strong> {lang === 'zh' ? '（過去30日）' : '(last 30 days)'}
            </span>
          </div>
        )}
        {!isSaving && cheapest.id === 'current' && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)',
            borderRadius: 8, padding: '0.6rem 0.8rem', marginTop: '0.2rem',
          }}>
            <TrendingUp size={14} style={{ color: 'var(--color-success)', flexShrink: 0 }} />
            <span style={{ fontSize: '0.8rem', color: 'var(--color-success)' }}>
              {lang === 'zh' ? '您目前的計劃已是最便宜的選擇' : 'Your current tariff is already the cheapest option'}
            </span>
          </div>
        )}
      </div>

      {/* Agile fetch controls */}
      {tariff.type !== 'agile' && (
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: '0.75rem' }}>
            <Zap size={13} style={{ color: 'var(--color-solar)' }} />
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--color-solar)' }}>
              {t(lang, 'agileScenario')}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: '0.6rem' }}>
            <div style={{ flex: 1 }}>
              <label className="label">{t(lang, 'agileProductCode')}</label>
              <input
                className="input-field"
                placeholder={t(lang, 'agileProductPlaceholder')}
                value={agileProduct}
                onChange={e => setAgileProduct(e.target.value)}
                style={{ fontSize: '0.8rem' }}
              />
            </div>
            <div>
              <label className="label">{t(lang, 'dnoRegion')}</label>
              <select
                className="input-field"
                value={region}
                onChange={e => setRegion(e.target.value as DnoRegion)}
                style={{ fontSize: '0.8rem', width: 64 }}
              >
                {DNO_REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          </div>
          <p style={{ margin: '0 0 0.6rem', fontSize: '0.72rem', color: 'var(--color-muted)' }}>
            {t(lang, 'dnoRegionHint')}
          </p>
          {error && <p style={{ margin: '0 0 0.5rem', fontSize: '0.78rem', color: 'var(--color-danger)' }}>{error}</p>}
          <button
            className="btn-secondary"
            onClick={loadRates}
            disabled={loading}
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem' }}
          >
            <RefreshCw size={13} style={{ animation: loading ? 'spin 0.7s linear infinite' : 'none' }} />
            {loading ? t(lang, 'fetchingRates') : t(lang, 'agileScenario') + ' — load rates'}
          </button>
        </div>
      )}

      <p style={{ margin: '0.75rem 0 0', fontSize: '0.7rem', color: 'var(--color-muted)', lineHeight: 1.4 }}>
        * {t(lang, 'comparisonNote')}
      </p>
    </div>
  )
}
