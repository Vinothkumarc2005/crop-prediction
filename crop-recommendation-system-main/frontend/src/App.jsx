import { useState } from 'react'
import Hero from './components/Hero'
import InputForm from './components/InputForm'
import ResultCard from './components/ResultCard'
import InfoPanel from './components/InfoPanel'
import LocationInput from './components/LocationInput'
import NDVIPanel from './components/NDVIPanel'
import WeatherForecastPanel from './components/WeatherForecastPanel'
import MarketProfitPanel from './components/MarketProfitPanel'
import IrrigationPanel from './components/IrrigationPanel'
import SoilHealthPanel from './components/SoilHealthPanel'
import CropCalendarPanel from './components/CropCalendarPanel'

export default function App() {
  const [result, setResult]             = useState(null)
  const [isLoading, setIsLoading]       = useState(false)
  const [error, setError]               = useState(null)
  const [weatherData, setWeatherData]   = useState(null)
  const [landAreaAcres, setLandAreaAcres] = useState(2.5)
  const [soilValues, setSoilValues]     = useState({ N: 90, P: 42, K: 43, ph: 6.5, humidity: 80, rainfall: 200, temperature: 25 })

  return (
    <div className="app">
      {/* Ambient background orbs */}
      <div className="bg-orbs" aria-hidden="true">
        <div className="bg-orb bg-orb-1" />
        <div className="bg-orb bg-orb-2" />
        <div className="bg-orb bg-orb-3" />
      </div>

      <div className="page-content">
        <Hero />

        <main className="main-layout">
          {/* ── Row 1: Location & Land Plot + Soil Form ── */}
          <section className="main-grid" aria-label="Input section">
            <div>
              <LocationInput
                onWeatherData={setWeatherData}
                onLandAreaChange={setLandAreaAcres}
              />
            </div>
            <div>
              <InputForm
                onResult={setResult}
                onLoading={setIsLoading}
                onError={setError}
                isLoading={isLoading}
                weatherData={weatherData}
                onValuesChange={setSoilValues}
              />
            </div>
          </section>

          {/* ── Row 2: Prediction Results ── */}
          {(result || error) && (
            <section className="results-grid" aria-label="Prediction results" aria-live="polite">
              <ResultCard result={result} error={error} />
              <InfoPanel result={result} />
            </section>
          )}

          {/* ── Row 3: Soil Fertility & Precision Fertilizers ── */}
          {result && (
            <section className="soil-health-section" aria-label="Soil Health and Nutrition section">
              <SoilHealthPanel soilValues={soilValues} result={result} />
            </section>
          )}

          {/* ── Row 4: Market Trend & Profitability ── */}
          {result && (
            <section className="profit-section" aria-label="Market and Profitability section">
              <MarketProfitPanel result={result} initialAcres={landAreaAcres} />
            </section>
          )}

          {/* ── Row 5: Crop Calendar & Agronomy Advisory ── */}
          {result && (
            <section className="crop-calendar-section" aria-label="Crop Agronomy Calendar section">
              <CropCalendarPanel result={result} location={weatherData?.location} />
            </section>
          )}

          {/* ── Row 6: Irrigation Planner ── */}
          {(result || weatherData) && (
            <section className="irrigation-section" aria-label="Irrigation planning section">
              <IrrigationPanel result={result} landAreaAcres={landAreaAcres} />
            </section>
          )}

          {/* ── Row 7: NDVI + Weather Intelligence ── */}
          {weatherData && (
            <section className="weather-section" aria-label="Weather intelligence section">
              <NDVIPanel ndvi={weatherData.ndvi} location={weatherData.location} />
              <WeatherForecastPanel weatherData={weatherData} predictionResult={result} />
            </section>
          )}
        </main>
      </div>

      <footer className="footer">
        <div className="footer-inner">
          <p className="footer-brand">
            🌾 <strong>CropAI</strong> — Intelligent Precision Agriculture
          </p>
          <p className="footer-stack">
            Powered by{' '}
            <span style={{ color: 'var(--accent-green)' }}>SVM/ML</span> ·{' '}
            Weather by <span style={{ color: 'var(--accent-teal)' }}>Open-Meteo</span> ·{' '}
            NDVI by <span style={{ color: 'var(--accent-lime)' }}>NASA POWER</span> ·{' '}
            Built with React + FastAPI · SIH25030
          </p>
        </div>
      </footer>
    </div>
  )
}
