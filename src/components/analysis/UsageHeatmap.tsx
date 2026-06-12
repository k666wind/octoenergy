import { useState } from 'react'

function toUkDate(isoStr: string): string {
  return new Date(isoStr).toLocaleDateString('en-GB', {
    timeZone: 'Europe/London',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).split('/').reverse().join('-')
}
import { t } from '../../lib/i18n'
import { calcElecCost, calcGasCost, penceToPounds } from '../../lib/costCalculator'
import type { ConsumptionInterval, AgileRate, Language, TariffConfig } from '../../types'

interface DayCell {
  date: string  // YYYY-MM-DD
  kwh: number
  costPence: number
}

type FuelMode = 'elec' | 'gas' | 'solar'

interface Props {
  elecIntervals: ConsumptionInterval[]
  gasIntervals: ConsumptionInterval[]
  solarIntervals: ConsumptionInterval[]
  agileRates: AgileRate[]
  tariff: TariffConfig
  hasGas: boolean
  hasSolar: boolean
  lang: Language
  onDaySelect?: (date: string) => void
}

function interpolateColor(t: number): string {
  // t: 0 = low (near card bg), 1 = high (elec amber)
  const r0 = 0x16, g0 = 0x21, b0 = 0x3e
  const r1 = 0xf5, g1 = 0x9e, b1 = 0x0b
  const r = Math.round(r0 + (r1 - r0) * t)
  const g = Math.round(g0 + (g1 - g0) * t)
  const b = Math.round(b0 + (b1 - b0) * t)
  return `rgb(${r},${g},${b})`
}

export function UsageHeatmap({ elecIntervals, gasIntervals, solarIntervals, agileRates, tariff, hasGas, hasSolar, lang, onDaySelect }: Props) {
  const [mode, setMode] = useState<FuelMode>('elec')
  const [tooltip, setTooltip] = useState<{ date: string; kwh: number; costPence: number } | null>(null)

  // Build 56 day cells (last 8 weeks, Mon-Sun)
  const today = new Date()
  today.setUTCHours(23, 59, 59, 999)
  const todayStr = toUkDate(today.toISOString())

  // Find last Sunday to align grid
  const dayOfWeek = today.getDay() // 0=Sun
  const daysToSunday = dayOfWeek === 0 ? 0 : dayOfWeek
  const gridEnd = new Date(today)
  gridEnd.setDate(gridEnd.getDate() - daysToSunday + 6) // end of this week (Saturday... wait let's do Mon-Sun)

  // Build Mon-Sun weeks: find the Monday 8 weeks ago
  const startDate = new Date(today)
  startDate.setDate(startDate.getDate() - 55) // 56 days = 8 weeks
  // Shift to Monday
  const startDow = startDate.getDay()
  const offsetToMon = startDow === 0 ? -6 : 1 - startDow
  startDate.setDate(startDate.getDate() + offsetToMon)

  const cells: DayCell[] = []
  for (let i = 0; i < 56; i++) {
    const d = new Date(startDate)
    d.setDate(d.getDate() + i)
    const dateStr = toUkDate(d.toISOString())

    const sourceIntervals = mode === 'elec' ? elecIntervals : mode === 'gas' ? gasIntervals : solarIntervals
    const dayIntervals = sourceIntervals.filter(iv => toUkDate(iv.interval_start) === dateStr)
    const kwh = dayIntervals.reduce((s, iv) => s + iv.consumption, 0)
    let costPence = 0
    if (mode === 'elec') costPence = calcElecCost(dayIntervals, tariff, agileRates, true)
    else if (mode === 'gas') costPence = calcGasCost(dayIntervals, tariff, true)
    else costPence = kwh * (tariff.outgoingFixedRate ?? 0)

    cells.push({ date: dateStr, kwh, costPence })
  }

  const maxKwh = Math.max(...cells.map(c => c.kwh), 0.001)

  const DOW_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const weeks: DayCell[][] = []
  for (let w = 0; w < 8; w++) weeks.push(cells.slice(w * 7, w * 7 + 7))

  const modeButtons: { id: FuelMode; label: string; show: boolean }[] = [
    { id: 'elec', label: t(lang, 'heatmapToggleElec'), show: true },
    { id: 'gas', label: t(lang, 'heatmapToggleGas'), show: hasGas },
    { id: 'solar', label: t(lang, 'heatmapToggleSolar'), show: hasSolar },
  ]

  return (
    <div>
      {/* Mode toggle */}
      <div style={{ display: 'flex', gap: 6, marginBottom: '0.9rem' }}>
        {modeButtons.filter(b => b.show).map(b => (
          <button
            key={b.id}
            onClick={() => setMode(b.id)}
            style={{
              padding: '4px 12px', borderRadius: 20, border: '1px solid',
              borderColor: mode === b.id ? 'var(--color-elec)' : 'var(--color-border)',
              background: mode === b.id ? 'rgba(245,158,11,0.15)' : 'transparent',
              color: mode === b.id ? 'var(--color-elec)' : 'var(--color-muted)',
              cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600,
            }}
          >
            {b.label}
          </button>
        ))}
      </div>

      {/* Day-of-week headers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 3, marginBottom: 3 }}>
        {DOW_LABELS.map(d => (
          <div key={d} style={{ textAlign: 'center', fontSize: '0.62rem', color: 'var(--color-muted)' }}>{d}</div>
        ))}
      </div>

      {/* Grid */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {weeks.map((week, wi) => (
          <div key={wi} style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 3 }}>
            {week.map((cell, di) => {
              const isFuture = cell.date > todayStr
              const hasData = cell.kwh > 0
              const intensity = hasData ? cell.kwh / maxKwh : 0
              const bg = isFuture || !hasData ? 'var(--color-surface)' : interpolateColor(intensity)
              return (
                <div
                  key={di}
                  onMouseEnter={() => hasData && !isFuture && setTooltip(cell)}
                  onMouseLeave={() => setTooltip(null)}
                  onClick={() => hasData && !isFuture && onDaySelect?.(cell.date)}
                  style={{
                    aspectRatio: '1',
                    borderRadius: 4,
                    background: bg,
                    cursor: hasData && !isFuture && onDaySelect ? 'pointer' : 'default',
                    opacity: isFuture ? 0.3 : 1,
                    position: 'relative',
                    transition: 'transform 0.1s',
                    outline: hasData && !isFuture && onDaySelect ? '1px solid transparent' : undefined,
                  }}
                  title={hasData && !isFuture ? `${cell.date}: ${cell.kwh.toFixed(2)} kWh` : cell.date}
                />
              )
            })}
          </div>
        ))}
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div style={{
          marginTop: '0.75rem',
          padding: '0.6rem 0.9rem',
          background: 'var(--color-card)',
          border: '1px solid var(--color-border)',
          borderRadius: 8,
          fontSize: '0.82rem',
          color: 'var(--color-text)',
        }}>
          <strong>{tooltip.date}</strong> &nbsp;|&nbsp;
          {tooltip.kwh.toFixed(3)} kWh &nbsp;|&nbsp;
          £{penceToPounds(tooltip.costPence)}
        </div>
      )}

      {/* Drill-down hint */}
      {onDaySelect && (
        <div style={{ marginTop: '0.5rem', fontSize: '0.68rem', color: 'var(--color-muted)', textAlign: 'right' }}>
          {lang === 'zh' ? '點擊格子查看當日詳情 →' : 'Tap a cell to view day details →'}
        </div>
      )}

      {/* Legend */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: '0.75rem' }}>
        <span style={{ fontSize: '0.68rem', color: 'var(--color-muted)' }}>{t(lang, 'lowUsage')}</span>
        <div style={{ display: 'flex', gap: 2 }}>
          {[0, 0.25, 0.5, 0.75, 1].map(v => (
            <div key={v} style={{ width: 14, height: 14, borderRadius: 3, background: interpolateColor(v) }} />
          ))}
        </div>
        <span style={{ fontSize: '0.68rem', color: 'var(--color-muted)' }}>{t(lang, 'highUsage')}</span>
      </div>
    </div>
  )
}
