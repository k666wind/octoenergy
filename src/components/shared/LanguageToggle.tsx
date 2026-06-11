import { useAppStore } from '../../store/useAppStore'

export function LanguageToggle() {
  const lang = useAppStore((s) => s.config?.language ?? 'en')
  const setLanguage = useAppStore((s) => s.setLanguage)

  return (
    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
      {(['en', 'zh'] as const).map((l) => (
        <button
          key={l}
          onClick={() => setLanguage(l)}
          style={{
            padding: '4px 10px',
            borderRadius: '6px',
            border: '1px solid var(--color-border)',
            background: lang === l ? 'var(--color-accent)' : 'transparent',
            color: lang === l ? 'white' : 'var(--color-muted)',
            fontSize: '0.75rem',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}
        >
          {l === 'en' ? 'EN' : '中'}
        </button>
      ))}
    </div>
  )
}
