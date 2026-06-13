import { useMemo } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts'
import type { AgileRate, Language } from '../../types'
import { t } from '../../lib/i18n'

interface Props {
  agileRates: AgileRate[]
  lang: Language
}

interface DayStat {
  date: string      // YYYY-MM-DD
  avg: number
  peak: number
  offPeak: number   // avg 00:00–07:00
}

function toUkDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit',
  }).split('/').reverse().join('-')
}

function toUkHour(iso: string): number {
  return parseInt(
    new Date(iso).toLocaleTimeString('en-GB', { timeZone: 'Europe/London', hour: '2-digit', hour12: false }),
    10
  )
}

export function AgileRateTrendChart({ agileRates, lang }: Props) {
  const dayStats: DayStat[] = useMemo(() => {
    if (!agileRates.length) return []

    // Group by UK date
    const byDay = new Map<string, AgileRate[]>()
    for (const r of agileRates) {
      const d = toUkDate(r.valid_from)
      const arr = byDay.get(d)
      if (arr) arr.push(r)
      else byDay.set(d, [r])
    }

    // Last 7 days sorted ascending
    const today = toUkDate(new Date().toISOString())
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - 7)
    const cutoffStr = toUkDate(cutoff.toISOString())

    return Array.from(byDay.entries())
      .filter(([d]) => d >= cutoffStr && d <= today)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, rates]) => {
        const vals = rates.map(r => r.value_inc_vat)
        const avg = vals.reduce((s, v) => s + v, 0) / vals.length
        const peak = Math.max(...vals)
        const offPeakRates = rates.filter(r => {
          const h = toUkHour(r.valid_from)
          return h >= 0 && h < 7
        })
        const offPeak = offPeakRates.length
          ? offPeakRates.reduce((s, r) => s + r.value_inc_vat, 0) / offPeakRates.length
          : avg
        return { date, avg: parseFloat(avg.toFixed(2)), peak: parseFloat(peak.toFixed(2)), offPeak: parseFloat(offPeak.toFixed(2)) }
      })
  }, [agileRates])

  if (dayStats.length < 2) return null

  // Short date label e.g. "Mon 10"
  function shortDate(d: string) {
    return new Date(d + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' })
  }

  const data = dayStats.map(s => ({ ...s, label: shortDate(s.date) }))
  const allVals = data.flatMap(d => [d.avg, d.peak, d.offPeak])
  const yMin = Math.min(0, Math.floor(Math.min(...allVals) - 2))
  const yMax = Math.ceil(Math.max(...allVals) + 5)

  return (
    <div className="card" style={{ marginBottom: '1rem' }}>
      <h3 style={{ margin: '0 0 0.25rem', fontSize: '0.9rem', color: 'var(--color-muted)' }}>
        {t(lang, 'agileRateTrend')}
      </h3>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 14, marginBottom: '0.75rem', flexWrap: 'wrap' }}>
        {[
          { label: t(lang, 'rateTrendAvg'),  color: '#a78bfa' },
          { label: t(lang, 'rateTrendPeak'), color: 'var(--color-danger)' },
          { label: t(lang, 'rateTrendOff'),  color: 'var(--color-success)' },
        ].map(({ label, color }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 24, height: 3, borderRadius: 2, background: color }} />
            <span style={{ fontSize: '0.7rem', color: 'var(--color-muted)' }}>{label}</span>
          </div>
        ))}
      </div>

      <ResponsiveContainer width="100%" height={160}>
        <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -18 }}>
          <defs>
            <linearGradient id="gradAvg" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#a78bfa" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#a78bfa" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--color-muted)' }} axisLine={false} tickLine={false} />
          <YAxis
            domain={[yMin, yMax]}
            tick={{ fontSize: 10, fill: 'var(--color-muted)' }}
            axisLine={false} tickLine={false}
            tickFormatter={v => `${v}p`}
          />
          <Tooltip
            contentStyle={{ background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: '0.75rem' }}
            formatter={(v) => [typeof v === 'number' ? `${v.toFixed(2)}p` : v, '']}
            labelStyle={{ color: 'var(--color-text)', fontWeight: 700, marginBottom: 4 }}
          />
          <ReferenceLine y={0} stroke="var(--color-border)" strokeDasharray="3 3" />
          <Area
            type="monotone" dataKey="peak"
            name={t(lang, 'rateTrendPeak')}
            stroke="var(--color-danger)" strokeWidth={1.5}
            fill="none" dot={false}
          />
          <Area
            type="monotone" dataKey="avg"
            name={t(lang, 'rateTrendAvg')}
            stroke="#a78bfa" strokeWidth={2}
            fill="url(#gradAvg)"
            dot={{ r: 3, fill: '#a78bfa', strokeWidth: 0 }}
          />
          <Area
            type="monotone" dataKey="offPeak"
            name={t(lang, 'rateTrendOff')}
            stroke="var(--color-success)" strokeWidth={1.5}
            fill="none" dot={false} strokeDasharray="4 2"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
