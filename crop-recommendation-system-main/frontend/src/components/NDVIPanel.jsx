export default function NDVIPanel({ ndvi, location }) {
  if (!ndvi) return null

  const score = ndvi.score ?? 0
  const category = ndvi.category ?? 'Unknown'
  const color = ndvi.color ?? '#4ade80'

  // SVG circular gauge params
  const R = 54
  const CIRC = 2 * Math.PI * R
  const filled = CIRC * score
  const gap = CIRC - filled

  const descriptions = {
    Poor: 'Sparse or stressed vegetation. Challenging growing conditions — consider drought-tolerant crops.',
    Fair: 'Moderate vegetation cover. Soil may benefit from additional irrigation or organic matter.',
    Good: 'Healthy vegetation density. Suitable for most recommended crops with standard practices.',
    Excellent: 'Lush, thriving vegetation. Ideal growing conditions with rich organic soil content.',
  }

  const categoryIcon = {
    Poor: '🏜️',
    Fair: '🌾',
    Good: '🌿',
    Excellent: '🌳',
  }

  return (
    <div className="glass-card ndvi-panel" aria-label="NDVI Vegetation Health Index">
      <div className="card-header">
        <span className="card-icon" aria-hidden="true">🛰️</span>
        <div>
          <h3 className="card-title">NDVI Vegetation Health</h3>
          <p className="card-subtitle">
            {location?.city ? `📍 ${location.city}` : `📍 ${location?.lat?.toFixed(2)}, ${location?.lon?.toFixed(2)}`}
          </p>
        </div>
      </div>

      <div className="ndvi-body">
        {/* Circular gauge */}
        <div className="ndvi-gauge-wrap" aria-label={`NDVI score ${Math.round(score * 100)}%`}>
          <svg
            className="ndvi-gauge-svg"
            viewBox="0 0 120 120"
            width="140"
            height="140"
            role="img"
            aria-label={`Vegetation health gauge showing ${category}`}
          >
            {/* Background ring */}
            <circle
              cx="60" cy="60" r={R}
              fill="none"
              stroke="rgba(255,255,255,0.07)"
              strokeWidth="10"
            />
            {/* Filled arc */}
            <circle
              cx="60" cy="60" r={R}
              fill="none"
              stroke={color}
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={`${filled} ${gap}`}
              strokeDashoffset={CIRC * 0.25}  /* start at top */
              style={{ filter: `drop-shadow(0 0 8px ${color}88)`, transition: 'stroke-dasharray 1.2s cubic-bezier(0.16,1,0.3,1)' }}
            />
            {/* Center text */}
            <text x="60" y="55" textAnchor="middle" fontSize="18" fontWeight="800" fill={color} fontFamily="Outfit,sans-serif">
              {Math.round(score * 100)}
            </text>
            <text x="60" y="70" textAnchor="middle" fontSize="9" fill="rgba(255,255,255,0.45)" fontFamily="Outfit,sans-serif">
              / 100
            </text>
          </svg>

          {/* Category badge */}
          <div className="ndvi-category-badge" style={{ borderColor: color + '55', color }}>
            {categoryIcon[category]} {category}
          </div>
        </div>

        {/* Right content */}
        <div className="ndvi-info">
          <p className="ndvi-description">{descriptions[category] || ''}</p>

          {/* Score breakdown bar */}
          <div className="ndvi-scale">
            <div className="ndvi-scale-track">
              <div
                className="ndvi-scale-fill"
                style={{ width: `${score * 100}%`, background: `linear-gradient(90deg, #ef4444, #f59e0b, #84cc16, #22c55e)` }}
              />
              <div className="ndvi-scale-thumb" style={{ left: `${score * 100}%`, background: color }} />
            </div>
            <div className="ndvi-scale-labels">
              <span>0 Poor</span>
              <span>0.25</span>
              <span>0.5</span>
              <span>0.75</span>
              <span>1.0 Excellent</span>
            </div>
          </div>

          <div className="ndvi-meta">
            <span className="ndvi-meta-badge">🛰️ NASA POWER</span>
            <span className="ndvi-meta-badge">📡 Proxy Index</span>
            <span className="ndvi-meta-badge">4-Year Avg</span>
          </div>

          <p className="ndvi-disclaimer">
            ℹ️ NDVI proxy computed from precipitation, temperature &amp; solar radiation.
            True NDVI requires satellite multispectral imagery.
          </p>
        </div>
      </div>
    </div>
  )
}
