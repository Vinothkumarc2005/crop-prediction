import { useState, useEffect } from 'react'

const PARAMS = [
  {
    key: 'N',
    label: 'Nitrogen (N)',
    emoji: '🧪',
    unit: 'kg/ha',
    min: 0,
    max: 200,
    step: 1,
    defaultVal: 90,
    description: 'Nitrogen content in soil',
  },
  {
    key: 'P',
    label: 'Phosphorus (P)',
    emoji: '⚗️',
    unit: 'kg/ha',
    min: 0,
    max: 200,
    step: 1,
    defaultVal: 42,
    description: 'Phosphorus content in soil',
  },
  {
    key: 'K',
    label: 'Potassium (K)',
    emoji: '🔬',
    unit: 'kg/ha',
    min: 0,
    max: 200,
    step: 1,
    defaultVal: 43,
    description: 'Potassium content in soil',
  },
  {
    key: 'humidity',
    label: 'Humidity',
    emoji: '💧',
    unit: '%',
    min: 0,
    max: 100,
    step: 0.1,
    defaultVal: 80,
    description: 'Relative humidity percentage',
  },
  {
    key: 'ph',
    label: 'Soil pH',
    emoji: '⚖️',
    unit: 'pH',
    min: 3,
    max: 10,
    step: 0.01,
    defaultVal: 6.5,
    description: 'Soil acidity/alkalinity level',
  },
  {
    key: 'rainfall',
    label: 'Rainfall',
    emoji: '🌧️',
    unit: 'mm',
    min: 20,
    max: 500,
    step: 1,
    defaultVal: 200,
    description: 'Average rainfall in mm',
  },
]

const DEFAULT_VALS = {
  ...Object.fromEntries(PARAMS.map(p => [p.key, p.defaultVal])),
  temperature: 25,
}

// Keys that can be auto-filled from weather data
const WEATHER_FILL_KEYS = new Set(['humidity', 'rainfall'])

export default function InputForm({ onResult, onLoading, onError, isLoading, weatherData, onValuesChange }) {
  const [values, setValues] = useState(DEFAULT_VALS)
  const [autoFilled, setAutoFilled] = useState(false)
  const [filledKeys, setFilledKeys] = useState(new Set())

  // Auto-sync temperature from weather data whenever weatherData updates
  useEffect(() => {
    if (weatherData?.overall_forecast?.avg_temp != null) {
      const weatherTemp = Math.max(0, Math.min(55, parseFloat(weatherData.overall_forecast.avg_temp.toFixed(1))))
      setValues(prev => ({ ...prev, temperature: weatherTemp }))
    }
  }, [weatherData])

  // Inform parent of current soil/climate values for health & calendar panels
  useEffect(() => {
    if (onValuesChange) {
      onValuesChange(values)
    }
  }, [values, onValuesChange])

  // Auto-fill from weather when available
  const handleAutoFill = () => {
    if (!weatherData) return
    const forecast = weatherData.forecast_6months
    const overall = weatherData.overall_forecast

    if (!overall) return

    const newVals = { ...values }
    const filled = new Set()

    // Temperature: auto-calculated from 6-month forecast
    if (overall.avg_temp != null) {
      newVals.temperature = Math.max(0, Math.min(55, parseFloat(overall.avg_temp.toFixed(1))))
    }

    // Humidity: average of monthly humidity values
    const humidVals = forecast?.map(m => m.avg_humidity).filter(v => v != null)
    if (humidVals?.length) {
      const avgHumid = humidVals.reduce((a, b) => a + b, 0) / humidVals.length
      newVals.humidity = Math.max(0, Math.min(100, parseFloat(avgHumid.toFixed(1))))
      filled.add('humidity')
    }

    // Rainfall: 6-month total / 6 → monthly average, capped to slider max
    if (overall.total_rain_6m != null) {
      const monthlyRain = overall.total_rain_6m / 6
      newVals.rainfall = Math.max(20, Math.min(500, parseFloat(monthlyRain.toFixed(0))))
      filled.add('rainfall')
    }

    setValues(newVals)
    setAutoFilled(true)
    setFilledKeys(filled)

    // Clear highlight after 3 seconds
    setTimeout(() => setFilledKeys(new Set()), 3000)
  }

  const handleChange = (key, val) => {
    setValues(prev => ({ ...prev, [key]: parseFloat(val) }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    onLoading(true)
    onError(null)
    onResult(null)

    try {
      const res = await fetch('/api/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.detail || `Server error: ${res.status}`)
      }

      const data = await res.json()
      onResult(data)
    } catch (err) {
      if (err.message.includes('fetch') || err.message.includes('Failed')) {
        onError('Cannot connect to the prediction server. Make sure the FastAPI backend is running on port 8000.')
      } else {
        onError(err.message || 'Prediction failed. Please try again.')
      }
    } finally {
      onLoading(false)
    }
  }

  const handleReset = () => {
    setValues(DEFAULT_VALS)
    onResult(null)
    onError(null)
    setAutoFilled(false)
    setFilledKeys(new Set())
  }

  return (
    <div className="glass-card">
      <div className="card-header">
        <span className="card-icon" aria-hidden="true">🌱</span>
        <div style={{ flex: 1 }}>
          <h2 className="card-title">Soil &amp; Climate Parameters</h2>
          <p className="card-subtitle">Adjust the sliders or type values directly</p>
        </div>
        {/* Auto-fill from weather button */}
        {weatherData && (
          <button
            type="button"
            id="auto-fill-btn"
            className="btn-autofill"
            onClick={handleAutoFill}
            title="Pre-fill humidity and rainfall from the 6-month forecast"
            aria-label="Auto-fill climate values from weather forecast"
          >
            ⚡ Auto-fill from Weather
          </button>
        )}
      </div>

      {/* Auto-detected Temperature Bar */}
      <div className="temp-auto-card">
        <div className="temp-auto-left">
          <div className="temp-auto-icon-badge" aria-hidden="true">🌡️</div>
          <div>
            <div className="temp-auto-title">
              Ambient Temperature: <strong className="temp-auto-val">{values.temperature}°C</strong>
            </div>
            <div className="temp-auto-sub">
              {weatherData?.overall_forecast?.avg_temp != null
                ? `Auto-synced from regional weather forecast (${weatherData.location?.city || 'Selected Field'})`
                : 'Auto-set to regional standard (25.0°C) · Auto-syncs when field location is set'}
            </div>
          </div>
        </div>
        <div className={`temp-auto-status-pill ${weatherData?.overall_forecast?.avg_temp != null ? 'synced' : 'standard'}`}>
          {weatherData?.overall_forecast?.avg_temp != null ? '⚡ Weather Synced' : 'Auto Standard'}
        </div>
      </div>

      {autoFilled && (
        <div className="autofill-banner" role="status" aria-live="polite">
          ✅ Humidity &amp; rainfall filled from 6-month forecast average (Temperature auto-synced: {values.temperature}°C)
        </div>
      )}

      <form id="crop-form" onSubmit={handleSubmit} noValidate>
        <div className="param-list">
          {PARAMS.map(param => {
            const val = values[param.key]
            const pct = ((val - param.min) / (param.max - param.min)) * 100
            const isWeatherFilled = filledKeys.has(param.key)

            return (
              <div
                key={param.key}
                className={`param-item${isWeatherFilled ? ' weather-filled' : ''}`}
              >
                <div className="param-header">
                  <label
                    className="param-label"
                    htmlFor={`slider-${param.key}`}
                    title={param.description}
                  >
                    <span className="param-emoji" aria-hidden="true">{param.emoji}</span>
                    {param.label}
                    {WEATHER_FILL_KEYS.has(param.key) && weatherData && (
                      <span className="param-weather-indicator" title="Can be auto-filled from weather">🌦️</span>
                    )}
                  </label>
                  <input
                    type="number"
                    id={`input-${param.key}`}
                    aria-label={`${param.label} numeric input`}
                    value={val}
                    min={param.min}
                    max={param.max}
                    step={param.step}
                    onChange={e => handleChange(param.key, e.target.value)}
                    className="param-value-badge"
                    style={{ cursor: 'text', border: 'none' }}
                  />
                </div>

                <div className="param-slider-wrap">
                  <input
                    type="range"
                    id={`slider-${param.key}`}
                    aria-label={`${param.label} slider`}
                    min={param.min}
                    max={param.max}
                    step={param.step}
                    value={val}
                    onChange={e => handleChange(param.key, e.target.value)}
                    className="param-slider"
                    style={{
                      background: `linear-gradient(to right, ${isWeatherFilled ? '#60a5fa' : '#4ade80'} ${pct}%, rgba(255,255,255,0.08) ${pct}%)`
                    }}
                  />
                </div>

                <div className="param-range-labels" aria-hidden="true">
                  <span>{param.min} {param.unit}</span>
                  <span>{param.max} {param.unit}</span>
                </div>
              </div>
            )
          })}
        </div>

        <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
          <button
            type="button"
            onClick={handleReset}
            disabled={isLoading}
            style={{
              padding: '14px 20px',
              borderRadius: '12px',
              border: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(255,255,255,0.05)',
              color: 'var(--text-secondary)',
              fontFamily: 'var(--font)',
              fontSize: '0.9rem',
              fontWeight: '600',
              cursor: 'pointer',
              flexShrink: 0,
            }}
            aria-label="Reset to default values"
          >
            Reset
          </button>

          <button
            type="submit"
            id="predict-btn"
            className="btn-predict"
            disabled={isLoading}
            aria-busy={isLoading}
          >
            {isLoading ? (
              <>
                <span className="spinner" aria-hidden="true" />
                Analyzing…
              </>
            ) : (
              <>
                🔍 Recommend Crop
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
