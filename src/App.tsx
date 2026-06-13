import { useState, useEffect } from 'react'
import { useAppStore } from './store/useAppStore'
import { SetupWizard } from './components/setup/SetupWizard'
import { Dashboard } from './components/dashboard/Dashboard'
import { TrendsPage } from './components/trends/TrendsPage'
import { TariffPage } from './components/tariff/TariffPage'
import { SettingsPage } from './components/settings/SettingsPage'
import { NavBar } from './components/shared/NavBar'
import { AnalysisPage } from './components/analysis/AnalysisPage'

type Page = 'dashboard' | 'trends' | 'analysis' | 'tariff' | 'settings'

export default function App() {
  const isSetupComplete = useAppStore(s => s.isSetupComplete)
  const [page, setPage] = useState<Page>('dashboard')
  const config = useAppStore(s => s.config)

  // Post Agile alert config to service worker whenever it changes
  useEffect(() => {
    const cfg = config?.agileAlert
    if (!cfg || config?.tariff?.type !== 'agile') return
    navigator.serviceWorker?.ready.then(reg => {
      reg.active?.postMessage({
        type: 'AGILE_ALERT_CONFIG',
        payload: {
          enabled: cfg.enabled,
          thresholdPence: cfg.thresholdPence,
          apiKey: config?.credentials.apiKey ?? '',
          dnoRegion: config?.tariff?.dnoRegion ?? 'C',
          productCode: config?.tariff?.agileProductCode ?? 'AGILE-24-10-01',
        },
      })
    })
  }, [config?.agileAlert, config?.tariff?.type, config?.tariff?.dnoRegion, config?.tariff?.agileProductCode, config?.credentials.apiKey])

  // Drill-down date: when set, TrendsPage opens in Day view for this date
  const [drillDate, setDrillDate] = useState<string | null>(null)

  function navigateToTrendsDay(date: string) {
    setDrillDate(date)
    setPage('trends')
  }

  function handlePageChange(p: Page) {
    setPage(p)
    // Clear drill-down when user navigates manually
    if (p !== 'trends') setDrillDate(null)
  }

  if (!isSetupComplete) {
    return <SetupWizard />
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)' }}>
      {page === 'dashboard' && <Dashboard />}
      {page === 'trends'    && <TrendsPage initialDate={drillDate} onNavigated={() => setDrillDate(null)} />}
      {page === 'analysis'  && <AnalysisPage onDayDrillDown={navigateToTrendsDay} />}
      {page === 'tariff'    && <TariffPage />}
      {page === 'settings'  && <SettingsPage />}
      <NavBar current={page} onChange={handlePageChange} />
    </div>
  )
}
