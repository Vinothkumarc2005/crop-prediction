import { useState } from 'react'
import FieldDrawMap from './FieldDrawMap'

export default function LocationInput({ onWeatherData, onLandAreaChange }) {
  const [city, setCity] = useState('')
  const [lat, setLat] = useState('')
  const [lon, setLon] = useState('')
  const [mode, setMode] = useState('city') // 'city' | 'coords' | 'draw'
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [resolvedCity, setResolvedCity] = useState(null)
  const [drawnPlotInfo, setDrawnPlotInfo] = useState(null)

  const fetchWeather = async (finalLat, finalLon, cityName) => {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/weather-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat: finalLat, lon: finalLon, city: cityName }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.detail || 'Weather analysis failed')
      }

      const data = await res.json()
      onWeatherData(data)
    } catch (err) {
      setError(err.message || 'Failed to fetch weather data. Check your connection.')
    } finally {
      setLoading(false)
    }
  }

  const handleFetch = async () => {
    setError(null)
    let finalLat = parseFloat(lat)
    let finalLon = parseFloat(lon)
    let cityName = city

    if (mode === 'city') {
      if (!city.trim()) {
        setError('Please enter a city name.')
        return
      }
      setLoading(true)
      try {
        const geo = await fetch(`/api/geocode?city=${encodeURIComponent(city.trim())}`)
        if (!geo.ok) {
          const err = await geo.json().catch(() => ({}))
          throw new Error(err.detail || 'City not found')
        }
        const geoData = await geo.json()
        finalLat = geoData.lat
        finalLon = geoData.lon
        cityName = `${geoData.city}, ${geoData.country}`
        setResolvedCity(cityName)
        setLat(finalLat.toString())
        setLon(finalLon.toString())
        await fetchWeather(finalLat, finalLon, cityName)
      } catch (err) {
        setError(err.message || 'Geocoding failed.')
        setLoading(false)
      }
    } else {
      if (isNaN(finalLat) || isNaN(finalLon)) {
        setError('Enter valid lat/lon coordinates.')
        return
      }
      await fetchWeather(finalLat, finalLon, cityName || `Lat ${finalLat}, Lon ${finalLon}`)
    }
  }

  // Handle when user draws a plot and clicks Apply Land
  const handleLandDrawn = async ({ centroid, areaStats }) => {
    setDrawnPlotInfo(areaStats)
    setLat(centroid.lat.toString())
    setLon(centroid.lon.toString())
    const name = `Drawn Field Plot (${areaStats.acres} Acres)`
    setResolvedCity(name)

    // Notify parent of land area in acres
    if (onLandAreaChange) {
      onLandAreaChange(areaStats.acres)
    }

    // Automatically fetch weather for drawn field centroid
    await fetchWeather(centroid.lat, centroid.lon, name)
  }

  return (
    <div className="glass-card location-card">
      <div className="card-header">
        <span className="card-icon" aria-hidden="true">📍</span>
        <div>
          <h2 className="card-title">Location &amp; Land Boundary</h2>
          <p className="card-subtitle">Draw farm plot, search city, or enter coordinates</p>
        </div>
      </div>

      {/* Mode Toggle with 3 tabs */}
      <div className="loc-mode-toggle" role="tablist" aria-label="Location input mode">
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'draw'}
          className={`loc-mode-btn${mode === 'draw' ? ' active' : ''}`}
          onClick={() => {
            setMode('draw')
            setError(null)
          }}
        >
          🗺️ Draw Land / Plot
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'city'}
          className={`loc-mode-btn${mode === 'city' ? ' active' : ''}`}
          onClick={() => {
            setMode('city')
            setError(null)
          }}
        >
          🏙️ City Name
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'coords'}
          className={`loc-mode-btn${mode === 'coords' ? ' active' : ''}`}
          onClick={() => {
            setMode('coords')
            setError(null)
          }}
        >
          🌐 Lat / Lon
        </button>
      </div>

      {/* Inputs */}
      <div style={{ marginTop: '16px' }}>
        {mode === 'draw' && (
          <FieldDrawMap
            onLandDrawn={handleLandDrawn}
            initialLat={lat}
            initialLon={lon}
          />
        )}

        {mode === 'city' && (
          <div className="loc-input-wrap">
            <span className="loc-input-icon">📍</span>
            <input
              id="city-input"
              type="text"
              className="loc-input"
              placeholder="e.g. Nashik, Pune, Guntur, Ludhiana..."
              value={city}
              onChange={(e) => setCity(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleFetch()}
              aria-label="City name"
            />
          </div>
        )}

        {mode === 'coords' && (
          <div style={{ display: 'flex', gap: '12px' }}>
            <div className="loc-input-wrap" style={{ flex: 1 }}>
              <span className="loc-input-icon">↕️</span>
              <input
                id="lat-input"
                type="number"
                className="loc-input"
                placeholder="Latitude (e.g. 19.99)"
                value={lat}
                onChange={(e) => setLat(e.target.value)}
                min="-90"
                max="90"
                step="0.01"
                aria-label="Latitude"
              />
            </div>
            <div className="loc-input-wrap" style={{ flex: 1 }}>
              <span className="loc-input-icon">↔️</span>
              <input
                id="lon-input"
                type="number"
                className="loc-input"
                placeholder="Longitude (e.g. 73.78)"
                value={lon}
                onChange={(e) => setLon(e.target.value)}
                min="-180"
                max="180"
                step="0.01"
                aria-label="Longitude"
              />
            </div>
          </div>
        )}
      </div>

      {resolvedCity && (
        <p className="loc-resolved">
          📌 Active Location: <strong>{resolvedCity}</strong> &bull; {lat}, {lon}
          {drawnPlotInfo && <span className="drawn-pill">🚜 {drawnPlotInfo.acres} Acres Defined</span>}
        </p>
      )}

      {error && (
        <div className="loc-error" role="alert">
          ⚠️ {error}
        </div>
      )}

      {mode !== 'draw' && (
        <button
          id="fetch-weather-btn"
          className="btn-fetch-weather"
          onClick={handleFetch}
          disabled={loading}
          aria-busy={loading}
        >
          {loading ? (
            <>
              <span className="spinner" aria-hidden="true" /> Fetching weather &amp; NDVI...
            </>
          ) : (
            <>🌦️ Fetch Weather &amp; NDVI</>
          )}
        </button>
      )}

      <p className="loc-disclaimer">
        Uses <strong>Open-Meteo</strong> (6-mo forecast + 10-yr history) &amp; <strong>NASA POWER</strong> (NDVI proxy) — free, live meteorological satellite data.
      </p>
    </div>
  )
}
