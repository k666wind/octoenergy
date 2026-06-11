import { useState, useRef } from 'react'
import { Upload, ExternalLink } from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'
import { t } from '../../lib/i18n'
import { importConfig } from '../../lib/exportImport'
import { validateCredentials, fetchAccountMeters } from '../../lib/octopusClient'
import { LoadingSpinner } from '../shared/LoadingSpinner'
import type { Credentials, TariffConfig, TariffType, OutgoingTariffType } from '../../types'
import { LanguageToggle } from '../shared/LanguageToggle'

const TOTAL_STEPS = 4

export function SetupWizard() {
  const lang = useAppStore((s) => s.config?.language ?? 'en')
  const { completeSetup, importSettings } = useAppStore()

  const [step, setStep] = useState(1)
  const [validating, setValidating] = useState(false)
  const [validationError, setValidationError] = useState('')
  const [importError, setImportError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  // Form state
  const [apiKey, setApiKey] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [mpan, setMpan] = useState('')
  const [elecSerial, setElecSerial] = useState('')
  const [mprn, setMprn] = useState('')
  const [gasSerial, setGasSerial] = useState('')
  const [tariffType, setTariffType] = useState<TariffType>('fixed')
  const [elecUnit, setElecUnit] = useState('24.50')
  const [elecStanding, setElecStanding] = useState('53.00')
  const [gasUnit, setGasUnit] = useState('6.24')
  const [gasStanding, setGasStanding] = useState('29.00')

  // Auto-detect state
  const [autoDetected, setAutoDetected] = useState(false)
  const [agileProductCodeState, setAgileProductCodeState] = useState('')
  const [dnoRegionState, setDnoRegionState] = useState('')

  // Outgoing / Solar state
  const [hasSolar, setHasSolar] = useState(false)
  const [outgoingMpan, setOutgoingMpan] = useState('')
  const [outgoingSerial, setOutgoingSerial] = useState('')
  const [outgoingTariffType, setOutgoingTariffType] = useState<OutgoingTariffType>('fixed')
  const [outgoingRate, setOutgoingRate] = useState('15.00')

  async function handleNext() {
    if (step === 1) {
      setValidating(true)
      setValidationError('')
      const creds: Credentials = {
        apiKey,
        accountNumber,
        electricity: { mpan: mpan || 'placeholder', serialNumber: elecSerial || 'placeholder' },
        gas: null,
        outgoing: null,
      }
      const ok = await validateCredentials(creds)
      if (!ok) {
        setValidating(false)
        setValidationError('Invalid API key or account number. Please check and try again.')
        return
      }
      // Auto-detect meter details
      try {
        const info = await fetchAccountMeters(apiKey, accountNumber)
        const importMeter = info.electricity.find(e => !e.isExport)
        const exportMeter = info.electricity.find(e => e.isExport)
        if (importMeter) {
          setMpan(importMeter.mpan)
          setElecSerial(importMeter.serialNumber)
          if (importMeter.tariffCode) {
            const parts = importMeter.tariffCode.split('-')
            const region = parts[parts.length - 1]
            const productCode = parts.slice(2, -1).join('-')
            if (productCode.startsWith('AGILE-')) {
              setTariffType('agile')
              setAgileProductCodeState(productCode)
              setDnoRegionState(region)
            }
          }
        }
        if (exportMeter) {
          setHasSolar(true)
          setOutgoingMpan(exportMeter.mpan)
          setOutgoingSerial(exportMeter.serialNumber)
        }
        if (info.gas.length > 0) {
          setMprn(info.gas[0].mprn)
          setGasSerial(info.gas[0].serialNumber)
        }
        setAutoDetected(true)
      } catch {
        // silently ignore — user can fill in manually
      }
      setValidating(false)
    }
    setStep((s) => s + 1)
  }

  function handleFinish() {
    const credentials: Credentials = {
      apiKey,
      accountNumber,
      electricity: { mpan, serialNumber: elecSerial },
      gas: mprn ? { mprn, serialNumber: gasSerial } : null,
      outgoing: (hasSolar && outgoingMpan && outgoingSerial)
        ? { mpan: outgoingMpan, serialNumber: outgoingSerial }
        : null,
    }
    const tariff: TariffConfig = {
      type: tariffType,
      fixed: {
        electricityUnitRate: parseFloat(elecUnit) || 0,
        electricityStandingCharge: parseFloat(elecStanding) || 0,
        gasUnitRate: parseFloat(gasUnit) || 0,
        gasStandingCharge: parseFloat(gasStanding) || 0,
      },
      outgoingType: outgoingTariffType,
      outgoingFixedRate: parseFloat(outgoingRate) || 0,
      agileProductCode: agileProductCodeState || undefined,
      dnoRegion: (dnoRegionState as import('../../types').DnoRegion) || undefined,
    }
    completeSetup(credentials, tariff)
  }

  function handleSkipGas() {
    setMprn('')
    setGasSerial('')
    setStep(4)
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImportError('')
    try {
      const { credentials, tariff } = await importConfig(file)
      importSettings(credentials, tariff)
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Import failed')
    }
  }

  const step1Valid = apiKey.trim().length > 10 && accountNumber.trim().length > 3
  const step2Valid = mpan.trim().length > 0 && elecSerial.trim().length > 0
  const step3Valid = (mprn.trim().length > 0 && gasSerial.trim().length > 0)

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1rem',
      background: 'var(--color-bg)',
    }}>
      {/* Top bar */}
      <div style={{ position: 'fixed', top: 16, right: 16 }}>
        <LanguageToggle />
      </div>

      <div style={{ width: '100%', maxWidth: 480 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>&#9889;</div>
          <h1 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 800, color: 'var(--color-text)' }}>
            OctoEnergy
          </h1>
          <p style={{ margin: '0.4rem 0 0', color: 'var(--color-muted)', fontSize: '0.9rem' }}>
            {t(lang, 'setupSubtitle')}
          </p>
        </div>

        {/* Import option */}
        <button
          className="btn-secondary"
          style={{ width: '100%', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
          onClick={() => fileRef.current?.click()}
        >
          <Upload size={16} />
          {t(lang, 'importConfig')}
        </button>
        <input ref={fileRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleImport} />
        {importError && <p style={{ color: 'var(--color-danger)', fontSize: '0.82rem', textAlign: 'center', marginBottom: '1rem' }}>{importError}</p>}

        <div style={{ position: 'relative', marginBottom: '1.2rem' }}>
          <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: 1, background: 'var(--color-border)', transform: 'translateY(-50%)' }} />
          <span style={{ position: 'relative', background: 'var(--color-bg)', padding: '0 12px', color: 'var(--color-muted)', fontSize: '0.75rem' }}>
            {t(lang, 'step')} {step} {t(lang, 'of')} {TOTAL_STEPS}
          </span>
        </div>

        {/* Step progress bar */}
        <div style={{ display: 'flex', gap: 4, marginBottom: '1.5rem' }}>
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <div key={i} style={{
              flex: 1, height: 3, borderRadius: 2,
              background: i < step ? 'var(--color-accent)' : 'var(--color-border)',
              transition: 'background 0.3s',
            }} />
          ))}
        </div>

        {/* Card */}
        <div className="card" style={{ marginBottom: '1rem' }}>
          {/* STEP 1: API Credentials */}
          {step === 1 && (
            <div>
              <h2 style={{ margin: '0 0 0.3rem', fontSize: '1.1rem' }}>{t(lang, 'stepApiTitle')}</h2>
              <p style={{ margin: '0 0 1.2rem', color: 'var(--color-muted)', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 4 }}>
                {t(lang, 'stepApiDesc')}
                <a href="https://octopus.energy/dashboard/developer" target="_blank" rel="noreferrer" style={{ color: 'var(--color-accent)' }}>
                  <ExternalLink size={13} />
                </a>
              </p>
              <label className="label">{t(lang, 'apiKey')}</label>
              <input className="input-field" style={{ marginBottom: '0.9rem' }} type="password" placeholder={t(lang, 'apiKeyPlaceholder')} value={apiKey} onChange={e => setApiKey(e.target.value)} />
              <label className="label">{t(lang, 'accountNumber')}</label>
              <input className="input-field" placeholder={t(lang, 'accountPlaceholder')} value={accountNumber} onChange={e => setAccountNumber(e.target.value)} />
              {validationError && <p style={{ color: 'var(--color-danger)', fontSize: '0.82rem', marginTop: '0.7rem' }}>{validationError}</p>}
            </div>
          )}

          {/* STEP 2: Electricity Meter + optional Solar */}
          {step === 2 && (
            <div>
              <h2 style={{ margin: '0 0 1.2rem', fontSize: '1.1rem' }}>{t(lang, 'stepElecTitle')}</h2>
              {autoDetected && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  background: 'rgba(52,211,153,0.12)',
                  border: '1px solid rgba(52,211,153,0.35)',
                  borderRadius: 20, padding: '5px 14px',
                  fontSize: '0.78rem', fontWeight: 700,
                  color: 'var(--color-success)',
                  marginBottom: '1rem',
                }}>
                  &#10003; {t(lang, 'autoDetected')}
                </div>
              )}
              <label className="label">{t(lang, 'mpan')}</label>
              <input className="input-field" style={{ marginBottom: '0.9rem' }} placeholder={t(lang, 'mpanPlaceholder')} value={mpan} onChange={e => setMpan(e.target.value)} />
              <label className="label">{t(lang, 'serialNumber')}</label>
              <input className="input-field" style={{ marginBottom: '1.2rem' }} placeholder={t(lang, 'serialPlaceholder')} value={elecSerial} onChange={e => setElecSerial(e.target.value)} />

              {/* Solar toggle */}
              <div
                onClick={() => setHasSolar(v => !v)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
                  padding: '0.7rem', borderRadius: 8,
                  background: hasSolar ? 'rgba(250,204,21,0.08)' : 'var(--color-surface)',
                  border: `1px solid ${hasSolar ? 'rgba(250,204,21,0.4)' : 'var(--color-border)'}`,
                  marginBottom: hasSolar ? '1rem' : 0,
                  userSelect: 'none',
                }}
              >
                <div style={{
                  width: 18, height: 18, borderRadius: 4, border: `2px solid ${hasSolar ? 'var(--color-solar)' : 'var(--color-border)'}`,
                  background: hasSolar ? 'var(--color-solar)' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  {hasSolar && <span style={{ color: '#000', fontSize: 12, lineHeight: 1 }}>&#10003;</span>}
                </div>
                <span style={{ fontSize: '0.85rem', color: hasSolar ? 'var(--color-solar)' : 'var(--color-muted)', fontWeight: 600 }}>
                  {t(lang, 'solarPanel')}
                </span>
              </div>

              {hasSolar && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
                  <div>
                    <label className="label">{t(lang, 'outgoingMpan')}</label>
                    <input className="input-field" placeholder={t(lang, 'mpanPlaceholder')} value={outgoingMpan} onChange={e => setOutgoingMpan(e.target.value)} />
                  </div>
                  <div>
                    <label className="label">{t(lang, 'outgoingSerial')}</label>
                    <input className="input-field" placeholder={t(lang, 'serialPlaceholder')} value={outgoingSerial} onChange={e => setOutgoingSerial(e.target.value)} />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 3: Gas Meter */}
          {step === 3 && (
            <div>
              <h2 style={{ margin: '0 0 0.3rem', fontSize: '1.1rem' }}>{t(lang, 'stepGasTitle')}</h2>
              <p style={{ margin: '0 0 1.2rem', color: 'var(--color-muted)', fontSize: '0.82rem' }}>{t(lang, 'stepGasDesc')}</p>
              <label className="label">{t(lang, 'mprn')}</label>
              <input className="input-field" style={{ marginBottom: '0.9rem' }} placeholder={t(lang, 'mprnPlaceholder')} value={mprn} onChange={e => setMprn(e.target.value)} />
              <label className="label">{t(lang, 'serialNumber')}</label>
              <input className="input-field" placeholder={t(lang, 'gasSerialPlaceholder')} value={gasSerial} onChange={e => setGasSerial(e.target.value)} />
            </div>
          )}

          {/* STEP 4: Tariff */}
          {step === 4 && (
            <div>
              <h2 style={{ margin: '0 0 1.2rem', fontSize: '1.1rem' }}>{t(lang, 'stepTariffTitle')}</h2>
              <label className="label">{t(lang, 'tariffType')}</label>
              <div style={{ display: 'flex', gap: 8, marginBottom: '1.2rem' }}>
                {(['fixed', 'agile', 'tracker'] as TariffType[]).map(tt => (
                  <button key={tt} onClick={() => setTariffType(tt)} style={{
                    flex: 1, padding: '0.5rem', borderRadius: 8, border: '1px solid',
                    borderColor: tariffType === tt ? 'var(--color-accent)' : 'var(--color-border)',
                    background: tariffType === tt ? 'rgba(224,64,251,0.12)' : 'transparent',
                    color: tariffType === tt ? 'var(--color-accent)' : 'var(--color-muted)',
                    cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600,
                  }}>
                    {t(lang, tt as 'fixed' | 'agile' | 'tracker')}
                  </button>
                ))}
              </div>

              {tariffType === 'fixed' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
                  <div>
                    <label className="label">{t(lang, 'electricityUnitRate')}</label>
                    <input className="input-field" type="number" step="0.01" value={elecUnit} onChange={e => setElecUnit(e.target.value)} />
                  </div>
                  <div>
                    <label className="label">{t(lang, 'electricityStanding')}</label>
                    <input className="input-field" type="number" step="0.01" value={elecStanding} onChange={e => setElecStanding(e.target.value)} />
                  </div>
                  {mprn && (
                    <>
                      <div>
                        <label className="label">{t(lang, 'gasUnitRate')}</label>
                        <input className="input-field" type="number" step="0.01" value={gasUnit} onChange={e => setGasUnit(e.target.value)} />
                      </div>
                      <div>
                        <label className="label">{t(lang, 'gasStanding')}</label>
                        <input className="input-field" type="number" step="0.01" value={gasStanding} onChange={e => setGasStanding(e.target.value)} />
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <p style={{ color: 'var(--color-muted)', fontSize: '0.85rem', background: 'var(--color-surface)', padding: '0.75rem', borderRadius: 8 }}>
                  {t(lang, 'agileNote')}
                </p>
              )}

              {/* Solar export tariff */}
              {hasSolar && (
                <div style={{ marginTop: '1.5rem', paddingTop: '1.2rem', borderTop: '1px solid var(--color-border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: '0.9rem' }}>
                    <span style={{ fontSize: '1rem' }}>&#9728;</span>
                    <span style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-solar)' }}>{t(lang, 'exportTariff')}</span>
                  </div>
                  <label className="label">{t(lang, 'outgoingTariffType')}</label>
                  <div style={{ display: 'flex', gap: 8, marginBottom: '0.9rem' }}>
                    {(['fixed', 'agile_export'] as OutgoingTariffType[]).map(ot => (
                      <button key={ot} onClick={() => setOutgoingTariffType(ot)} style={{
                        flex: 1, padding: '0.5rem', borderRadius: 8, border: '1px solid',
                        borderColor: outgoingTariffType === ot ? 'var(--color-solar)' : 'var(--color-border)',
                        background: outgoingTariffType === ot ? 'rgba(250,204,21,0.12)' : 'transparent',
                        color: outgoingTariffType === ot ? 'var(--color-solar)' : 'var(--color-muted)',
                        cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600,
                      }}>
                        {ot === 'fixed' ? t(lang, 'fixedSeg') : t(lang, 'agileExport')}
                      </button>
                    ))}
                  </div>
                  {outgoingTariffType === 'fixed' && (
                    <div>
                      <label className="label">{t(lang, 'outgoingFixedRate')}</label>
                      <input className="input-field" type="number" step="0.01" value={outgoingRate} onChange={e => setOutgoingRate(e.target.value)} />
                    </div>
                  )}
                  {outgoingTariffType === 'agile_export' && (
                    <p style={{ color: 'var(--color-muted)', fontSize: '0.85rem', background: 'var(--color-surface)', padding: '0.75rem', borderRadius: 8 }}>
                      {t(lang, 'agileNote')}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Buttons */}
        {validating ? (
          <LoadingSpinner label="Verifying credentials..." />
        ) : (
          <div style={{ display: 'flex', gap: 8 }}>
            {step > 1 && (
              <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setStep(s => s - 1)}>
                {t(lang, 'back')}
              </button>
            )}
            {step === 3 && (
              <button className="btn-secondary" style={{ flex: 1 }} onClick={handleSkipGas}>
                {t(lang, 'skip')}
              </button>
            )}
            {step < TOTAL_STEPS ? (
              <button
                className="btn-primary"
                style={{ flex: 2 }}
                disabled={
                  (step === 1 && !step1Valid) ||
                  (step === 2 && !step2Valid) ||
                  (step === 3 && !step3Valid)
                }
                onClick={handleNext}
              >
                {t(lang, 'next')}
              </button>
            ) : (
              <button className="btn-primary" style={{ flex: 2 }} onClick={handleFinish}>
                {t(lang, 'finish')}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
