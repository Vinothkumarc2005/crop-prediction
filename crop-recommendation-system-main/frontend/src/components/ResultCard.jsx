import { CROP_INFO } from '../cropData'

export default function ResultCard({ result, error }) {
  if (error) {
    return (
      <div className="glass-card result-panel">
        <div className="card-header">
          <span className="card-icon" aria-hidden="true">⚠️</span>
          <div>
            <h2 className="card-title">Error</h2>
            <p className="card-subtitle">Something went wrong</p>
          </div>
        </div>
        <div className="error-banner" role="alert">
          <span className="error-icon">🔴</span>
          <span>{error}</span>
        </div>
        <p style={{ marginTop: '16px', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
          Make sure the FastAPI server is running:
          <code style={{
            display: 'block',
            marginTop: '8px',
            padding: '8px 12px',
            background: 'rgba(255,255,255,0.05)',
            borderRadius: '8px',
            fontFamily: 'monospace',
            fontSize: '0.8rem',
            color: 'var(--accent-green)'
          }}>
            cd backend &amp;&amp; uvicorn main:app --reload
          </code>
        </p>
      </div>
    )
  }

  if (!result) {
    return (
      <div className="glass-card result-panel">
        <div className="result-empty" aria-label="Awaiting prediction">
          <span className="result-empty-icon" aria-hidden="true">🌾</span>
          <h2 className="result-empty-title">Awaiting Your Input</h2>
          <p className="result-empty-text">
            Set your soil and climate parameters, then click
            <strong style={{ color: 'var(--accent-green)' }}> Recommend Crop</strong> to see the AI prediction.
          </p>
        </div>
      </div>
    )
  }

  const crop = result.recommended_crop
  const info = CROP_INFO[crop] || { emoji: '🌿', color: '#4ade80', description: '', season: '—', climate: '—', tags: [] }
  const confidence = result.confidence
  const probs = result.all_probabilities

  // Sort probs descending for bar chart
  const sortedProbs = probs
    ? Object.entries(probs).sort((a, b) => b[1] - a[1]).slice(0, 7)
    : null

  return (
    <div className="glass-card result-panel">
      {/* Recommended crop */}
      <div className="result-card">
        <span className="result-crop-emoji" role="img" aria-label={crop}>
          {info.emoji}
        </span>
        <p className="result-label">Recommended Crop</p>
        <h2 className="result-crop-name">{crop}</h2>

        {confidence != null && (
          <div className="result-confidence" aria-label={`Confidence: ${confidence}%`}>
            ✅ {confidence}% Confidence
          </div>
        )}

        <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.6, maxWidth: '360px', margin: '0 auto' }}>
          {info.description}
        </p>
      </div>

      {/* Top probability bars */}
      {sortedProbs && (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '20px', marginTop: '4px' }}>
          <p className="confidence-bars-title">Top Candidate Crops</p>
          <div className="confidence-bars">
            {sortedProbs.map(([name, pct]) => (
              <div key={name} className="conf-bar-row">
                <span className="conf-bar-label">{name}</span>
                <div className="conf-bar-track">
                  <div
                    className={`conf-bar-fill${name === crop ? ' is-winner' : ''}`}
                    style={{ width: `${Math.max(pct, 0.5)}%` }}
                    role="progressbar"
                    aria-valuenow={pct}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`${name}: ${pct}%`}
                  />
                </div>
                <span className="conf-bar-pct">{pct}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
