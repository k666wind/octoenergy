import { useEffect } from 'react'
import { RefreshCw, Zap, Flame, Sun } from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'
import { useDataFetch } from '../../hooks/useDataFetch'
import { t } from '../../lib/i18n'
import {
  totalKwh,
  calcElecCost,
  calcGasCost,
  calcOutgoingEarnings,
  penceToPounds,
  formatKwh,
  gasToKwh,
} from '../../lib/costCalculator'
import { SkeletonCard } from '../shared/SkeletonCard'
import { HeatmapChart } from './HeatmapChart'
import { Last24hChart } from './Last24hChart'
import { BudgetCard } from './BudgetCard'
import { LanguageToggle } from '../shared/LanguageToggle'
import type { ConsumptionInterval } from '../../types'

// Convert a UTC ISO string to UK local date (handles GMT/BST)
function utcToUkDate(isoStr: string): string {
  return new Date(isoStr).toLocaleDateString('en-GB', {
    timeZone: 'Europe/London',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).split('/').reverse().join('-') // dd/mm/yyyy -> yyyy-mm-dd
}

function todayStr() {
  return new Date().toLocaleDateString('en-GB', {
    timeZone: 'Europe/London',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).split('/').reverse().join('-')
}


// Minimum half-hour slots to treat a day as "has real data"
const MIN_INTERVALS = 4

function getDay(intervals: ConsumptionInterval[], day: string): ConsumptionInterval[] {
  return intervals.filter(i => utcToUkDate(i.interval_start) === day)
}

// Find the most recent date that has at least MIN_INTERVALS slots of data.
// Returns { date: string, isFallback: boolean }
function bestAvailableDay(
  intervals: ConsumptionInterval[],
  preferredDay: string,
): { date: string; isFallback: boolean } {
  const onPreferred = intervals.filter(i => utcToUkDate(i.interval_start) === preferredDay)
  if (onPreferred.length >= MIN_INTERVALS) return { date: preferredDay, isFallback: false }

  // Collect all unique dates in descending order
  const uniqueDates = Array.from(new Set(intervals.map(i => utcToUkDate(i.interval_start))))
    .filter(d => d < preferredDay) // only past dates
    .sort()
    .reverse()

  for (const d of uniqueDates) {
    const count = intervals.filter(i => utcToUkDate(i.interval_start) === d).length
    if (count >= MIN_INTERVALS) return { date: d, isFallback: true }
  }

  // Nothing useful found — return preferred day anyway (will show 0)
  return { date: preferredDay, isFallback: false }
}

export function Dashboard() {
  const lang = useAppStore(s => s.config?.language ?? 'en')
  const config = useAppStore(s => s.config)
  const cache = useAppStore(s => s.cache)
  const isLoading = useAppStore(s => s.isLoading)
  const error = useAppStore(s => s.error)
  const justSetup = useAppStore(s => s.justSetup)
  const setJustSetup = useAppStore(s => s.setJustSetup)
  const { fetchAll } = useDataFetch()

  useEffect(() => {
    if (justSetup) {
      fetchAll(true).then(() => setJustSetup(false))
    } else {
      fetchAll()
    }
  }, [fetchAll, justSetup, setJustSetup])

  const agileRates = cache.agileRates?.data ?? []
  const agileRatesMissing = config?.tariff.type === 'agile' && !cache.agileRates?.data?.length

  // Agile cheap slot: look ahead for next slot < 10p/kWh
  const cheapSlot = (() => {
    if (config?.tariff.type !== 'agile') return null
    const now = new Date().toISOString()
    const future = agileRates
      .filter(r => r.valid_from > now)
      .sort((a, b) => a.valid_from.localeCompare(b.valid_from))
    const cheap = future.find(r => r.value_inc_vat < 10)
    return cheap ?? null
  })()
  const elecAll = cache.electricityConsumption?.data ?? []
  const gasAll = cache.gasConsumption?.data ?? []
  const outgoingAll = cache.outgoingConsumption?.data ?? []
  const hasGas = !!config?.credentials.gas
  const hasOutgoing = !!config?.credentials.outgoing
  const tariff = config?.tariff

  const today = todayStr()

  // Use fallback day if today has < MIN_INTERVALS data points (e.g. early morning or 1-day API delay)
  const { date: elecDisplayDay, isFallback: elecIsFallback } = bestAvailableDay(elecAll, today)
  const { date: gasDisplayDay, isFallback: gasIsFallback } = bestAvailableDay(gasAll, today)
  const { date: outDisplayDay, isFallback: outIsFallback } = bestAvailableDay(outgoingAll, today)
  const isFallback = elecIsFallback || gasIsFallback || (hasOutgoing && outIsFallback)
  const fallbackDate = elecIsFallback ? elecDisplayDay : gasIsFallback ? gasDisplayDay : today

  // "Previous day" = the day before whichever display day we're using (handles multi-day fallback)
  // IMPORTANT: parse yyyy-mm-dd by splitting parts — new Date("yyyy-mm-dd") is midnight UTC
  // which in BST (UTC+1) = 11pm the day before, causing utcToUkDate to return wrong date.
  function prevDay(dateStr: string): string {
    const [y, m, d] = dateStr.split('-').map(Number)
    const dt = new Date(y, m - 1, d) // local midnight — no UTC offset issue
    dt.setDate(dt.getDate() - 1)
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
  }

  const elecToday = getDay(elecAll, elecDisplayDay)
  const elecYest  = getDay(elecAll, prevDay(elecDisplayDay))
  const gasToday  = getDay(gasAll, gasDisplayDay)
  const gasYest   = getDay(gasAll, prevDay(gasDisplayDay))
  const outToday  = getDay(outgoingAll, outDisplayDay)
  const outYest   = getDay(outgoingAll, prevDay(outDisplayDay))

  const elecTodayKwh = totalKwh(elecToday)
  const elecYestKwh = totalKwh(elecYest)
  const gasTodayKwh = gasToday.reduce((s, i) => s + gasToKwh(i.consumption), 0)
  const gasYestKwh = gasYest.reduce((s, i) => s + gasToKwh(i.consumption), 0)
  const outTodayKwh = totalKwh(outToday)
  const outYestKwh = totalKwh(outYest)

  const elecTodayCost = tariff ? calcElecCost(elecToday, tariff, [], true) : 0
  const elecYestCost = tariff ? calcElecCost(elecYest, tariff, [], true) : 0
  const gasTodayCost = tariff ? calcGasCost(gasToday, tariff, true) : 0
  const gasYestCost = tariff ? calcGasCost(gasYest, tariff, true) : 0
  const exportRate = tariff?.outgoingFixedRate ?? 0
  const outTodayEarned = tariff ? calcOutgoingEarnings(outToday, exportRate) : 0
  const outYestEarned = tariff ? calcOutgoingEarnings(outYest, exportRate) : 0

  // Month-to-date spending (for budget card) — use UK local month
  const thisMonthStr = new Date().toLocaleDateString('en-GB', {
    timeZone: 'Europe/London', year: 'numeric', month: '2-digit',
  }).split('/').reverse().join('-').slice(0, 7) // yyyy-mm
  const elecMonth = elecAll.filter(i => utcToUkDate(i.interval_start).startsWith(thisMonthStr))
  const gasMonth = gasAll.filter(i => utcToUkDate(i.interval_start).startsWith(thisMonthStr))
  const outMonth = outgoingAll.filter(i => utcToUkDate(i.interval_start).startsWith(thisMonthStr))
  const elecMonthCost = tariff ? calcElecCost(elecMonth, tariff, agileRates, true) : 0
  const gasMonthCost = tariff ? calcGasCost(gasMonth, tariff, true) : 0
  const outMonthEarned = tariff ? calcOutgoingEarnings(outMonth, exportRate) : 0
  const monthSpentPence = elecMonthCost + gasMonthCost - outMonthEarned
  // Project to month end based on daily average so far
  const daysElapsed = new Date().getDate()
  const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate()
  const dailyAvg = daysElapsed > 0 ? monthSpentPence / daysElapsed : 0
  const projectedPence = dailyAvg * daysInMonth

  const totalImportCost = elecTodayCost + gasTodayCost
  const netCost = totalImportCost - outTodayEarned

  const lastRefresh = cache.lastRefresh
    ? new Date(cache.lastRefresh).toLocaleTimeString(lang === 'zh' ? 'zh-HK' : 'en-GB', { hour: '2-digit', minute: '2-digit' })
    : '—'

  // Grid columns: up to 3 cards (elec + gas + solar)
  const cardCount = 1 + (hasGas ? 1 : 0) + (hasOutgoing ? 1 : 0)
  const gridCols = cardCount === 1 ? '1fr' : cardCount === 2 ? '1fr 1fr' : '1fr 1fr 1fr'

  return (
    <div style={{ padding: '1rem 1rem 5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 800 }}>{t(lang, 'dashboard')}</h1>
          <span style={{ fontSize: '0.72rem', color: 'var(--color-muted)' }}>
            {t(lang, 'lastUpdated')}: {lastRefresh}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <LanguageToggle />
          <button
            onClick={() => fetchAll(true)}
            disabled={isLoading}
            style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 8,
              padding: '6px 10px',
              cursor: 'pointer',
              color: 'var(--color-text)',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              fontSize: '0.8rem',
            }}
          >
            <RefreshCw size={14} style={{ animation: isLoading ? 'spin 0.7s linear infinite' : 'none' }} />
            {t(lang, 'refresh')}
          </button>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>

      {isLoading && !elecAll.length && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem' }}>
          <SkeletonCard height={100} />
          <SkeletonCard height={80} />
          <SkeletonCard height={120} />
        </div>
      )}
      {!isLoading && !elecAll.length && !error && (
        <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--color-muted)' }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>&#9889;</div>
          <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--color-text)', marginBottom: '0.4rem' }}>
            {t(lang, 'noDataYet')}
          </div>
          <div style={{ fontSize: '0.82rem', marginBottom: '1.2rem' }}>{t(lang, 'noDataYetDesc')}</div>
          <button
            onClick={() => fetchAll(true)}
            style={{
              background: 'var(--color-accent)',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              padding: '8px 20px',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: '0.85rem',
            }}
          >
            {t(lang, 'refreshNow')} &#8594;
          </button>
        </div>
      )}
      {error && (
        <div style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid var(--color-danger)', borderRadius: 8, padding: '0.75rem', marginBottom: '1rem', color: 'var(--color-danger)', fontSize: '0.85rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <span>{t(lang, 'retryFailed')}</span>
          <button
            onClick={() => fetchAll(true)}
            style={{ background: 'var(--color-danger)', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: '0.78rem', cursor: 'pointer', flexShrink: 0 }}
          >
            {t(lang, 'retryNow')}
          </button>
        </div>
      )}

      {/* Fallback data banner */}
      {isFallback && !isLoading && elecAll.length > 0 && (
        <div style={{
          background: 'rgba(245,158,11,0.1)',
          border: '1px solid rgba(245,158,11,0.4)',
          borderRadius: 8,
          padding: '0.55rem 0.9rem',
          marginBottom: '0.75rem',
          fontSize: '0.78rem',
          color: '#f59e0b',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}>
          <span>&#9203;</span>
          <span>{t(lang, 'dataDelayed')} &mdash; {t(lang, 'dataAsOf')} {fallbackDate}</span>
        </div>
      )}

      {/* Usage cards */}
      <div style={{ display: 'grid', gridTemplateColumns: gridCols, gap: '0.75rem', marginBottom: '1rem' }}>
        <UsageCard
          icon={<Zap size={16} />}
          label={t(lang, 'electricity')}
          accentColor="var(--color-elec)"
          todayKwh={elecTodayKwh}
          yesterdayKwh={elecYestKwh}
          todayCostPence={elecTodayCost}
          lang={lang}
          unit="kWh"
          costLabel={t(lang, 'cost')}
          standingNote={t(lang, 'inclStanding')}
          isFallback={isFallback}
        />
        {hasGas && (
          <UsageCard
            icon={<Flame size={16} />}
            label={t(lang, 'gas')}
            accentColor="var(--color-gas)"
            todayKwh={gasTodayKwh}
            yesterdayKwh={gasYestKwh}
            todayCostPence={gasTodayCost}
            lang={lang}
            unit="kWh"
            costLabel={t(lang, 'cost')}
            standingNote={t(lang, 'inclStanding')}
            isFallback={isFallback}
          />
        )}
        {hasOutgoing && (
          <UsageCard
            icon={<Sun size={16} />}
            label={t(lang, 'solarExport')}
            accentColor="var(--color-solar)"
            todayKwh={outTodayKwh}
            yesterdayKwh={outYestKwh}
            todayCostPence={outTodayEarned}
            lang={lang}
            unit="kWh"
            costLabel={t(lang, 'earned')}
            isEarning
            isFallback={isFallback}
          />
        )}
      </div>

      {/* Agile rates missing warning */}
      {agileRatesMissing && (
        <div style={{ fontSize: '0.75rem', color: 'var(--color-muted)', marginBottom: '0.5rem', textAlign: 'center' }}>
          {t(lang, 'agileRatesMissing')}
        </div>
      )}

      {/* Agile cheap slot chip */}
      {cheapSlot && (
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          background: 'rgba(52,211,153,0.12)',
          border: '1px solid rgba(52,211,153,0.35)',
          borderRadius: 20, padding: '5px 14px',
          fontSize: '0.78rem', fontWeight: 700,
          color: 'var(--color-success)',
          marginBottom: '1rem',
        }}>
          &#9889; {t(lang, 'cheapestSlot')}: {new Date(cheapSlot.valid_from).toLocaleTimeString(lang === 'zh' ? 'zh-HK' : 'en-GB', { hour: '2-digit', minute: '2-digit' })}&#8211;{new Date(cheapSlot.valid_to).toLocaleTimeString(lang === 'zh' ? 'zh-HK' : 'en-GB', { hour: '2-digit', minute: '2-digit' })} &middot; {cheapSlot.value_inc_vat <= 0 ? t(lang, 'freeRate') : `${cheapSlot.value_inc_vat.toFixed(1)}p/kWh`}
        </div>
      )}

      {/* Total cost card */}
      <div className="card" style={{ marginBottom: '1rem' }}>
        {hasOutgoing ? (
          <>
            <div style={{ fontSize: '0.78rem', color: 'var(--color-muted)', marginBottom: '0.5rem' }}>{t(lang, 'totalToday')}</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
              <span style={{ fontSize: '0.82rem', color: 'var(--color-muted)' }}>{t(lang, 'electricityCost')} <span style={{ fontSize: '0.68rem', opacity: 0.65 }}>({t(lang, 'inclStanding')})</span></span>
              <span style={{ fontSize: '0.9rem', color: 'var(--color-text)' }}>£{penceToPounds(totalImportCost)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.82rem', color: 'var(--color-solar)' }}>{t(lang, 'solarEarned')}</span>
              <span style={{ fontSize: '0.9rem', color: 'var(--color-solar)' }}>-£{penceToPounds(outTodayEarned)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--color-border)', paddingTop: '0.5rem' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>{t(lang, 'netCost')}</span>
              <span style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--color-accent)' }}>
                £{penceToPounds(Math.max(0, netCost))}
              </span>
            </div>
          </>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--color-muted)', fontSize: '0.82rem' }}>
                {isFallback ? `${t(lang, 'dataAsOf')} ${fallbackDate}` : t(lang, 'totalToday')}
              </span>
            <span style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--color-accent)' }}>
              £{penceToPounds(totalImportCost)}
            </span>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--color-muted)' }}>{t(lang, 'yesterday')}</span>
          <span style={{ fontSize: '0.85rem', color: 'var(--color-muted)' }}>
            £{penceToPounds(elecYestCost + gasYestCost - outYestEarned)}
          </span>
        </div>
      </div>

      {/* Budget tracker */}
      <BudgetCard spentPence={monthSpentPence} projectedPence={projectedPence} daysElapsed={daysElapsed} />

      {/* Last 24h trend charts */}
      {elecAll.length > 0 && (
        <Last24hChart
          intervals={elecAll}
          label={t(lang, 'electricity')}
          accentColor="var(--color-elec)"
          lang={lang}
        />
      )}
      {hasGas && gasAll.length > 0 && (
        <Last24hChart
          intervals={gasAll}
          label={t(lang, 'gas')}
          accentColor="var(--color-gas)"
          lang={lang}
        />
      )}
      {hasOutgoing && outgoingAll.length > 0 && (
        <Last24hChart
          intervals={outgoingAll}
          label={t(lang, 'solarExport')}
          accentColor="var(--color-solar)"
          lang={lang}
        />
      )}

      {/* Heatmap */}
      {elecToday.length > 0 && (
        <div className="card">
          <h3 style={{ margin: '0 0 1rem', fontSize: '0.9rem', color: 'var(--color-muted)' }}>
            {t(lang, 'halfHourly')} — &#9889;
            {isFallback && (
              <span style={{ marginLeft: 8, fontSize: '0.72rem', color: '#f59e0b' }}>
                ({elecDisplayDay})
              </span>
            )}
          </h3>
          <HeatmapChart intervals={elecToday} accentColor="var(--color-elec)" />
        </div>
      )}
    </div>
  )
}

// ——————————————————————————————————————————
interface UsageCardProps {
  icon: React.ReactNode
  label: string
  accentColor: string
  todayKwh: number
  yesterdayKwh: number
  isFallback?: boolean
  todayCostPence: number
  lang: 'en' | 'zh'
  unit: string
  costLabel: string
  standingNote?: string
  isEarning?: boolean
}

function UsageCard({ icon, label, accentColor, todayKwh, yesterdayKwh, todayCostPence, lang, unit, costLabel, standingNote, isEarning, isFallback }: UsageCardProps) {
  const pctChange = yesterdayKwh > 0 ? ((todayKwh - yesterdayKwh) / yesterdayKwh) * 100 : 0
  // For solar export, more = better (green), so invert the colour logic
  const up = pctChange >= 0
  const isPositive = isEarning ? up : !up

  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: '0.6rem', color: accentColor }}>
        {icon}
        <span style={{ fontSize: '0.78rem', fontWeight: 700 }}>{label}</span>
      </div>
      <div style={{ fontSize: '1.5rem', fontWeight: 800, color: accentColor }}>
        {formatKwh(todayKwh)}
        <span style={{ fontSize: '0.7rem', fontWeight: 400, color: 'var(--color-muted)', marginLeft: 3 }}>{unit}</span>
      </div>
      <div style={{ fontSize: '0.78rem', color: 'var(--color-muted)', marginTop: 2 }}>
        £{penceToPounds(todayCostPence)} {costLabel}
      </div>
      {standingNote && (
        <div style={{ fontSize: '0.65rem', color: 'var(--color-muted)', marginTop: 1, opacity: 0.7 }}>
          {standingNote}
        </div>
      )}
      {yesterdayKwh > 0 && (
        <div style={{ marginTop: '0.5rem', fontSize: '0.72rem', color: isPositive ? 'var(--color-success)' : 'var(--color-danger)' }}>
          {up ? '▲' : '▼'} {Math.abs(pctChange).toFixed(1)}% vs {t(lang, isFallback ? 'vsYestLabel' : 'yesterday')}
        </div>
      )}
    </div>
  )
}
