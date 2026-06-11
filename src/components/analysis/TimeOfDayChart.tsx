import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { t } from '../../lib/i18n'
import type { ConsumptionInterval, AgileRate, Language } from '../../types'
import { agileCost } from '../../lib/costCalculator'

interface BandData {
  band: string
  avgKwh: number
  avgRate?: number
}

interface Props {
  intervals: ConsumptionInterval[]
  agileRates: AgileRate[]
  isAgile: boolean
  lang: Language
}

const BANDS = [
  { key: 'night',     label: 'bandNight',     start: 0,  end: 6  },
  { key: 'morning',   label: 'bandMorning',   start: 6,  end: 12 },
  { key: 'afternoon', label: 'bandAfternoon', start: 12, end: 18 },
  { key: 'evening',   label: 'bandEvening',   start: 18, end: 24 },
] as const

const BAND_COLORS = ['#818cf8', '#34d399', '#f59e0b', '#e040fb']

export function TimeOfDayChart({ intervals, agileRates, isAgile, lang }: Props) {
  // Group intervals by day, then by band within each day
  const dayMap: Record<string, ConsumptionInterval[]> = {}
  for (const iv of intervals) {
    const day = iv.interval_start.slice(0, 10)
    if (!dayMap[day]) dayMap[day] = []
    dayMap[day].push(iv)
  }
  const days = Object.keys(dayMap)
  if (!days.length) return null

  const data: BandData[] = BANDS.map((band, bi) => {
    const bandIntervalsByDay: ConsumptionInterval[][] = days.map(day =>
      dayMap[day].filter(iv => {
        const hour = new Date(iv.interval_start).getUTCHours()
        return hour >= band.start && hour < band.end
      })
    )

    const totalKwhPerDay = bandIntervalsByDay.map(ivs => ivs.reduce((s, i) => s + i.consumption, 0))
    const avgKwh = totalKwhPerDay.reduce((s, v) => s + v, 0) / days.length

    let avgRate: number | undefined
    if (isAgile && agileRates.length) {
      const allBandIntervals = bandIntervalsByDay.flat()
      if (allBandIntervals.length) {
        const totalCost = agileCost(allBandIntervals, agileRates)
        const totalKwh = allBandIntervals.reduce((s, i) => s + i.consumption, 0)
        avgRate = totalKwh > 0 ? totalCost / totalKwh : 0
      }
    }

    return { band: t(lang, band.label as Parameters<typeof t>[1]), avgKwh, avgRate, _bi: bi }
  }).map(({ _bi: _, ...rest }) => rest) as BandData[]

  return (
    <div>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
          <XAxis dataKey="band" tick={{ fill: 'var(--color-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: 'var(--color-muted)', fontSize: 10 }} axisLine={false} tickLine={false} unit=" kWh" width={54} />
          <Tooltip
            contentStyle={{ background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 8 }}
            labelStyle={{ color: 'var(--color-text)', fontWeight: 700, fontSize: 12 }}
            itemStyle={{ color: 'var(--color-muted)', fontSize: 11 }}
            formatter={(value) => {
              const num = typeof value === 'number' ? value : parseFloat(String(value ?? '0'))
              return [`${isNaN(num) ? '0.000' : num.toFixed(3)} kWh`, t(lang, 'avgPerDay')] as unknown as [string, string]
            }}
          />
          <Bar dataKey="avgKwh" radius={[4, 4, 0, 0]}>
            {data.map((_, i) => (
              <Cell key={i} fill={BAND_COLORS[i % BAND_COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 4, marginTop: 8 }}>
        {data.map((d, i) => (
          <div key={i} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '0.9rem', fontWeight: 800, color: BAND_COLORS[i] }}>
              {d.avgKwh.toFixed(2)}
            </div>
            <div style={{ fontSize: '0.65rem', color: 'var(--color-muted)' }}>{t(lang, 'avgPerDay')}</div>
            {isAgile && d.avgRate !== undefined && (
              <div style={{ fontSize: '0.68rem', color: 'var(--color-muted)' }}>
                {d.avgRate.toFixed(1)}p {t(lang, 'avgRate')}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
