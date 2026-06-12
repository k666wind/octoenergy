import { useState } from 'react'
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
