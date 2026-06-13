import { useAppStore } from '../../store/useAppStore'
import { AgileRateTrendChart } from './AgileRateTrendChart'
import { t } from '../../lib/i18n'
import { Zap, Flame, Sun } from 'lucide-react'

export function TariffPage() {
  const lang = useAppStore(s => s.config?.language ?? 'en')
  const config = useAppStore(s => s.config)
  const cache = useAppStore(s => s.cache)

  if (!config) return null

  const { tariff, credentials } = config
  const hasGas = !!credentials.gas
  const hasOutgoing = !!credentials.outgoing
  const agileRates = cache.agileRates?.data ?? []

  const cheapest = agileRates.length
    ? agileRates.reduce((a, b) => a.value_inc_vat < b.value_inc_vat ? a : b)
    : null
  const priciest = agileRates.length
    ? agileRates.reduce((a, b) => a.value_inc_vat > b.value_inc_vat ? a : b)
    : null

  function fmtTime(iso: string) {
    return new Date(iso).toLocaleTimeString(lang === 'zh' ? 'zh-HK' : 'en-GB', {
      hour: '2-digit', minute: '2-digit',
    })
  }

  return (
    <div style={{ padding: '1rem 1rem 5rem' }}>
      <h1 style={{ margin: '0 0 1.2rem', fontSize: '1.3rem', fontWeight: 800 }}>
        {t(lang, 'tariffTitle')}
      </h1>

      {/* Tariff type badge */}
      <div style={{ marginBottom: '1rem' }}>
        <span style={{
          background: 'rgba(224,64,251,0.15)',
          color: 'var(--color-accent)',
          border: '1px solid rgba(224,64,251,0.3)',
          borderRadius: 20,
          padding: '4px 14px',
          fontSize: '0.8rem',
          fontWeight: 700,
        }}>
          {t(lang, tariff.type as 'fixed' | 'agile' | 'tracker')}
        </span>
      </div>

      {/* Fixed rates */}
      {tariff.type === 'fixed' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <RateCard
            icon={<Zap size={16} />}
            label={t(lang, 'electricity')}
            color="var(--color-elec)"
            unitRate={tariff.fixed.electricityUnitRate}
            standingCharge={tariff.fixed.electricityStandingCharge}
            lang={lang}
          />
          {hasGas && (
            <RateCard
              icon={<Flame size={16} />}
              label={t(lang, 'gas')}
              color="var(--color-gas)"
              unitRate={tariff.fixed.gasUnitRate}
              standingCharge={tariff.fixed.gasStandingCharge}
              lang={lang}
            />
          )}
        </div>
      )}

      {/* Agile rates */}
      {tariff.type === 'agile' && (
        <div>
          {/* Highlight cheapest / priciest */}
          {cheapest && priciest && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
              <div className="card" style={{ borderColor: 'var(--color-success)' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--color-muted)', marginBottom: 4 }}>{t(lang, 'cheapest')}</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--color-success)' }}>
                  {cheapest.value_inc_vat.toFixed(2)}p
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--color-muted)' }}>
                  {fmtTime(cheapest.valid_from)}
                </div>
              </div>
              <div className="card" style={{ borderColor: 'var(--color-danger)' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--color-muted)', marginBottom: 4 }}>{t(lang, 'mostExpensive')}</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--color-danger)' }}>
                  {priciest.value_inc_vat.toFixed(2)}p
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--color-muted)' }}>
                  {fmtTime(priciest.valid_from)}
                </div>
              </div>
            </div>
          )}

          {/* 7-day rate trend chart */}
          <AgileRateTrendChart agileRates={agileRates} lang={lang} />

          {/* Half-hourly rate list */}
          <div className="card">
            <h3 style={{ margin: '0 0 0.75rem', fontSize: '0.9rem', color: 'var(--color-muted)' }}>
              {t(lang, 'agileRates')}
            </h3>

            {/* Colour legend */}
            <div style={{ display: 'flex', gap: 10, marginBottom: '0.9rem', flexWrap: 'wrap' }}>
              {[
                { label: '< 15p', bg: 'rgba(52,211,153,0.15)', color: 'var(--color-success)' },
                { label: '15–30p', bg: 'rgba(245,158,11,0.15)', color: 'var(--color-elec)' },
                { label: '> 30p', bg: 'rgba(248,113,113,0.15)', color: 'var(--color-danger)' },
              ].map(({ label, bg, color }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <div style={{ width: 12, height: 12, borderRadius: 3, background: bg, border: `1px solid ${color}` }} />
                  <span style={{ fontSize: '0.7rem', color: 'var(--color-muted)' }}>{label}</span>
                </div>
              ))}
            </div>

            {agileRates.length === 0 ? (
              <p style={{ color: 'var(--color-muted)', fontSize: '0.85rem' }}>{t(lang, 'noData')}</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 400, overflowY: 'auto' }}>
                {[...agileRates]
                  .sort((a, b) => a.valid_from.localeCompare(b.valid_from))
                  .map((rate, i) => {
                    const pct = (rate.value_inc_vat / (priciest?.value_inc_vat ?? 1)) * 100
                    const isNegOrFree = rate.value_inc_vat <= 0
                    const isCheap = rate.value_inc_vat < 15
                    const isExpensive = rate.value_inc_vat > 30
                    const textColor = isNegOrFree
                      ? 'var(--color-success)'
                      : isCheap
                        ? 'var(--color-success)'
                        : isExpensive
                          ? 'var(--color-danger)'
                          : 'var(--color-text)'
                    const rowBg = isNegOrFree || isCheap
                      ? 'rgba(52,211,153,0.10)'
                      : isExpensive
                        ? 'rgba(248,113,113,0.10)'
                        : 'rgba(245,158,11,0.10)'
                    return (
                      <div key={i} style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '4px 6px', borderRadius: 6,
                        background: rowBg,
                      }}>
                        <span style={{ fontSize: '0.72rem', color: 'var(--color-muted)', width: 40, flexShrink: 0 }}>
                          {fmtTime(rate.valid_from)}
                        </span>
                        <div style={{ flex: 1, height: 6, background: 'var(--color-border)', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ width: `${Math.max(pct, 2)}%`, height: '100%', background: textColor, borderRadius: 3, transition: 'width 0.3s' }} />
                        </div>
                        <span style={{ fontSize: '0.78rem', fontWeight: 700, color: textColor, width: 52, textAlign: 'right', flexShrink: 0 }}>
                          {rate.value_inc_vat.toFixed(2)}p
                        </span>
                      </div>
                    )
                  })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Solar Export Tariff */}
      {hasOutgoing && (
        <div style={{ marginTop: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: '0.8rem' }}>
            <Sun size={16} style={{ color: 'var(--color-solar)' }} />
            <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--color-solar)' }}>
              {t(lang, 'solarExport')}
            </span>
          </div>
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '0.8rem' }}>
              <span style={{
                background: 'rgba(250,204,21,0.15)',
                color: 'var(--color-solar)',
                border: '1px solid rgba(250,204,21,0.3)',
                borderRadius: 20, padding: '3px 12px',
                fontSize: '0.78rem', fontWeight: 700,
              }}>
                {tariff.outgoingType === 'fixed' ? t(lang, 'fixedSeg') : t(lang, 'agileExport')}
              </span>
            </div>
            {tariff.outgoingType === 'fixed' && (
              <div>
                <div style={{ fontSize: '0.72rem', color: 'var(--color-muted)', marginBottom: 2 }}>{t(lang, 'exportRate')}</div>
                <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--color-solar)' }}>
                  {(tariff.outgoingFixedRate ?? 0).toFixed(2)}
                  <span style={{ fontSize: '0.72rem', fontWeight: 400, color: 'var(--color-muted)', marginLeft: 2 }}>{t(lang, 'perKwh')}</span>
                </div>
              </div>
            )}
            {tariff.outgoingType === 'agile_export' && (
              <p style={{ color: 'var(--color-muted)', fontSize: '0.85rem', margin: 0 }}>
                {t(lang, 'agileNote')}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Tracker */}
      {tariff.type === 'tracker' && (
        <div className="card">
          <p style={{ color: 'var(--color-muted)', fontSize: '0.85rem', margin: 0 }}>
            {t(lang, 'agileNote')}
          </p>
        </div>
      )}
    </div>
  )
}

interface RateCardProps {
  icon: React.ReactNode
  label: string
  color: string
  unitRate: number
  standingCharge: number
  lang: 'en' | 'zh'
}

function RateCard({ icon, label, color, unitRate, standingCharge, lang }: RateCardProps) {
  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: '0.8rem', color }}>
        {icon}
        <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{label}</span>
      </div>
      <div style={{ display: 'flex', gap: '1rem' }}>
        <div>
          <div style={{ fontSize: '0.72rem', color: 'var(--color-muted)', marginBottom: 2 }}>{t(lang, 'unitRate')}</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color }}>
            {unitRate.toFixed(2)}
            <span style={{ fontSize: '0.72rem', fontWeight: 400, color: 'var(--color-muted)', marginLeft: 2 }}>{t(lang, 'perKwh')}</span>
          </div>
        </div>
        <div>
          <div style={{ fontSize: '0.72rem', color: 'var(--color-muted)', marginBottom: 2 }}>{t(lang, 'standingCharge')}</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--color-muted)' }}>
            {standingCharge.toFixed(2)}
            <span style={{ fontSize: '0.72rem', fontWeight: 400, marginLeft: 2 }}>{t(lang, 'perDay')}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
