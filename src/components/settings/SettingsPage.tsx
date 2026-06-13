import { useState, useRef } from 'react'
import { Download, Upload, Trash2, Key, Zap, Bell, Building2 } from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'
import { t } from '../../lib/i18n'
import { exportConfig, importConfig } from '../../lib/exportImport'
import { LanguageToggle } from '../shared/LanguageToggle'
import type { Credentials, TariffConfig, TariffType, OutgoingTariffType, DnoRegion, AgileAlertConfig, PropertyInfo } from '../../types'

export function SettingsPage() {
  const lang = useAppStore(s => s.config?.language ?? 'en')
  const config = useAppStore(s => s.config)
  const { resetAll, saveCredentials, saveTariff, importSettings, setAgileAlert, setProperties, setSelectedProperty } = useAppStore()

  const [importMsg, setImportMsg] = useState('')
  const [importOk, setImportOk] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const [editingCreds, setEditingCreds] = useState(false)
  const [editingTariff, setEditingTariff] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // Agile alert state
  const [alertEnabled, setAlertEnabled] = useState(config?.agileAlert?.enabled ?? false)
  const [alertThreshold, setAlertThreshold] = useState(String(config?.agileAlert?.thresholdPence ?? '15'))
  const [alertSaved, setAlertSaved] = useState(false)
  const [alertDenied, setAlertDenied] = useState(false)

  // Multi-property state
  const [propLoading, setPropLoading] = useState(false)
  const [propError, setPropError] = useState('')
  const [properties, setLocalProperties] = useState<PropertyInfo[]>(config?.properties ?? [])
  const [selectedPropIdx, setSelectedPropIdx] = useState(config?.selectedPropertyIndex ?? -1)

  // Editable credential fields
  const [apiKey, setApiKey] = useState(config?.credentials.apiKey ?? '')
  const [accountNumber, setAccountNumber] = useState(config?.credentials.accountNumber ?? '')
  const [mpan, setMpan] = useState(config?.credentials.electricity.mpan ?? '')
  const [elecSerial, setElecSerial] = useState(config?.credentials.electricity.serialNumber ?? '')
  const [mprn, setMprn] = useState(config?.credentials.gas?.mprn ?? '')
  const [gasSerial, setGasSerial] = useState(config?.credentials.gas?.serialNumber ?? '')
  const [outgoingMpan, setOutgoingMpan] = useState(config?.credentials.outgoing?.mpan ?? '')
  const [outgoingSerial, setOutgoingSerial] = useState(config?.credentials.outgoing?.serialNumber ?? '')

  // Editable tariff fields
  const [tariffType, setTariffType] = useState<TariffType>(config?.tariff.type ?? 'fixed')
  const [elecUnit, setElecUnit] = useState(String(config?.tariff.fixed.electricityUnitRate ?? ''))
  const [elecStanding, setElecStanding] = useState(String(config?.tariff.fixed.electricityStandingCharge ?? ''))
  const [gasUnit, setGasUnit] = useState(String(config?.tariff.fixed.gasUnitRate ?? ''))
  const [gasStanding, setGasStanding] = useState(String(config?.tariff.fixed.gasStandingCharge ?? ''))
  const [outgoingTariffType, setOutgoingTariffType] = useState<OutgoingTariffType>(config?.tariff.outgoingType ?? 'fixed')
  const [outgoingRate, setOutgoingRate] = useState(String(config?.tariff.outgoingFixedRate ?? '0'))
  const [dnoRegion, setDnoRegion] = useState<DnoRegion>(config?.tariff.dnoRegion ?? 'C')
  const [agileProductCode, setAgileProductCode] = useState(config?.tariff.agileProductCode ?? '')

  function handleExport() {
    if (!config) return
    exportConfig(config)
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImportMsg('')
    try {
      const { credentials, tariff } = await importConfig(file)
      importSettings(credentials, tariff)
      setImportMsg(t(lang, 'importSuccess'))
      setImportOk(true)
    } catch (err) {
      setImportMsg(err instanceof Error ? err.message : t(lang, 'importError'))
      setImportOk(false)
    }
    e.target.value = ''
  }

  async function handleSaveAlert() {
    setAlertDenied(false)
    if (alertEnabled) {
      const perm = await Notification.requestPermission()
      if (perm !== 'granted') {
        setAlertDenied(true)
        return
      }
    }
    const cfg: AgileAlertConfig = { enabled: alertEnabled, thresholdPence: parseFloat(alertThreshold) || 15 }
    setAgileAlert(cfg)
    setAlertSaved(true)
    setTimeout(() => setAlertSaved(false), 2000)
  }

  async function handleLoadProperties() {
    if (!config?.credentials.apiKey || !config.credentials.accountNumber) return
    setPropLoading(true)
    setPropError('')
    try {
      const res = await fetch(
        `https://api.octopus.energy/v1/accounts/${config.credentials.accountNumber}/`,
        { headers: { Authorization: 'Basic ' + btoa(config.credentials.apiKey + ':') } }
      )
      if (!res.ok) throw new Error('HTTP ' + res.status)
      const data = await res.json()
      const props: PropertyInfo[] = (data.properties ?? []).map((p: { address_line_1?: string; postcode?: string; electricity_meter_points?: Array<{ mpan: string; is_export?: boolean; meters?: Array<{ serial_number: string }> }>; gas_meter_points?: Array<{ mprn: string; meters?: Array<{ serial_number: string }> }> }) => ({
        address: [p.address_line_1, p.postcode].filter(Boolean).join(', ') || 'Property',
        electricity: (p.electricity_meter_points ?? []).map((mp: { mpan: string; is_export?: boolean; meters?: Array<{ serial_number: string }> }) => ({
          mpan: mp.mpan,
          serialNumber: mp.meters?.[0]?.serial_number ?? '',
          isExport: mp.is_export ?? false,
        })),
        gas: (p.gas_meter_points ?? []).map((mp: { mprn: string; meters?: Array<{ serial_number: string }> }) => ({
          mprn: mp.mprn,
          serialNumber: mp.meters?.[0]?.serial_number ?? '',
        })),
      }))
      setLocalProperties(props)
      setProperties(props)
    } catch {
      setPropError(t(lang, 'multiPropertyError'))
    }
    setPropLoading(false)
  }

  function handleApplyProperty(idx: number) {
    setSelectedPropIdx(idx)
    setSelectedProperty(idx)
  }

  function handleSaveCreds() {
    const creds: Credentials = {
      apiKey,
      accountNumber,
      electricity: { mpan, serialNumber: elecSerial },
      gas: mprn ? { mprn, serialNumber: gasSerial } : null,
      outgoing: outgoingMpan ? { mpan: outgoingMpan, serialNumber: outgoingSerial } : null,
    }
    saveCredentials(creds)
    setEditingCreds(false)
  }

  function handleSaveTariff() {
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
      dnoRegion: dnoRegion,
      agileProductCode: agileProductCode || undefined,
    }
    saveTariff(tariff)
    setEditingTariff(false)
  }

  const hasGas = !!config?.credentials.gas || mprn

  return (
    <div style={{ padding: '1rem 1rem 5rem' }}>
      <h1 style={{ margin: '0 0 1.5rem', fontSize: '1.3rem', fontWeight: 800 }}>{t(lang, 'settingsTitle')}</h1>

      {/* Language */}
      <Section title={t(lang, 'language')}>
        <LanguageToggle />
      </Section>

      {/* Export */}
      <Section title={t(lang, 'exportConfig')} desc={t(lang, 'exportDesc')}>
        <button className="btn-primary" onClick={handleExport} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Download size={15} /> {t(lang, 'exportBtn')}
        </button>
      </Section>

      {/* Import */}
      <Section title={t(lang, 'importBtn')} desc={t(lang, 'importDesc')}>
        <button className="btn-secondary" onClick={() => fileRef.current?.click()} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Upload size={15} /> {t(lang, 'importBtn')}
        </button>
        <input ref={fileRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleImport} />
        {importMsg && (
          <p style={{ marginTop: '0.5rem', fontSize: '0.82rem', color: importOk ? 'var(--color-success)' : 'var(--color-danger)' }}>
            {importMsg}
          </p>
        )}
      </Section>

      {/* Edit Credentials */}
      <Section title={t(lang, 'editCredentials')}>
        {!editingCreds ? (
          <button className="btn-secondary" onClick={() => setEditingCreds(true)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Key size={15} /> {t(lang, 'editCredentials')}
          </button>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div>
              <label className="label">{t(lang, 'apiKey')}</label>
              <input className="input-field" type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} />
            </div>
            <div>
              <label className="label">{t(lang, 'accountNumber')}</label>
              <input className="input-field" value={accountNumber} onChange={e => setAccountNumber(e.target.value)} />
            </div>
            <div>
              <label className="label">{t(lang, 'mpan')}</label>
              <input className="input-field" value={mpan} onChange={e => setMpan(e.target.value)} />
            </div>
            <div>
              <label className="label">{t(lang, 'serialNumber')} (Elec)</label>
              <input className="input-field" value={elecSerial} onChange={e => setElecSerial(e.target.value)} />
            </div>
            <div>
              <label className="label">{t(lang, 'mprn')} ({t(lang, 'skip')})</label>
              <input className="input-field" value={mprn} onChange={e => setMprn(e.target.value)} />
            </div>
            {mprn && (
              <div>
                <label className="label">{t(lang, 'serialNumber')} (Gas)</label>
                <input className="input-field" value={gasSerial} onChange={e => setGasSerial(e.target.value)} />
              </div>
            )}
            <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '0.75rem', marginTop: '0.25rem' }}>
              <div style={{ fontSize: '0.78rem', color: 'var(--color-solar)', fontWeight: 700, marginBottom: '0.5rem' }}>
                {t(lang, 'solarExport')}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                <div>
                  <label className="label">{t(lang, 'outgoingMpan')} (optional)</label>
                  <input className="input-field" value={outgoingMpan} onChange={e => setOutgoingMpan(e.target.value)} />
                </div>
                {outgoingMpan && (
                  <div>
                    <label className="label">{t(lang, 'outgoingSerial')}</label>
                    <input className="input-field" value={outgoingSerial} onChange={e => setOutgoingSerial(e.target.value)} />
                  </div>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setEditingCreds(false)}>{t(lang, 'back')}</button>
              <button className="btn-primary" style={{ flex: 2 }} onClick={handleSaveCreds}>Save</button>
            </div>
          </div>
        )}
      </Section>

      {/* Edit Tariff */}
      <Section title={t(lang, 'editTariff')}>
        {!editingTariff ? (
          <button className="btn-secondary" onClick={() => setEditingTariff(true)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Zap size={15} /> {t(lang, 'editTariff')}
          </button>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div>
              <label className="label">{t(lang, 'tariffType')}</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {(['fixed', 'agile', 'tracker'] as TariffType[]).map(tt => (
                  <button key={tt} onClick={() => setTariffType(tt)} style={{
                    flex: 1, padding: '0.4rem', borderRadius: 8, border: '1px solid',
                    borderColor: tariffType === tt ? 'var(--color-accent)' : 'var(--color-border)',
                    background: tariffType === tt ? 'rgba(224,64,251,0.12)' : 'transparent',
                    color: tariffType === tt ? 'var(--color-accent)' : 'var(--color-muted)',
                    cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600,
                  }}>{t(lang, tt as 'fixed' | 'agile' | 'tracker')}</button>
                ))}
              </div>
            </div>
            {tariffType === 'fixed' && (
              <>
                <div>
                  <label className="label">{t(lang, 'electricityUnitRate')}</label>
                  <input className="input-field" type="number" step="0.01" value={elecUnit} onChange={e => setElecUnit(e.target.value)} />
                </div>
                <div>
                  <label className="label">{t(lang, 'electricityStanding')}</label>
                  <input className="input-field" type="number" step="0.01" value={elecStanding} onChange={e => setElecStanding(e.target.value)} />
                </div>
                {hasGas && (
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
              </>
            )}
            {(tariffType === 'agile' || tariffType === 'tracker') && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                <div>
                  <label className="label">{t(lang, 'agileProductCode')}</label>
                  <input className="input-field" placeholder={t(lang, 'agileProductPlaceholder')} value={agileProductCode} onChange={e => setAgileProductCode(e.target.value)} />
                </div>
                <div>
                  <label className="label">{t(lang, 'dnoRegion')}</label>
                  <p style={{ margin: '0 0 0.3rem', fontSize: '0.72rem', color: 'var(--color-muted)' }}>{t(lang, 'dnoRegionHint')}</p>
                  <select className="input-field" value={dnoRegion} onChange={e => setDnoRegion(e.target.value as DnoRegion)}>
                    {(['A','B','C','D','E','F','G','H','J','K','L','M','N','P'] as DnoRegion[]).map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}
            <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '0.75rem', marginTop: '0.25rem' }}>
              <div style={{ fontSize: '0.78rem', color: 'var(--color-solar)', fontWeight: 700, marginBottom: '0.5rem' }}>
                {t(lang, 'exportTariff')}
              </div>
              <div>
                <label className="label">{t(lang, 'outgoingTariffType')}</label>
                <div style={{ display: 'flex', gap: 8, marginBottom: '0.6rem' }}>
                  {(['fixed', 'agile_export'] as OutgoingTariffType[]).map(ot => (
                    <button key={ot} onClick={() => setOutgoingTariffType(ot)} style={{
                      flex: 1, padding: '0.4rem', borderRadius: 8, border: '1px solid',
                      borderColor: outgoingTariffType === ot ? 'var(--color-solar)' : 'var(--color-border)',
                      background: outgoingTariffType === ot ? 'rgba(250,204,21,0.12)' : 'transparent',
                      color: outgoingTariffType === ot ? 'var(--color-solar)' : 'var(--color-muted)',
                      cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600,
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
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setEditingTariff(false)}>{t(lang, 'back')}</button>
              <button className="btn-primary" style={{ flex: 2 }} onClick={handleSaveTariff}>Save</button>
            </div>
          </div>
        )}
      </Section>

      {/* Agile Rate Alert — only shown for Agile tariff users */}
      {config?.tariff.type === 'agile' && (
        <Section title={t(lang, 'agileAlertTitle')}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <label style={{ fontSize: '0.82rem', color: 'var(--color-text)' }}>{t(lang, 'agileAlertEnabled')}</label>
              <button
                onClick={() => setAlertEnabled(v => !v)}
                style={{
                  width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
                  background: alertEnabled ? 'var(--color-success)' : 'var(--color-border)',
                  position: 'relative', transition: 'background 0.2s',
                }}
              >
                <span style={{
                  position: 'absolute', top: 3, left: alertEnabled ? 22 : 4,
                  width: 18, height: 18, borderRadius: 9, background: 'white',
                  transition: 'left 0.2s', display: 'block',
                }} />
              </button>
            </div>
            <div>
              <label className="label">{t(lang, 'agileAlertThreshold')}</label>
              <input
                className="input-field"
                type="number"
                step="0.1"
                value={alertThreshold}
                onChange={e => setAlertThreshold(e.target.value)}
              />
            </div>
            {alertDenied && (
              <p style={{ fontSize: '0.78rem', color: 'var(--color-danger)', margin: 0 }}>
                {t(lang, 'agileAlertDenied')}
              </p>
            )}
            <button
              className="btn-primary"
              onClick={handleSaveAlert}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <Bell size={15} />
              {alertSaved ? t(lang, 'agileAlertSaved') : t(lang, 'agileAlertSave')}
            </button>
          </div>
        </Section>
      )}

      {/* Multi-property selector */}
      <Section title={t(lang, 'multiPropertyTitle')} desc={t(lang, 'multiPropertyDesc')}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <button
            className="btn-secondary"
            onClick={handleLoadProperties}
            disabled={propLoading}
            style={{ display: 'flex', alignItems: 'center', gap: 6, opacity: propLoading ? 0.6 : 1 }}
          >
            <Building2 size={15} />
            {propLoading ? t(lang, 'multiPropertyFetching') : t(lang, 'multiPropertyFetch')}
          </button>
          {propError && (
            <p style={{ fontSize: '0.78rem', color: 'var(--color-danger)', margin: 0 }}>{propError}</p>
          )}
          {properties.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {properties.map((prop, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: '0.6rem 0.8rem',
                    borderRadius: 8,
                    border: '1px solid',
                    borderColor: selectedPropIdx === idx ? 'var(--color-accent)' : 'var(--color-border)',
                    background: selectedPropIdx === idx ? 'rgba(224,64,251,0.08)' : 'var(--color-surface)',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--color-text)' }}>
                      {prop.address}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--color-muted)', marginTop: 2 }}>
                      {prop.electricity.filter(e => !e.isExport).length} elec
                      {prop.gas.length > 0 ? ` · ${prop.gas.length} gas` : ''}
                      {prop.electricity.filter(e => e.isExport).length > 0 ? ' · solar' : ''}
                    </div>
                  </div>
                  {selectedPropIdx !== idx && (
                    <button
                      className="btn-secondary"
                      onClick={() => handleApplyProperty(idx)}
                      style={{ fontSize: '0.75rem', padding: '0.3rem 0.7rem' }}
                    >
                      {t(lang, 'multiPropertyApply')}
                    </button>
                  )}
                  {selectedPropIdx === idx && (
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-accent)', fontWeight: 700 }}>✓ Active</span>
                  )}
                </div>
              ))}
            </div>
          )}
          {properties.length === 0 && !propLoading && (
            <p style={{ fontSize: '0.78rem', color: 'var(--color-muted)', margin: 0 }}>
              {t(lang, 'multiPropertyNone')}
            </p>
          )}
        </div>
      </Section>

      {/* Reset */}
      <Section title={t(lang, 'resetData')} desc={t(lang, 'resetDesc')}>
        {!confirmReset ? (
          <button
            onClick={() => setConfirmReset(true)}
            style={{
              background: 'rgba(248,113,113,0.1)',
              color: 'var(--color-danger)',
              border: '1px solid rgba(248,113,113,0.3)',
              borderRadius: 8,
              padding: '0.5rem 1rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: '0.85rem',
              fontWeight: 600,
            }}
          >
            <Trash2 size={15} /> {t(lang, 'resetBtn')}
          </button>
        ) : (
          <div>
            <p style={{ color: 'var(--color-danger)', fontSize: '0.85rem', marginBottom: '0.6rem' }}>
              {t(lang, 'resetConfirm')}
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setConfirmReset(false)}>{t(lang, 'back')}</button>
              <button onClick={resetAll} style={{
                flex: 1, background: 'var(--color-danger)', color: 'white',
                border: 'none', borderRadius: 8, padding: '0.55rem', cursor: 'pointer', fontWeight: 700,
              }}>
                {t(lang, 'resetBtn')}
              </button>
            </div>
          </div>
        )}
      </Section>

      {/* Budget */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', background: 'var(--color-card)', borderRadius: 10, border: '1px solid var(--color-border)', marginBottom: '0.75rem' }}>
        <div>
          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-text)' }}>{t(lang, 'budget')}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-muted)' }}>
            {config?.budget?.monthlyLimitPounds ? `£${config.budget.monthlyLimitPounds}/month` : t(lang, 'budgetDisabled')}
          </div>
        </div>
        <span style={{ fontSize: '1.1rem' }}>🎯</span>
      </div>

      {/* Version */}
      <div style={{ textAlign: 'center', marginTop: '2rem', color: 'var(--color-muted)', fontSize: '0.72rem' }}>
        OctoEnergy v6.0.0
      </div>
    </div>
  )
}

function Section({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="card" style={{ marginBottom: '0.75rem' }}>
      <h3 style={{ margin: '0 0 0.3rem', fontSize: '0.9rem', fontWeight: 700 }}>{title}</h3>
      {desc && <p style={{ margin: '0 0 0.9rem', color: 'var(--color-muted)', fontSize: '0.8rem' }}>{desc}</p>}
      {!desc && <div style={{ marginBottom: '0.75rem' }} />}
      {children}
    </div>
  )
}
