interface RangeBarProps {
  min: number
  median: number
  max: number
  unit?: string
  label?: string
  format?: (v: number) => string
}

const defaultFormat = (v: number) =>
  v >= 1000 ? `₹${(v / 1000).toFixed(1)}k` : v.toFixed(0)

export default function RangeBar({
  min, median, max, unit = '', label, format = defaultFormat
}: RangeBarProps) {
  const range = max - min
  const medianPct = range > 0 ? ((median - min) / range) * 100 : 50

  const getRisk = () => {
    const spreadRatio = range / (median || 1)
    if (spreadRatio > 0.6) return 'HIGH'
    if (spreadRatio > 0.35) return 'MEDIUM'
    return 'LOW'
  }
  const risk = getRisk()

  const getColor = () => {
    if (risk === 'HIGH') return 'linear-gradient(90deg, var(--color-danger), var(--color-accent))'
    if (risk === 'MEDIUM') return 'linear-gradient(90deg, var(--color-accent), var(--color-primary))'
    return 'linear-gradient(90deg, var(--color-primary-light), var(--color-primary))'
  }

  return (
    <div className="range-bar">
      {label && (
        <div className="range-bar-labels">
          <span>Pessimistic (P10)</span>
          <span>{label}</span>
          <span>Optimistic (P90)</span>
        </div>
      )}
      <div className="range-bar-track">
        <div className="range-bar-fill" style={{ background: getColor(), width: '100%' }} />
        <div className="range-bar-median" style={{ left: `${medianPct}%` }} />
      </div>
      <div className="range-bar-values">
        <span className="range-val-low">{format(min)}{unit}</span>
        <span className="range-val-mid" style={{ fontWeight: 700 }}>{format(median)}{unit} <span style={{ fontWeight: 400, fontSize: '0.75rem', color: 'var(--text-muted)' }}>median</span></span>
        <span className="range-val-high">{format(max)}{unit}</span>
      </div>
    </div>
  )
}
