import { useState, useMemo, useCallback, useEffect } from 'react'
import { Download, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts'
import { useAppStore } from '../../store/useAppStore'
import { useDataFetch } from '../../hooks/useDataFetch'
import { t } from '../../lib/i18n'
import { exportTrendsCsv } from '../../lib/csvExport'
import { TariffComparison } from '../analysis/TariffComparison'
import {
  totalKwh,
  groupByDay,
  groupByMonth,
  calcElecCost,
  calcGasCost,
  calcOutgoingEarnings,
  penceToPounds,
  gasToKwh,
} from '../../lib/costCalculator'
import type { ConsumptionInterval } from '../../types'

type View = 'day' | 'month' | 'year'

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}
function daysAgoISO(n: number) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}
function currentYearMonth() {
  return new Date().toISOString().slice(0, 7)
}
function currentYear() {
  return new Date().getFullYear()
}

export function TrendsPage() {
  const lang = useAppStore(s => s.config?.language ?? 'en')
  const cache = useAppStore(s => s.cache)
  const config = useAppStore(s => s.config)
  const { fetchAll, fetchRangeData } = useDataFetch()

  const [view, setView] = useState<View>('day')
  const [show, setShow] = useState<'kwh' | 'cost'>('kwh')

  // Day view pickers
  const [customFrom, setCustomFrom] = useState<string>(daysAgoISO(7))
  const [customTo, setCustomTo] = useState<string>(todayISO())
  const [rangeError, setRangeError] = useState('')

  // Month view
  const [customMonth, setCustomMonth] = useState<string>(currentYearMonth())

  // Year view
  const [customYear, setCustomYear] = useState<number>(currentYear())

  // On-demand fetched data (local state, not Zustand)
  const [rangeElec, setRangeElec] = useState<ConsumptionInterval[]>([])
  const [rangeGas, setRangeGas] = useState<ConsumptionInterval[]>([])
  const [isFetchingRange, setIsFetchingRange] = useState(false)

  useEffect(() => { fetchAll() }, [fetchAll])

  const hasGas = !!config?.credentials.gas
  const hasOutgoing = !!config?.credentials.outgoing
  const tariff = config?.tariff
  const agileRates = cache.agileRates?.data ?? []
  const elecAll = cache.electricityConsumption?.data ?? []
  const gasAll = cache.gasConsumption?.data ?? []
  const outAll = cache.outgoingConsumption?.data ?? []

  // Derived available months and years from cache
  const availableMonths = useMemo(() => {
    const months = new Set(elecAll.map(i => i.interval_start.slice(0, 7)))
    return Array.from(months).sort()
  }, [elecAll])

  const availableYears = useMemo(() => {
    const years = new Set(elecAll.map(i => parseInt(i.interval_start.slice(0, 4))))
    return Array.from(years).sort()
  }, [elecAll])

  // On-demand fetch for range when dates change (day view) or month/year outside cache
  const doFetchRange = useCallback(async (from: string, to: string) => {
    if (!config) return
    setIsFetchingRange(true)
    try {
      const { elec, gas } = await fetchRangeData(from, to)
      setRangeElec(elec)
      setRangeGas(gas)
    } catch {
      // silently ignore
    } finally {
      setIsFetchingRange(false)
    }
  }, [config, fetchRangeData])

  // Day view: validate range then fetch if needed
  function handleDayFromChange(val: string) {
    setCustomFrom(val)
    setRangeError('')
    if (!val || !customTo) return
    const diff = (new Date(customTo).getTime() - new Date(val).getTime()) / 86400000
    if (diff > 31) { setRangeError(t(lang, 'maxRangeExceeded')); return }
    if (diff < 0) return
    // If dates not in 30d cache, fetch on demand
    const cacheFrom = daysAgoISO(30)
    if (val < cacheFrom) doFetchRange(val, customTo)
  }

  function handleDayToChange(val: string) {
    setCustomTo(val)
    setRangeError('')
    if (!customFrom || !val) return
    const diff = (new Date(val).getTime() - new Date(customFrom).getTime()) / 86400000
    if (diff > 31) { setRangeError(t(lang, 'maxRangeExceeded')); return }
    if (diff < 0) return
    const cacheFrom = daysAgoISO(30)
    if (customFrom < cacheFrom) doFetchRange(customFrom, val)
  }

  // Pick data source: range fetch OR cache
  function getElecSource() {
    if (view === 'day') {
      const cacheFrom = daysAgoISO(30)
      return customFrom < cacheFrom ? rangeElec : elecAll
    }
    return elecAll
  }
  function getGasSource() {
    if (view === 'day') {
      const cacheFrom = daysAgoISO(30)
      return customFrom < cacheFrom ? rangeGas : gasAll
    }
    return gasAll
  }

  const chartData = useMemo(() => {
    const exportRate = tariff?.outgoingFixedRate ?? 0

    if (view === 'day') {
      const from = customFrom
      const to = customTo
      if (!from || !to) return []
      const elecSrc = getElecSource()
      const gasSrc = getGasSource()
      // Filter to range
      const elecFiltered = elecSrc.filter(i => {
        const d = i.interval_start.slice(0, 10)
        return d >= from && d <= to
      })
      const gasFiltered = gasSrc.filter(i => {
        const d = i.interval_start.slice(0, 10)
        return d >= from && d <= to
      })
      const outFiltered = outAll.filter(i => {
        const d = i.interval_start.slice(0, 10)
        return d >= from && d <= to
      })

      // Group by day
      const elecByDay = groupByDay(elecFiltered)
      const gasByDay = groupByDay(gasFiltered)
      const outByDay = groupByDay(outFiltered)
      const days = Array.from(new Set([...Object.keys(elecByDay), ...Object.keys(gasByDay), ...Object.keys(outByDay)])).sort()

      return days.map(day => {
        const eIvs = elecByDay[day] ?? []
        const gIvs = gasByDay[day] ?? []
        const oIvs = outByDay[day] ?? []
        const elecKwh = totalKwh(eIvs)
        const gasKwh = gIvs.reduce((s, i) => s + gasToKwh(i.consumption), 0)
        const outKwh = totalKwh(oIvs)
        const d = new Date(day + 'T12:00:00Z')
        const label = d.toLocaleDateString(lang === 'zh' ? 'zh-HK' : 'en-GB', { day: 'numeric', month: 'short' })
        return {
          label,
          elecKwh: parseFloat(elecKwh.toFixed(3)),
          gasKwh: parseFloat(gasKwh.toFixed(3)),
          outKwh: parseFloat(outKwh.toFixed(3)),
          elecCost: parseFloat(penceToPounds(tariff ? calcElecCost(eIvs, tariff, agileRates) : 0)),
          gasCost: parseFloat(penceToPounds(tariff ? calcGasCost(gIvs, tariff) : 0)),
          outEarned: parseFloat(penceToPounds(calcOutgoingEarnings(oIvs, exportRate))),
        }
      })
    }

    if (view === 'month') {
      const elecByDay = groupByDay(elecAll.filter(i => i.interval_start.startsWith(customMonth)))
      const gasByDay = groupByDay(gasAll.filter(i => i.interval_start.startsWith(customMonth)))
      const outByDay = groupByDay(outAll.filter(i => i.interval_start.startsWith(customMonth)))
      const days = Array.from(new Set([...Object.keys(elecByDay), ...Object.keys(gasByDay), ...Object.keys(outByDay)])).sort()
      return days.map(day => {
        const eIvs = elecByDay[day] ?? []
        const gIvs = gasByDay[day] ?? []
        const oIvs = outByDay[day] ?? []
        const label = day.slice(8)  // day number
        return {
          label,
          elecKwh: parseFloat(totalKwh(eIvs).toFixed(3)),
          gasKwh: parseFloat(gIvs.reduce((s, i) => s + gasToKwh(i.consumption), 0).toFixed(3)),
          outKwh: parseFloat(totalKwh(oIvs).toFixed(3)),
          elecCost: parseFloat(penceToPounds(tariff ? calcElecCost(eIvs, tariff, agileRates) : 0)),
          gasCost: parseFloat(penceToPounds(tariff ? calcGasCost(gIvs, tariff) : 0)),
          outEarned: parseFloat(penceToPounds(calcOutgoingEarnings(oIvs, exportRate))),
        }
      })
    }

    // Year view
    if (view === 'year') {
      const yearStr = String(customYear)
      const elecByMonth = groupByMonth(elecAll.filter(i => i.interval_start.startsWith(yearStr)))
      const gasByMonth = groupByMonth(gasAll.filter(i => i.interval_start.startsWith(yearStr)))
      const outByMonth = groupByMonth(outAll.filter(i => i.interval_start.startsWith(yearStr)))
      const months = Array.from(new Set([...Object.keys(elecByMonth), ...Object.keys(gasByMonth), ...Object.keys(outByMonth)])).sort()
      return months.map(mo => {
        const eIvs = elecByMonth[mo] ?? []
        const gIvs = gasByMonth[mo] ?? []
        const oIvs = outByMonth[mo] ?? []
        const [y, m] = mo.split('-')
        const label = new Date(parseInt(y), parseInt(m) - 1).toLocaleDateString(lang === 'zh' ? 'zh-HK' : 'en-GB', { month: 'short' })
        return {
          label,
          elecKwh: parseFloat(totalKwh(eIvs).toFixed(2)),
          gasKwh: parseFloat(gIvs.reduce((s, i) => s + gasToKwh(i.consumption), 0).toFixed(2)),
          outKwh: parseFloat(totalKwh(oIvs).toFixed(2)),
          elecCost: parseFloat(penceToPounds(tariff ? calcElecCost(eIvs, tariff, agileRates) : 0)),
          gasCost: parseFloat(penceToPounds(tariff ? calcGasCost(gIvs, tariff) : 0)),
          outEarned: parseFloat(penceToPounds(calcOutgoingEarnings(oIvs, exportRate))),
        }
      })
    }

    return []
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, elecAll, gasAll, outAll, rangeElec, rangeGas, tariff, lang, customFrom, customTo, customMonth, customYear, agileRates])

  function handleExportCsv() {
    if (!tariff) return
    const date = new Date().toISOString().slice(0, 10)
    exportTrendsCsv(elecAll, gasAll, tariff, agileRates, `octoenergy-${date}.csv`)
  }

  const totalElecKwh = chartData.reduce((s, d) => s + d.elecKwh, 0)
  const totalGasKwh = chartData.reduce((s, d) => s + d.gasKwh, 0)
  const totalElecCost = chartData.reduce((s, d) => s + d.elecCost, 0)
  const totalGasCost = chartData.reduce((s, d) => s + d.gasCost, 0)
  const totalOut = chartData.reduce((s, d) => s + d.outKwh, 0)
  const totalOutEarned = chartData.reduce((s, d) => s + d.outEarned, 0)

  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { dataKey: string; name: string; fill: string; value: number }[]; label?: string }) => {
    if (!active || !payload?.length) return null
    return (
      <div style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 8, padding: '0.6rem 0.9rem', fontSize: '0.8rem' }}>
        <div style={{ fontWeight: 700, marginBottom: 4 }}>{label}</div>
        {payload.map((p) => (
          <div key={p.dataKey} style={{ color: p.fill }}>
            {p.name}: {p.value} {show === 'kwh' ? 'kWh' : '\u00a3'}
          </div>
        ))}
      </div>
    )
  }

  const viewTabs: { id: View; label: string }[] = [
    { id: 'day',   label: t(lang, 'day') },
    { id: 'month', label: t(lang, 'month') },
    { id: 'year',  label: t(lang, 'selectYear') },
  ]

  return (
    <div style={{ padding: '1rem 1rem 5rem' }}>
      <h1 style={{ margin: '0 0 1.2rem', fontSize: '1.3rem', fontWeight: 800 }}>{t(lang, 'trendsTitle')}</h1>

      {/* View tabs */}
      <div style={{ display: 'flex', gap: 4, background: 'var(--color-surface)', borderRadius: 8, padding: 3, marginBottom: '1rem' }}>
        {viewTabs.map(v => (
          <button key={v.id} onClick={() => setView(v.id)} style={{
            flex: 1, padding: '5px 10px', borderRadius: 6, border: 'none', cursor: 'pointer',
            background: view === v.id ? 'var(--color-accent)' : 'transparent',
            color: view === v.id ? 'white' : 'var(--color-muted)',
            fontSize: '0.78rem', fontWeight: 600, transition: 'all 0.15s',
          }}>{v.label}</button>
        ))}
      </div>

      {/* Date pickers per view */}
      {view === 'day' && (
        <div style={{ display: 'flex', gap: 8, marginBottom: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <label style={{ fontSize: '0.75rem', color: 'var(--color-muted)' }}>{t(lang, 'from')}</label>
            <input
              type="date"
              className="input-field"
              style={{ padding: '4px 8px', fontSize: '0.8rem', width: 'auto' }}
              value={customFrom}
              max={customTo}
              onChange={e => handleDayFromChange(e.target.value)}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <label style={{ fontSize: '0.75rem', color: 'var(--color-muted)' }}>{t(lang, 'to')}</label>
            <input
              type="date"
              className="input-field"
              style={{ padding: '4px 8px', fontSize: '0.8rem', width: 'auto' }}
              value={customTo}
              max={todayISO()}
              onChange={e => handleDayToChange(e.target.value)}
            />
          </div>
          {isFetchingRange && <Loader2 size={14} style={{ color: 'var(--color-muted)', animation: 'spin 0.7s linear infinite' }} />}
          {rangeError && <span style={{ fontSize: '0.75rem', color: 'var(--color-danger)' }}>{rangeError}</span>}
        </div>
      )}

      {view === 'month' && (
        <div style={{ marginBottom: '0.75rem' }}>
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4 }}>
            {availableMonths.map(mo => (
              <button key={mo} onClick={() => setCustomMonth(mo)} style={{
                flexShrink: 0,
                padding: '4px 12px', borderRadius: 20, border: '1px solid',
                borderColor: customMonth === mo ? 'var(--color-accent)' : 'var(--color-border)',
                background: customMonth === mo ? 'rgba(224,64,251,0.15)' : 'transparent',
                color: customMonth === mo ? 'var(--color-accent)' : 'var(--color-muted)',
                cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600,
              }}>
                {mo}
              </button>
            ))}
          </div>
        </div>
      )}

      {view === 'year' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '0.75rem' }}>
          <button
            onClick={() => availableYears.includes(customYear - 1) && setCustomYear(y => y - 1)}
            disabled={!availableYears.includes(customYear - 1)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-muted)', padding: 4 }}
          >
            <ChevronLeft size={18} />
          </button>
          <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--color-text)', minWidth: 50, textAlign: 'center' }}>{customYear}</span>
          <button
            onClick={() => availableYears.includes(customYear + 1) && setCustomYear(y => y + 1)}
            disabled={!availableYears.includes(customYear + 1)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-muted)', padding: 4 }}
          >
            <ChevronRight size={18} />
          </button>
        </div>
      )}

      {/* kWh / £ toggle + CSV export */}
      <div style={{ display: 'flex', gap: 8, marginBottom: '1rem' }}>
        <div style={{ display: 'flex', gap: 4, background: 'var(--color-surface)', borderRadius: 8, padding: 3 }}>
          {(['kwh', 'cost'] as const).map(s => (
            <button key={s} onClick={() => setShow(s)} style={{
              padding: '5px 14px', borderRadius: 6, border: 'none', cursor: 'pointer',
              background: show === s ? 'var(--color-border)' : 'transparent',
              color: show === s ? 'var(--color-text)' : 'var(--color-muted)',
              fontSize: '0.78rem', fontWeight: 600,
            }}>{s === 'kwh' ? 'kWh' : '\u00a3'}</button>
          ))}
        </div>
        <button
          onClick={handleExportCsv}
          disabled={elecAll.length === 0}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            background: 'var(--color-surface)', border: '1px solid var(--color-border)',
            borderRadius: 8, padding: '5px 12px', cursor: 'pointer',
            color: 'var(--color-muted)', fontSize: '0.78rem', fontWeight: 600,
          }}
        >
          <Download size={13} />
          {t(lang, 'exportCsv')}
        </button>
      </div>

      {/* Chart */}
      <div className="card" style={{ marginBottom: '1rem' }}>
        {isFetchingRange ? (
          <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--color-muted)', fontSize: '0.85rem' }}>
            {t(lang, 'fetchingData')}
          </div>
        ) : chartData.length === 0 ? (
          <p style={{ color: 'var(--color-muted)', textAlign: 'center', padding: '2rem 0' }}>{t(lang, 'noDataForPeriod')}</p>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--color-muted)' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 10, fill: 'var(--color-muted)' }} tickLine={false} axisLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: '0.78rem' }} />
              <Bar dataKey={show === 'kwh' ? 'elecKwh' : 'elecCost'} name={t(lang, 'electricity')} fill="var(--color-elec)" radius={[3,3,0,0]} maxBarSize={30} />
              {hasGas && <Bar dataKey={show === 'kwh' ? 'gasKwh' : 'gasCost'} name={t(lang, 'gas')} fill="var(--color-gas)" radius={[3,3,0,0]} maxBarSize={30} />}
              {hasOutgoing && <Bar dataKey={show === 'kwh' ? 'outKwh' : 'outEarned'} name={t(lang, 'solarExport')} fill="var(--color-solar)" radius={[3,3,0,0]} maxBarSize={30} />}
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Summary stats */}
      {chartData.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.5rem' }}>
          <StatCard
            label={t(lang, 'electricity')}
            value={`${totalElecKwh.toFixed(1)} kWh`}
            sub={`£${totalElecCost.toFixed(2)}`}
            extra={view === 'day' && chartData.length > 1 ? `${t(lang, 'dailyAverage')}: ${(totalElecKwh / chartData.length).toFixed(2)} kWh` : undefined}
            color="var(--color-elec)"
          />
          {hasGas && (
            <StatCard
              label={t(lang, 'gas')}
              value={`${totalGasKwh.toFixed(1)} kWh`}
              sub={`£${totalGasCost.toFixed(2)}`}
              color="var(--color-gas)"
            />
          )}
          {hasOutgoing && (
            <StatCard
              label={t(lang, 'solarExport')}
              value={`${totalOut.toFixed(1)} kWh`}
              sub={`£${totalOutEarned.toFixed(2)} ${t(lang, 'earned')}`}
              color="var(--color-solar)"
            />
          )}
          {view === 'year' && (
            <StatCard
              label={t(lang, 'annualTotal')}
              value={`£${(totalElecCost + totalGasCost - totalOutEarned).toFixed(2)}`}
              sub={`${(totalElecKwh + totalGasKwh).toFixed(0)} kWh`}
              color="var(--color-accent)"
            />
          )}
          {view === 'month' && (
            <StatCard
              label={t(lang, 'monthlyTotal')}
              value={`£${(totalElecCost + totalGasCost - totalOutEarned).toFixed(2)}`}
              sub={`${t(lang, 'dailyAverage')}: £${chartData.length > 0 ? ((totalElecCost + totalGasCost - totalOutEarned) / chartData.length).toFixed(2) : '0.00'}`}
              color="var(--color-accent)"
            />
          )}
        </div>
      )}

      {/* Tariff comparison */}
      {elecAll.length > 0 && (
        <TariffComparison />
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } } input[type="date"] { color-scheme: dark; }`}</style>
    </div>
  )
}

function StatCard({ label, value, sub, extra, color }: { label: string; value: string; sub: string; extra?: string; color: string }) {
  return (
    <div className="card">
      <div style={{ fontSize: '0.72rem', color: 'var(--color-muted)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: '1.2rem', fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: '0.8rem', color: 'var(--color-muted)' }}>{sub}</div>
      {extra && <div style={{ fontSize: '0.72rem', color: 'var(--color-muted)', marginTop: 2 }}>{extra}</div>}
    </div>
  )
}
