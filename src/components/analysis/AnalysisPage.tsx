import { useEffect, useMemo, useState } from 'react'
import { Printer } from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'
import { useDataFetch } from '../../hooks/useDataFetch'
import { t } from '../../lib/i18n'
import {
  calcElecCost,
  penceToPounds,
  groupByDay,
} from '../../lib/costCalculator'
import { TimeOfDayChart } from './TimeOfDayChart'
import { UsageHeatmap } from './UsageHeatmap'
import { SkeletonCard } from '../shared/SkeletonCard'

interface AnalysisPageProps {
  onDayDrillDown?: (date: string) => void
}

export function AnalysisPage({ onDayDrillDown }: AnalysisPageProps) {
  const lang = useAppStore(s => s.config?.language ?? 'en')
  const config = useAppStore(s => s.config)
  const cache = useAppStore(s => s.cache)
  const isLoading = useAppStore(s => s.isLoading)
  const { fetchAll } = useDataFetch()

  useEffect(() => { fetchAll() }, [fetchAll])

  if (!config) return null

  const { tariff, credentials } = config
  const hasGas = !!credentials.gas
  const hasSolar = !!credentials.outgoing
  const isAgile = tariff.type === 'agile'

  // Date range selector (default: last 30 days)
  function defaultFrom() {
    const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().slice(0, 10)
  }
  function defaultTo() { return new Date().toISOString().slice(0, 10) }
  const [rangeFrom, setRangeFrom] = useState(defaultFrom)
  const [rangeTo,   setRangeTo]   = useState(defaultTo)
  const [appliedFrom, setAppliedFrom] = useState(rangeFrom)
  const [appliedTo,   setAppliedTo]   = useState(rangeTo)

  const elecAll = cache.electricityConsumption?.data ?? []
  const gasAll = cache.gasConsumption?.data ?? []
  const solarAll = cache.outgoingConsumption?.data ?? []
  const agileRates = cache.agileRates?.data ?? []

  // Pre-build UK date cache for all elec intervals — O(n) once, not O(n) per render
  const elecDateCache = useMemo(() => {
    const m = new Map<string, string>()
    for (const iv of elecAll) {
      if (!m.has(iv.interval_start)) {
        m.set(iv.interval_start, new Date(iv.interval_start).toLocaleDateString('en-GB', {
          timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit',
        }).split('/').reverse().join('-'))
      }
    }
    return m
  }, [elecAll])

  // Filter by selected date range
  const elec30 = useMemo(() => {
    return elecAll.filter(i => {
      const d = elecDateCache.get(i.interval_start) ?? ''
      return d >= appliedFrom && d <= appliedTo
    })
  }, [elecAll, elecDateCache, appliedFrom, appliedTo])

  // Gas 30-day filtered intervals (same date range as elec)
  const gasDateCache = useMemo(() => {
    const m = new Map<string, string>()
    for (const iv of gasAll) {
      if (!m.has(iv.interval_start)) {
        m.set(iv.interval_start, new Date(iv.interval_start).toLocaleDateString('en-GB', {
          timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit',
        }).split('/').reverse().join('-'))
      }
    }
    return m
  }, [gasAll])

  const gas30 = useMemo(() => {
    return gasAll.filter(i => {
      const d = gasDateCache.get(i.interval_start) ?? ''
      return d >= appliedFrom && d <= appliedTo
    })
  }, [gasAll, gasDateCache, appliedFrom, appliedTo])

  // Top 5 most expensive days — memoised
  const top5 = useMemo(() => {
    const elecByDay = groupByDay(elec30)
    return Object.entries(elecByDay)
      .map(([date, ivs]) => ({
        date,
        kwh: ivs.reduce((s, i) => s + i.consumption, 0),
        costPence: calcElecCost(ivs, tariff, agileRates, true),
      }))
      .sort((a, b) => b.costPence - a.costPence)
      .slice(0, 5)
  }, [elec30, tariff, agileRates])

  const hasData = elecAll.length > 0

  return (
    <div style={{ padding: '1rem 1rem 5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem' }}>
        <h1 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 800 }}>{t(lang, 'insights')}</h1>
        <button
          onClick={() => window.print()}
          title={t(lang, 'exportPdfHint')}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            background: 'var(--color-surface)', border: '1px solid var(--color-border)',
            borderRadius: 8, padding: '0.4rem 0.75rem', cursor: 'pointer',
            fontSize: '0.78rem', color: 'var(--color-muted)', fontWeight: 600,
          }}
        >
          <Printer size={14} /> {t(lang, 'exportPdf')}
        </button>
      </div>

      {isLoading && !hasData && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <SkeletonCard height={220} />
          <SkeletonCard height={200} />
        </div>
      )}

      {!isLoading && !hasData && (
        <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--color-muted)' }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>&#128200;</div>
          <div style={{ fontWeight: 700, color: 'var(--color-text)', marginBottom: '0.4rem' }}>{t(lang, 'noDataYet')}</div>
          <div style={{ fontSize: '0.82rem' }}>{t(lang, 'noDataYetDesc')}</div>
        </div>
      )}

      {hasData && (
        <>
          {/* Date range picker */}
          <div className="card" style={{ marginBottom: '1rem', display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: '0.75rem' }}>
            <div>
              <div style={{ fontSize: '0.72rem', color: 'var(--color-muted)', marginBottom: 4 }}>{t(lang, 'analysisFrom')}</div>
              <input
                type="date"
                className="input-field"
                value={rangeFrom}
                max={rangeTo}
                onChange={e => setRangeFrom(e.target.value)}
                style={{ fontSize: '0.82rem', width: 140 }}
              />
            </div>
            <div>
              <div style={{ fontSize: '0.72rem', color: 'var(--color-muted)', marginBottom: 4 }}>{t(lang, 'analysisTo')}</div>
              <input
                type="date"
                className="input-field"
                value={rangeTo}
                min={rangeFrom}
                max={defaultTo()}
                onChange={e => setRangeTo(e.target.value)}
                style={{ fontSize: '0.82rem', width: 140 }}
              />
            </div>
            <button
              className="btn-secondary"
              onClick={() => { setAppliedFrom(rangeFrom); setAppliedTo(rangeTo) }}
              style={{ fontSize: '0.82rem', padding: '6px 16px' }}
            >
              {t(lang, 'analysisApply')}
            </button>
          </div>

          {/* Section A: Time of day */}
          <div className="card" style={{ marginBottom: '1rem' }}>
            <h2 style={{ margin: '0 0 1rem', fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-text)' }}>
              {t(lang, 'timeOfDay')}
            </h2>
            <TimeOfDayChart
              intervals={elec30}
              agileRates={agileRates}
              isAgile={isAgile}
              lang={lang}
            />
          </div>

          {/* Section A2: Gas Time of day */}
          {hasGas && gas30.length > 0 && (
            <div className="card" style={{ marginBottom: '1rem' }}>
              <h2 style={{ margin: '0 0 1rem', fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-text)' }}>
                {t(lang, 'timeOfDayGas')}
              </h2>
              <TimeOfDayChart
                intervals={gas30}
                agileRates={agileRates}
                isAgile={false}
                lang={lang}
                fuel="gas"
              />
            </div>
          )}

          {/* Section B: Heatmap */}
          <div className="card" style={{ marginBottom: '1rem' }}>
            <h2 style={{ margin: '0 0 1rem', fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-text)' }}>
              {t(lang, 'usageHeatmap')}
            </h2>
            <UsageHeatmap
              elecIntervals={elecAll}
              gasIntervals={gasAll}
              solarIntervals={solarAll}
              agileRates={agileRates}
              tariff={tariff}
              hasGas={hasGas}
              hasSolar={hasSolar}
              lang={lang}
              onDaySelect={onDayDrillDown}
            />
          </div>

          {/* Section C: Top 5 most expensive days */}
          {top5.length > 0 && (
            <div className="card">
              <h2 style={{ margin: '0 0 1rem', fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-text)' }}>
                {t(lang, 'topExpensiveDays')}
                <span style={{ fontSize: '0.65rem', color: 'var(--color-muted)', fontWeight: 400, marginLeft: 6 }}>({t(lang, 'inclStanding')})</span>
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {top5.map((day, i) => (
                  <div key={day.date} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '0.5rem 0.75rem',
                    background: 'var(--color-surface)',
                    borderRadius: 8,
                    border: i === 0 ? '1px solid rgba(248,113,113,0.35)' : '1px solid var(--color-border)',
                  }}>
                    <span style={{
                      width: 22, height: 22,
                      borderRadius: '50%',
                      background: i === 0 ? 'var(--color-danger)' : 'var(--color-border)',
                      color: '#fff', fontWeight: 800, fontSize: '0.72rem',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      {i + 1}
                    </span>
                    <span style={{ flex: 1, fontSize: '0.82rem', color: 'var(--color-text)' }}>{day.date}</span>
                    <span style={{ fontSize: '0.78rem', color: 'var(--color-muted)' }}>{day.kwh.toFixed(2)} kWh</span>
                    <span style={{ fontSize: '0.88rem', fontWeight: 700, color: i === 0 ? 'var(--color-danger)' : 'var(--color-text)' }}>
                      £{penceToPounds(day.costPence)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
