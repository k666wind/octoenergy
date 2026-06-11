import type { ConsumptionInterval } from '../../types'

interface Props {
  intervals: ConsumptionInterval[]
  accentColor: string
}

export function HeatmapChart({ intervals, accentColor }: Props) {
  if (!intervals.length) return null

  const values = intervals.map(i => i.consumption)
  const max = Math.max(...values)

  // Build 24 hours × 2 slots grid
  const cells: { hour: number; slot: number; value: number }[] = []
  for (const interval of intervals) {
    const d = new Date(interval.interval_start)
    const hour = d.getHours()
    const slot = d.getMinutes() >= 30 ? 1 : 0
    cells.push({ hour, slot, value: interval.consumption })
  }

  const hours = Array.from({ length: 24 }, (_, i) => i)


  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(24, 1fr)', gap: 2 }}>
        {hours.map(h => {
          const slot0 = cells.find(c => c.hour === h && c.slot === 0)
          const slot1 = cells.find(c => c.hour === h && c.slot === 1)
          return (
            <div key={h} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <HeatCell value={slot0?.value ?? 0} max={max} color={accentColor} label={`${h}:00 — ${(slot0?.value ?? 0).toFixed(3)} kWh`} />
              <HeatCell value={slot1?.value ?? 0} max={max} color={accentColor} label={`${h}:30 — ${(slot1?.value ?? 0).toFixed(3)} kWh`} />
            </div>
          )
        })}
      </div>
      {/* X axis hour labels */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(24, 1fr)', gap: 2, marginTop: 4 }}>
        {hours.map(h => (
          <div key={h} style={{ textAlign: 'center', fontSize: '0.55rem', color: 'var(--color-muted)' }}>
            {h % 6 === 0 ? `${h}h` : ''}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.6rem', alignItems: 'center' }}>
        <span style={{ fontSize: '0.7rem', color: 'var(--color-muted)' }}>Low</span>
        <div style={{ flex: 1, height: 6, margin: '0 8px', borderRadius: 3, background: `linear-gradient(to right, transparent, ${accentColor})` }} />
        <span style={{ fontSize: '0.7rem', color: 'var(--color-muted)' }}>High — {max.toFixed(3)} kWh</span>
      </div>
    </div>
  )
}

function HeatCell({ value, max, color, label }: { value: number; max: number; color: string; label: string }) {
  const opacity = max > 0 ? 0.1 + (value / max) * 0.9 : 0.05
  return (
    <div
      title={label}
      style={{
        height: 14,
        borderRadius: 2,
        background: color,
        opacity: value > 0 ? opacity : 0.06,
        transition: 'opacity 0.2s',
        cursor: 'default',
      }}
    />
  )
}
