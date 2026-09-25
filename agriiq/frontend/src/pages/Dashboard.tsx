import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { fieldsApi, predictApi } from '../api/client'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import CropRecommendationCard from '../components/CropRecommendationCard'
import WeatherWidget from '../components/WeatherWidget'
import NdviForecast from '../components/NdviForecast'
import { Sprout, Layers, Droplets, RefreshCw, ChevronDown, Activity, CloudRain, Leaf } from 'lucide-react'
import toast from 'react-hot-toast'

const SEASON_OPTIONS = ['Kharif', 'Rabi']

export default function Dashboard() {
  const { fieldId: paramFieldId } = useParams<{ fieldId: string }>()
  const navigate = useNavigate()
  const [selectedFieldId, setSelectedFieldId] = useState<string>(paramFieldId || '')
  const [season, setSeason] = useState<string>('Kharif')
  const [recommendations, setRecommendations] = useState<any>(null)
  const [loadingReco, setLoadingReco] = useState(false)
  const [showNdviForecast, setShowNdviForecast] = useState(false)

  // Load fields list
  const { data: fields = [] } = useQuery({
    queryKey: ['fields'],
    queryFn: fieldsApi.list,
  })

  useEffect(() => {
    if (!selectedFieldId && fields.length > 0) {
      setSelectedFieldId(fields[0].id)
    }
  }, [fields, selectedFieldId])

  // NDVI historical
  const { data: ndvi, isLoading: ndviLoading } = useQuery({
    queryKey: ['ndvi', selectedFieldId],
    queryFn: () => fieldsApi.ndvi(selectedFieldId),
    enabled: !!selectedFieldId,
  })

  // NDVI Forecast (lazy — triggered when user expands)
  const { data: ndviForecast, isLoading: ndviFcLoading } = useQuery({
    queryKey: ['ndviForecast', selectedFieldId],
    queryFn: () => fieldsApi.ndviForecast(selectedFieldId, 6),
    enabled: !!selectedFieldId && showNdviForecast,
  })

  // Weather data
  const { data: weather, isLoading: weatherLoading } = useQuery({
    queryKey: ['weather', selectedFieldId, season],
    queryFn: () => fieldsApi.weather(selectedFieldId, season, 10),
    enabled: !!selectedFieldId,
  })

  // Soil data
  const { data: soil, isLoading: soilLoading } = useQuery({
    queryKey: ['soil', selectedFieldId],
    queryFn: () => fieldsApi.soil(selectedFieldId),
    enabled: !!selectedFieldId,
  })

  const handleRecommend = async () => {
    if (!selectedFieldId) return
    setLoadingReco(true)
    try {
      const data = await predictApi.recommend({ fieldId: selectedFieldId, season })
      setRecommendations(data)
    } catch (err) {
      toast.error('Could not load recommendations')
    } finally {
      setLoadingReco(false)
    }
  }

  // Auto-fetch recommendations on initial load and when field/season changes
  useEffect(() => {
    if (selectedFieldId) {
      handleRecommend()
    }
  }, [selectedFieldId, season])

  const selectedField = fields.find((f: any) => f.id === selectedFieldId)

  // Prepare NDVI chart data
  const ndviChartData = (ndvi?.series || []).slice().reverse().map((pt: any) => ({
    date: pt.date?.substring(5), // MM-DD
    ndvi: pt.ndviMean != null ? parseFloat(Number(pt.ndviMean).toFixed(3)) : null,
    max: pt.ndviMax != null ? parseFloat(Number(pt.ndviMax).toFixed(3)) : null,
  }))

  const ndviStatus = ndvi?.stats?.healthStatus || 'MODERATE'
  const ndviStatusColor = (({
    STRESSED: 'var(--color-danger)',
    MODERATE: 'var(--color-accent)',
    HEALTHY: 'var(--color-primary)',
    VERY_HEALTHY: 'var(--color-primary-light)',
  } as Record<string, string>)[ndviStatus]) || 'var(--text-muted)'

  const droughtRisk = weather?.summary?.droughtRiskLabel || '—'
  const droughtColor = ({
    LOW: 'var(--color-primary)',
    MODERATE: 'var(--color-accent)',
    HIGH: 'var(--color-warning)',
    SEVERE: 'var(--color-danger)',
  } as Record<string, string>)[droughtRisk] || 'var(--text-muted)'

  if (fields.length === 0) {
    return (
      <div className="container section-sm" style={{ textAlign: 'center', paddingTop: '4rem' }}>
        <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🌱</div>
        <h2>No fields yet</h2>
        <p style={{ color: 'var(--text-secondary)', margin: '0.75rem 0 1.5rem' }}>
          Add your first field to get crop recommendations and NDVI analysis.
        </p>
        <Link to="/fields/new" className="btn btn-primary btn-lg">
          <Sprout size={18} /> Add Your First Field
        </Link>
      </div>
    )
  }

  return (
    <div className="container section-sm">
      {/* Header + field selector */}
      <div className="flex items-center justify-between" style={{ marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ marginBottom: '0.25rem' }}>Field Dashboard</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>NDVI + weather + soil snapshot and AI crop recommendations</p>
        </div>
        <div className="flex items-center gap-3" style={{ flexWrap: 'wrap' }}>
          <select className="select" style={{ width: 'auto' }} value={selectedFieldId} onChange={e => setSelectedFieldId(e.target.value)}>
            {fields.map((f: any) => (
              <option key={f.id} value={f.id}>{f.name} — {f.district}</option>
            ))}
          </select>
          <Link to="/fields/new" className="btn btn-outline btn-sm">+ Add Field</Link>
        </div>
      </div>

      {/* Stats row — now 5 cards including weather */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <div className="stat-card">
          <span className="stat-label">Vegetation Health</span>
          <span className="stat-value" style={{ color: ndviStatusColor, fontSize: '1.2rem' }}>{ndviStatus.replace('_', ' ')}</span>
          <span className="stat-change">NDVI: {ndvi?.stats?.mean != null ? Number(ndvi.stats.mean).toFixed(3) : '—'}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">NDVI Trend</span>
          <span className="stat-value" style={{ fontSize: '1.2rem', color: (Number(ndvi?.stats?.trend) || 0) >= 0 ? 'var(--color-primary)' : 'var(--color-danger)' }}>
            {(Number(ndvi?.stats?.trend) || 0) >= 0 ? '↑' : '↓'} {Math.abs(Number(ndvi?.stats?.trend) || 0).toFixed(4)}
          </span>
          <span className="stat-change">30-day slope</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Drought Risk</span>
          <span className="stat-value" style={{ fontSize: '1.2rem', color: droughtColor }}>
            {weatherLoading ? '…' : droughtRisk}
          </span>
          <span className="stat-change">
            {weather?.summary?.avgRainfallMm != null
              ? `~${weather.summary.avgRainfallMm.toFixed(0)} mm/mo`
              : 'Loading…'}
          </span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Soil pH</span>
          <span className="stat-value" style={{ fontSize: '1.2rem' }}>{soil?.ph != null ? Number(soil.ph).toFixed(1) : '—'}</span>
          <span className="stat-change">{soil?.texture || 'Loading…'}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Soil N / P / K</span>
          <span className="stat-value" style={{ fontSize: '1rem', lineHeight: 1.8 }}>
            {soil?.nitrogen != null ? Number(soil.nitrogen).toFixed(0) : '—'} / {soil?.phosphorus != null ? Number(soil.phosphorus).toFixed(0) : '—'} / {soil?.potassium != null ? Number(soil.potassium).toFixed(0) : '—'}
          </span>
          <span className="stat-change">kg/ha</span>
        </div>
      </div>

      {/* NDVI Chart (90-day historical) */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="flex items-center justify-between" style={{ marginBottom: '1rem' }}>
          <div className="flex items-center gap-2">
            <Activity size={18} style={{ color: 'var(--color-primary)' }} />
            <h4>NDVI Time Series (90 days)</h4>
          </div>
          <div className="flex items-center gap-2">
            <span className="badge badge-green" style={{ fontSize: '0.72rem' }}>Sentinel-2 / Mock</span>
            {/* Toggle NDVI forecast */}
            <button
              className="btn btn-outline btn-sm"
              style={{ fontSize: '0.75rem', padding: '0.25rem 0.7rem' }}
              onClick={() => setShowNdviForecast(v => !v)}
            >
              <Leaf size={12} /> {showNdviForecast ? 'Hide' : '+ Show'} 6mo Forecast
            </button>
          </div>
        </div>
        {ndviLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}><span className="spinner" /></div>
        ) : ndviChartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={ndviChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="date" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
              <YAxis domain={[0, 1]} tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
              <Tooltip
                contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-primary)' }}
                formatter={(v: any) => [v?.toFixed(3), 'NDVI']}
              />
              <ReferenceLine y={0.4} stroke="rgba(245,158,11,0.4)" strokeDasharray="4 2" label={{ value: 'Moderate', fill: 'var(--color-accent)', fontSize: 10 }} />
              <Line type="monotone" dataKey="max" stroke="rgba(34,197,94,0.25)" strokeWidth={1} dot={false} />
              <Line type="monotone" dataKey="ndvi" stroke="var(--color-primary)" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>No NDVI data available yet</p>
        )}
      </div>

      {/* NDVI Forecast — expandable */}
      {showNdviForecast && (
        <div style={{ marginBottom: '1.5rem' }}>
          {ndviFcLoading ? (
            <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
              <span className="spinner" style={{ width: 32, height: 32, margin: '0 auto' }} />
              <p style={{ color: 'var(--text-muted)', marginTop: '0.75rem', fontSize: '0.85rem' }}>Generating 6-month NDVI forecast…</p>
            </div>
          ) : ndviForecast ? (
            <NdviForecast
              historical={ndviForecast.historical || []}
              forecast={ndviForecast.forecast || []}
              trend={ndviForecast.trend || 0}
              residualStd={ndviForecast.residualStd || 0.04}
              ndviForecast3m={ndviForecast.ndviForecast3m || 0.4}
              healthAt3m={ndviForecast.healthAt3m || 'MODERATE'}
              district={selectedField?.district}
            />
          ) : null}
        </div>
      )}

      {/* Weather Widget */}
      {weather && !weatherLoading ? (
        <WeatherWidget
          history={weather.history || []}
          forecast={weather.forecast || []}
          summary={weather.summary || {}}
          district={weather.district || selectedField?.district || ''}
          season={season}
        />
      ) : (
        <div className="card" style={{ marginBottom: '1.5rem', padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <CloudRain size={18} style={{ color: 'var(--color-info)', opacity: 0.5 }} />
          <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            {weatherLoading ? 'Loading 10-year weather patterns…' : 'No weather data'}
          </span>
          {weatherLoading && <span className="spinner" style={{ width: 16, height: 16 }} />}
        </div>
      )}

      {/* Recommendation panel */}
      <div className="card">
        <div className="flex items-center justify-between" style={{ marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div className="flex items-center gap-2">
            <Sprout size={18} style={{ color: 'var(--color-primary)' }} />
            <h4>Crop Recommendations</h4>
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            {weather?.summary && (
              <span style={{ marginRight: '0.75rem' }}>
                🌦 Weather signal:{' '}
                <span style={{ color: droughtColor, fontWeight: 600 }}>
                  {droughtRisk} drought risk
                </span>
                {' '}· {weather.summary.avgRainfallMm?.toFixed(0)} mm avg rain
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <select className="select" style={{ width: 'auto' }} value={season} onChange={e => { setSeason(e.target.value); setRecommendations(null) }}>
              {SEASON_OPTIONS.map(s => <option key={s}>{s}</option>)}
            </select>
            <button className="btn btn-primary btn-sm" onClick={handleRecommend} disabled={loadingReco}>
              {loadingReco ? <span className="spinner" style={{ width: 16, height: 16 }} /> : <RefreshCw size={15} />}
              {recommendations ? 'Refresh' : 'Get Recommendations'}
            </button>
          </div>
        </div>

        {!recommendations && !loadingReco && (
          <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>🌾</div>
            <p>Click "Get Recommendations" to run the AI crop advisor for this field.</p>
            <p style={{ fontSize: '0.82rem', marginTop: '0.375rem' }}>Uses NDVI + soil + 10yr weather patterns + mandi prices to rank crops by profitability.</p>
          </div>
        )}

        {loadingReco && (
          <div style={{ textAlign: 'center', padding: '3rem' }}>
            <span className="spinner" style={{ width: 40, height: 40, margin: '0 auto' }} />
            <p style={{ color: 'var(--text-secondary)', marginTop: '1rem' }}>Running AI crop analysis with weather signals…</p>
          </div>
        )}

        {recommendations?.crops && (
          <div>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              Showing {recommendations.crops.length} crops ranked by expected profit/ha · Season: {season} · Model: {recommendations.modelVersion}
              {weather?.summary && (
                <span> · 🌦 {weather.summary.droughtRiskLabel} drought risk factored in</span>
              )}
            </p>
            <div className="grid-2" style={{ gap: '1.25rem' }}>
              {recommendations.crops.map((crop: any) => (
                <CropRecommendationCard key={crop.crop} crop={crop} fieldId={selectedFieldId} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
