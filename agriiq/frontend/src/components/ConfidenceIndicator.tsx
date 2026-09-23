interface ConfidenceIndicatorProps {
  score: number      // 0 to 1
  showLabel?: boolean
}

export default function ConfidenceIndicator({ score, showLabel = true }: ConfidenceIndicatorProps) {
  const pct = Math.round(score * 100)
  const level = score >= 0.75 ? 'high' : score >= 0.55 ? 'medium' : 'low'
  const label = level === 'high' ? 'High confidence' : level === 'medium' ? 'Moderate' : 'Low confidence'

  return (
    <div className="confidence-ring">
      <span className={`confidence-dot confidence-${level}`} />
      {showLabel && (
        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
          {pct}% — {label}
        </span>
      )}
    </div>
  )
}
