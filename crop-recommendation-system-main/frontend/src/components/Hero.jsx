export default function Hero() {
  return (
    <header className="hero">
      {/* Decorative grid lines */}
      <div className="hero-grid-overlay" aria-hidden="true" />

      <div className="hero-badge">
        <span className="hero-badge-dot" aria-hidden="true" />
        AI-Powered Agricultural Intelligence · SIH 2025
      </div>

      <h1 className="hero-title">
        Grow Smarter with{' '}
        <span className="hero-title-gradient">CropAI</span>
      </h1>

      <p className="hero-subtitle">
        Precision crop advisory powered by satellite NDVI, 6-month weather
        forecasting, and machine learning — tailored to your exact field.
      </p>

      <div className="hero-stats" role="list" aria-label="System statistics">
        <div className="hero-stat" role="listitem">
          <span className="hero-stat-value">99.5%</span>
          <span className="hero-stat-label">Model Accuracy</span>
        </div>
        <div className="hero-stat-divider" aria-hidden="true" />
        <div className="hero-stat" role="listitem">
          <span className="hero-stat-value">11</span>
          <span className="hero-stat-label">Crop Types</span>
        </div>
        <div className="hero-stat-divider" aria-hidden="true" />
        <div className="hero-stat" role="listitem">
          <span className="hero-stat-value">7</span>
          <span className="hero-stat-label">Parameters</span>
        </div>
        <div className="hero-stat-divider" aria-hidden="true" />
        <div className="hero-stat" role="listitem">
          <span className="hero-stat-value">SVM</span>
          <span className="hero-stat-label">Algorithm</span>
        </div>
      </div>

      <div className="hero-trust-bar" aria-label="Powered by">
        <span className="trust-badge">🛰️ NASA POWER NDVI</span>
        <span className="trust-divider" aria-hidden="true" />
        <span className="trust-badge">🌦️ Open-Meteo 6-Month Forecast</span>
        <span className="trust-divider" aria-hidden="true" />
        <span className="trust-badge">🧪 Soil Chemistry AI</span>
        <span className="trust-divider" aria-hidden="true" />
        <span className="trust-badge">📅 Agronomy Calendar</span>
      </div>
    </header>
  )
}
