import { CROP_INFO } from '../cropData'

const SUMMARY_PARAMS = [
  { key: 'N',           emoji: '🧪', label: 'Nitrogen',   unit: 'kg/ha', decimals: 0 },
  { key: 'P',           emoji: '⚗️', label: 'Phosphorus', unit: 'kg/ha', decimals: 0 },
  { key: 'K',           emoji: '🔬', label: 'Potassium',  unit: 'kg/ha', decimals: 0 },
  { key: 'temperature', emoji: '🌡️', label: 'Temp',       unit: '°C',    decimals: 1 },
  { key: 'humidity',    emoji: '💧', label: 'Humidity',   unit: '%',     decimals: 1 },
  { key: 'ph',          emoji: '⚖️', label: 'pH',         unit: '',      decimals: 2 },
  { key: 'rainfall',    emoji: '🌧️', label: 'Rainfall',   unit: 'mm',    decimals: 0 },
]

export default function InfoPanel({ result }) {
  if (!result) return null

  const crop = result.recommended_crop
  const info = CROP_INFO[crop] || {}
  const inputs = result.input_summary || {}

  return (
    <>
      {/* Crop details */}
      <div className="glass-card info-panel">
        <div className="card-header">
          <span className="card-icon" aria-hidden="true">📋</span>
          <div>
            <h3 className="card-title">Crop Details</h3>
            <p className="card-subtitle">Ideal growing conditions for {crop}</p>
          </div>
        </div>

        <div className="info-grid">
          <div className="info-item">
            <p className="info-item-label">Season</p>
            <p className="info-item-value">🗓️ {info.season || '—'}</p>
          </div>
          <div className="info-item">
            <p className="info-item-label">Climate</p>
            <p className="info-item-value">🌤️ {info.climate || '—'}</p>
          </div>
          <div className="info-item">
            <p className="info-item-label">Ideal Temp</p>
            <p className="info-item-value">🌡️ {info.idealTemp || '—'}</p>
          </div>
          <div className="info-item">
            <p className="info-item-label">Ideal Rainfall</p>
            <p className="info-item-value">🌧️ {info.idealRain || '—'}</p>
          </div>
        </div>

        {info.tags && info.tags.length > 0 && (
          <div className="info-tags" aria-label="Crop tags">
            {info.tags.map(tag => (
              <span key={tag} className="info-tag">{tag}</span>
            ))}
          </div>
        )}
      </div>

      {/* Your input summary */}
      <div className="glass-card input-summary">
        <div className="card-header" style={{ marginBottom: '16px' }}>
          <span className="card-icon" aria-hidden="true">📊</span>
          <div>
            <h3 className="card-title">Your Parameters</h3>
            <p className="card-subtitle">Values used for this prediction</p>
          </div>
        </div>
        <div className="summary-grid">
          {SUMMARY_PARAMS.map(p => (
            <div key={p.key} className="summary-item">
              <span className="summary-emoji" aria-hidden="true">{p.emoji}</span>
              <span className="summary-val">
                {typeof inputs[p.key] === 'number'
                  ? inputs[p.key].toFixed(p.decimals)
                  : '—'}
                {p.unit && <small style={{ fontSize: '0.65rem', opacity: 0.65, marginLeft: '2px' }}>{p.unit}</small>}
              </span>
              <span className="summary-lbl">{p.label}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
