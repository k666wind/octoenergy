import { LayoutDashboard, TrendingUp, BarChart2, Zap, Settings } from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'
import { t } from '../../lib/i18n'

type Page = 'dashboard' | 'trends' | 'analysis' | 'tariff' | 'settings'

interface Props {
  current: Page
  onChange: (p: Page) => void
}

export function NavBar({ current, onChange }: Props) {
  const lang = useAppStore((s) => s.config?.language ?? 'en')

  const items: { id: Page; icon: React.ReactNode; label: string }[] = [
    { id: 'dashboard', icon: <LayoutDashboard size={20} />, label: t(lang, 'dashboard') },
    { id: 'trends',    icon: <TrendingUp size={20} />,     label: t(lang, 'trends') },
    { id: 'analysis',  icon: <BarChart2 size={20} />,      label: t(lang, 'insights') },
    { id: 'tariff',    icon: <Zap size={20} />,            label: t(lang, 'tariff') },
    { id: 'settings',  icon: <Settings size={20} />,       label: t(lang, 'settings') },
  ]

  return (
    <nav style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      background: 'var(--color-surface)',
      borderTop: '1px solid var(--color-border)',
      display: 'flex',
      zIndex: 100,
    }}>
      {items.map((item) => (
        <button
          key={item.id}
          onClick={() => onChange(item.id)}
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '4px',
            padding: '10px 0 14px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: current === item.id ? 'var(--color-accent)' : 'var(--color-muted)',
            fontSize: '0.65rem',
            fontWeight: current === item.id ? 700 : 400,
            transition: 'color 0.15s',
          }}
        >
          {item.icon}
          {item.label}
        </button>
      ))}
    </nav>
  )
}
