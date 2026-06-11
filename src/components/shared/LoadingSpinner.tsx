interface Props {
  label?: string
}

export function LoadingSpinner({ label }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '2rem' }}>
      <div style={{
        width: 36,
        height: 36,
        border: '3px solid var(--color-border)',
        borderTopColor: 'var(--color-accent)',
        borderRadius: '50%',
        animation: 'spin 0.7s linear infinite',
      }} />
      {label && <span style={{ color: 'var(--color-muted)', fontSize: '0.85rem' }}>{label}</span>}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
