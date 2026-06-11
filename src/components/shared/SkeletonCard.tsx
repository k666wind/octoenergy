interface Props {
  height?: number
}

export function SkeletonCard({ height = 100 }: Props) {
  return (
    <>
      <style>{`
        @keyframes shimmer {
          0%   { background-position: 200% center; }
          100% { background-position: -200% center; }
        }
      `}</style>
      <div style={{
        height,
        borderRadius: 12,
        background: 'linear-gradient(90deg, var(--color-card) 25%, var(--color-surface) 50%, var(--color-card) 75%)',
        backgroundSize: '200% auto',
        animation: 'shimmer 1.5s linear infinite',
      }} />
    </>
  )
}
