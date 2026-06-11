import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Legend,
} from 'recharts'
import type { ConsumptionInterval, Language } from '../../types'

interface Props {
  intervals: ConsumptionInterval[]
  label: string
  accentColor: string
  lang: Language
}

function fmtDateRange(start: Date, end: Date, lang: Language): string {
  const locale = lang === 'zh' ? 'zh-HK' : 'en-GB'
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }
  return `${start.toLocaleString(locale, opts)} – ${end.toLocaleString(locale, opts)}`
}

function fmtHour(offsetMs: number): string {
  const h = Math.floor(offsetMs / 3600000)
  const m = Math.floor((offsetMs % 3600000) / 60000)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function Last24hChart({ intervals, label, accentColor, lang }: Props) {
  if (!intervals.length) return null

  // Find latest available data point
  const latestMs = Math.max(...intervals.map(i => new Date(i.interval_end).getTime()))
  const windowEndMs = latestMs
  const windowStartMs = windowEndMs - 24 * 3600 * 1000
  const refStartMs = windowStartMs - 7 * 24 * 3600 * 1000
  const refEndMs = windowEndMs - 7 * 24 * 3600 * 1000

  const thisWindow = intervals.filter(i => {
    const t = new Date(i.interval_start).getTime()
    return t >= windowStartMs && t < windowEndMs
  })
  const refWindow = intervals.filter(i => {
    const t = new Date(i.interval_start).getTime()
    return t >= refStartMs && t < refEndMs
  })

  // Build map by offset (ms from window start) for this period
  const thisMap = new Map<number, number>()
  for (const iv of thisWindow) {
    const offset = new Date(iv.interval_start).getTime() - windowStartMs
    thisMap.set(offset, iv.consumption)
  }
  // Build map by offset for ref period (shift back 7 days so they align)
  const refMap = new Map<number, number>()
  for (const iv of refWindow) {
    const offset = new Date(iv.interval_start).getTime() - refStartMs
    refMap.set(offset, iv.consumption)
  }

  // Collect all unique offsets
  const allOffsets = Array.from(new Set([...thisMap.keys(), ...refMap.keys()])).sort((a, b) => a - b)

  const chartData = allOffsets.map(offset => ({
    time: fmtHour(offset),
    this: thisMap.get(offset) ?? null,
    ref: refMap.get(offset) ?? null,
  }))

  const thisLabel = fmtDateRange(new Date(windowStartMs), new Date(windowEndMs), lang)
  const refLabel = `${fmtDateRange(new Date(refStartMs), new Date(refEndMs), lang)} (${lang === 'zh' ? '7\u65e5\u524d' : '7 days ago'})`

  const CustomTooltip = ({ active, payload, label: tLabel }: any) => {
    if (!active || !payload?.length) return null
    return (
      <div style={{
        background: 'var(--color-card)', border: '1px solid var(--color-border)',
        borderRadius: 8, padding: '0.6rem 0.9rem', fontSize: '0.78rem',
      }}>
        <div style={{ fontWeight: 700, marginBottom: 4 }}>{tLabel}</div>
        {payload.map((p: any) => p.value != null && (
          <div key={p.dataKey} style={{ color: p.stroke }}>
            {p.name}: {Number(p.value).toFixed(3)} kWh
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="card" style={{ marginBottom: '1rem' }}>
      <h3 style={{ margin: '0 0 0.8rem', fontSize: '0.85rem', color: 'var(--color-muted)' }}>
        {label} — {lang === 'zh' ? '最近24小時' : 'Last 24 Hours'}
      </h3>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={chartData} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
          <XAxis
            dataKey="time"
            tick={{ fontSize: 9, fill: 'var(--color-muted)' }}
            tickLine={false}
            axisLine={false}
            interval={5}
          />
          <YAxis
            tick={{ fontSize: 9, fill: 'var(--color-muted)' }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: '0.7rem', paddingTop: '0.5rem' }}
            formatter={(_value: string, entry: any) => (
              <span style={{ color: entry.color, fontSize: '0.7rem' }}>
                {entry.dataKey === 'this' ? thisLabel : refLabel}
              </span>
            )}
          />
          <Line
            type="monotone"
            dataKey="this"
            stroke={accentColor}
            dot={false}
            strokeWidth={2}
            connectNulls
            name="this"
          />
          <Line
            type="monotone"
            dataKey="ref"
            stroke="var(--color-muted)"
            dot={false}
            strokeWidth={1.5}
            strokeDasharray="5 3"
            opacity={0.7}
            connectNulls
            name="ref"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
