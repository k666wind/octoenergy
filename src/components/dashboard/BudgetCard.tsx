import { useState } from 'react'
import { Target, Edit2, Check, X } from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'
import { t } from '../../lib/i18n'

interface Props {
  spentPence: number        // total spent so far this month
  projectedPence: number    // projected month-end total
  daysElapsed: number       // days elapsed in current month (for reliability guard)
}

export function BudgetCard({ spentPence, projectedPence, daysElapsed }: Props) {
  const lang = useAppStore(s => s.config?.language ?? 'en')
  const budget = useAppStore(s => s.config?.budget)
  const setBudget = useAppStore(s => s.setBudget)

  const [editing, setEditing] = useState(false)
  const [inputVal, setInputVal] = useState(String(budget?.monthlyLimitPounds ?? ''))

  const limitPounds = budget?.monthlyLimitPounds ?? 0
  const limitPence = limitPounds * 100
  const spentPounds = spentPence / 100
  const projectedPounds = projectedPence / 100

  // Projection is unreliable if fewer than 3 days have elapsed this month
  const projectionReliable = daysElapsed >= 3
  const pct = limitPence > 0 ? Math.min((spentPence / limitPence) * 100, 100) : 0
  const projectedPct = limitPence > 0 ? Math.min((projectedPence / limitPence) * 100, 100) : 0

  const status: 'ok' | 'warning' | 'over' =
    limitPence === 0 ? 'ok'
    : !projectionReliable ? 'ok'
    : projectedPence > limitPence ? 'over'
    : projectedPence > limitPence * 0.85 ? 'warning'
    : 'ok'

  const barColor =
    status === 'over' ? 'var(--color-danger)'
    : status === 'warning' ? '#f59e0b'
    : 'var(--color-success)'

  const statusLabel =
    status === 'over' ? t(lang, 'budgetOver')
    : status === 'warning' ? t(lang, 'budgetWarning')
    : t(lang, 'budgetOnTrack')

  function handleSave() {
    const v = parseFloat(inputVal)
    if (!isNaN(v) && v > 0) {
      setBudget({ monthlyLimitPounds: v })
    } else if (inputVal === '' || v === 0) {
      setBudget(null)
    }
    setEditing(false)
  }

  function handleCancel() {
    setInputVal(String(budget?.monthlyLimitPounds ?? ''))
    setEditing(false)
  }

  // No budget set — show a minimal prompt
  if (!budget?.monthlyLimitPounds && !editing) {
    return (
      <div
        className="card"
        onClick={() => setEditing(true)}
        style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, marginBottom: '1rem' }}
      >
        <Target size={16} style={{ color: 'var(--color-muted)', flexShrink: 0 }} />
        <span style={{ fontSize: '0.82rem', color: 'var(--color-muted)' }}>
          {t(lang, 'noBudgetSet')}
        </span>
      </div>
    )
  }

  return (
    <div className="card" style={{ marginBottom: '1rem' }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Target size={14} style={{ color: barColor }} />
          <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--color-text)' }}>
            {t(lang, 'budget')}
          </span>
          {!editing && (
            <span style={{
              fontSize: '0.68rem', fontWeight: 600, padding: '2px 7px', borderRadius: 20,
              background: status === 'over' ? 'rgba(248,113,113,0.15)' : status === 'warning' ? 'rgba(245,158,11,0.15)' : 'rgba(52,211,153,0.15)',
              color: barColor,
            }}>
              {statusLabel}
            </span>
          )}
        </div>
        {!editing ? (
          <button
            onClick={() => setEditing(true)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-muted)', padding: 4 }}
          >
            <Edit2 size={13} />
          </button>
        ) : (
          <div style={{ display: 'flex', gap: 4 }}>
            <button onClick={handleSave} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-success)', padding: 4 }}>
              <Check size={14} />
            </button>
            <button onClick={handleCancel} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-muted)', padding: 4 }}>
              <X size={14} />
            </button>
          </div>
        )}
      </div>

      {editing ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: 'var(--color-muted)', fontSize: '0.9rem' }}>£</span>
          <input
            className="input-field"
            type="number"
            min="0"
            step="10"
            placeholder="150"
            value={inputVal}
            onChange={e => setInputVal(e.target.value)}
            style={{ flex: 1 }}
            autoFocus
          />
          <span style={{ fontSize: '0.78rem', color: 'var(--color-muted)', whiteSpace: 'nowrap' }}>/ month</span>
        </div>
      ) : (
        <>
          {/* Spent vs limit */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--color-muted)' }}>
              £{spentPounds.toFixed(2)} {t(lang, 'budgetUsed')}
              <span style={{ fontSize: '0.62rem', opacity: 0.6, marginLeft: 3 }}>({t(lang, 'inclStanding')})</span>
            </span>
            <span style={{ fontSize: '0.78rem', color: 'var(--color-muted)' }}>
              {t(lang, 'budgetOf')} £{limitPounds.toFixed(0)}
            </span>
          </div>

          {/* Progress bar */}
          <div style={{ height: 7, borderRadius: 4, background: 'var(--color-surface)', overflow: 'hidden', marginBottom: '0.5rem' }}>
            <div style={{ height: '100%', borderRadius: 4, background: barColor, width: `${pct}%`, transition: 'width 0.4s ease' }} />
          </div>

          {/* Projected line */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--color-muted)' }}>
              {t(lang, 'projectedMonthly')}
              {!projectionReliable && (
                <span style={{ marginLeft: 4, fontSize: '0.65rem', color: 'var(--color-muted)', fontStyle: 'italic' }}>
                  ({lang === 'zh' ? '數據不足' : 'insufficient data'})
                </span>
              )}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {projectionReliable ? (
                <>
                  <div style={{ width: 60, height: 4, borderRadius: 2, background: 'var(--color-border)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', borderRadius: 2, background: barColor, opacity: 0.4, width: `${projectedPct}%` }} />
                  </div>
                  <span style={{ fontSize: '0.78rem', fontWeight: 700, color: barColor }}>
                    £{projectedPounds.toFixed(2)}
                  </span>
                </>
              ) : (
                <span style={{ fontSize: '0.75rem', color: 'var(--color-muted)', fontStyle: 'italic' }}>—</span>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
