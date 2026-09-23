import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { predictApi, mandiApi, fieldsApi } from '../api/client'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Cell, ReferenceLine,
} from 'recharts'
import RangeBar from '../components/RangeBar'
import ConfidenceIndicator from '../components/ConfidenceIndicator'
import NdviForecast from '../components/NdviForecast'
import { ArrowLeft, TrendingUp, Info, AlertTriangle, CloudRain, Thermometer, Droplets } from 'lucide-react'

const CROP_ICONS: Record<string, string> = {
  'Rice': '🌾', 'Wheat': '🌿', 'Maize': '🌽', 'Soybean': '🫘',
  'Cotton': '🌸', 'Groundnut': '🥜', 'Sugarcane': '🎋', 'Tur (Arhar)': '🫛', 'Gram': '🟤',
}

const DROUGHT_COLORS: Record<string, string> = {
  LOW:      'var(--color-primary)',
  MODERATE: 'var(--color-accent)',
  HIGH:     'var(--color-warning)',
  SEVERE:   'var(--color-danger)',
}

export default function YieldDetail() {
  const { fieldId, crop } = useParams<{ fieldId: string; crop: string }>()
  const cropName = decodeURIComponent(crop || '')

  const { data: prediction, isLoading } = useQuery({
    queryKey: ['yield', fieldId, cropName],
    queryFn: () => predictApi.yield({ fieldId, crop: cropName, season: 'Kharif' }),
    enabled: !!fieldId && !!cropName,
  })

  const { data: rawPriceTrend = [] } = useQuery({
    queryKey: ['priceTrend', cropName],
    queryFn: () => mandiApi.trend(cropName, 'Nashik'),
  })

  // NDVI Forecast
  const { data: ndviForecast, isLoading: ndviFcLoading } = useQuery({
    queryKey: ['ndviForecast', fieldId],
    queryFn: () => fieldsApi.ndviForecast(fieldId!, 6),
    enabled: !!fieldId,
  })

  // Field weather
  const { data: weather } = useQuery({
    queryKey: ['weather', fieldId, 'Kharif'],
    queryFn: () => fieldsApi.weather(fieldId!, 'Kharif', 10),
    enabled: !!fieldId,
  })

  const priceTrendList: any[] = Array.isArray(rawPriceTrend)
    ? rawPriceTrend
    : ((rawPriceTrend as any)?.series || [])

  const fmtINR = (v: number) => {
    if (Math.abs(v) >= 100000) return `₹${(v / 100000).toFixed(1)}L`
    if (Math.abs(v) >= 1000)   return `₹${(v / 1000).toFixed(1)}k`
    return `₹${v.toFixed(0)}`
  }

  // P10/P50/P90 bar chart data
  const yieldChartData = prediction?.yieldRange ? [
    { label: 'P10 (Pessimistic)', value: prediction.yieldRange.p10, color: 'var(--color-danger)' },
    { label: 'P50 (Median)',      value: prediction.yieldRange.p50, color: 'var(--color-primary)' },
    { label: 'P90 (Optimistic)', value: prediction.yieldRange.p90, color: 'var(--color-primary-light)' },
  ] : []

  const profitChartData = prediction?.profitRange ? [
    { label: 'Min Profit',  value: prediction.profitRange.minProfit, color: 'var(--color-danger)' },
    { label: 'Med Profit',  value: prediction.profitRange.medProfit, color: 'var(--color-primary)' },
    { label: 'Max Profit',  value: prediction.profitRange.maxProfit, color: 'var(--color-primary-light)' },
  ] : []

  // Price trend chart
  const priceChartData = [...priceTrendList].reverse().map((p: any) => ({
    date: p.date ? String(p.date).substring(5) : '',
    modal: Number(p.modalPrice || 0),
    min: Number(p.minPrice || 0),
    max: Number(p.maxPrice || 0),
  }))

  const droughtLabel = weather?.summary?.droughtRiskLabel || null
  const droughtColor = DROUGHT_COLORS[droughtLabel || ''] || 'var(--text-muted)'

  return (
    <div className="container section-sm">
      <Link to={`/dashboard/${fieldId}`} className="btn btn-ghost btn-sm" style={{ marginBottom: '1.5rem' }}>
        <ArrowLeft size={16} /> Back to Dashboard
      </Link>

      <div className="page-header">
        <div className="flex items-center gap-3">
          <span style={{ fontSize: '2.5rem' }}>{CROP_ICONS[cropName] || '🌱'}</span>
          <div>
            <h1 className="page-title" style={{ fontSize: '2rem' }}>{cropName} — Yield Detail</h1>
            <p className="page-subtitle">P10 / P50 / P90 yield analysis · weather-adjusted prediction</p>
          </div>
        </div>
      </div>

      {isLoading && (
        <div style={{ textAlign: 'center', padding: '4rem' }}>
          <span className="spinner" style={{ width: 48, height: 48, margin: '0 auto' }} />
          <p style={{ color: 'var(--text-secondary)', marginTop: '1rem' }}>Running yield model…</p>
        </div>
      )}

      {prediction && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Confidence header + weather summary strip */}
          <div className="card-glass">
            <div className="flex items-center justify-between" style={{ flexWrap: 'wrap', gap: '1rem', marginBottom: weather?.summary ? '1rem' : 0 }}>
              <div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Model confidence</div>
                <ConfidenceIndicator score={prediction.yieldRange?.confidenceScore || 0.75} />
              </div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                Model: {prediction.modelVersion} · LightGBM Quantile Regression + Weather Features
              </div>
            </div>

            {/* Weather summary strip */}
            {weather?.summary && (
              <div style={{
                display: 'flex', flexWrap: 'wrap', gap: '0.75rem',
                paddingTop: '0.875rem', borderTop: '1px solid var(--border)',
              }}>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <CloudRain size={13} style={{ color: 'var(--color-info)' }} />
                  Season Rainfall:{' '}
                  <strong style={{ color: 'var(--color-info)' }}>
                    ~{weather.summary.seasonRainfallTotal?.toFixed(0)} mm
                  </strong>
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <Thermometer size={13} style={{ color: 'var(--color-accent)' }} />
                  Avg Temp:{' '}
                  <strong style={{ color: 'var(--color-accent)' }}>
                    {weather.summary.avgTempC?.toFixed(1)} °C
                  </strong>
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <AlertTriangle size={13} style={{ color: droughtColor }} />
                  Drought Risk:{' '}
                  <strong style={{ color: droughtColor }}>
                    {droughtLabel}
                  </strong>
                </div>
                {ndviForecast && (
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    🌿 NDVI (3mo):{' '}
                    <strong style={{ color: 'var(--color-primary)' }}>
                      {ndviForecast.ndviForecast3m?.toFixed(3)} ({ndviForecast.healthAt3m?.replace('_', ' ')})
                    </strong>
                  </div>
                )}
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontStyle: 'italic', marginLeft: 'auto' }}>
                  ✅ Prediction includes 6-month NDVI &amp; 10yr weather signal
                </div>
              </div>
            )}
          </div>

          <div className="grid-2">
            {/* Yield Range Card */}
            <div className="card">
              <h4 style={{ marginBottom: '1rem' }}>🌾 Yield Range (kg/ha)</h4>
              <div style={{ marginBottom: '1.25rem' }}>
                <RangeBar
                  min={prediction.yieldRange?.p10 || 0}
                  median={prediction.yieldRange?.p50 || 0}
                  max={prediction.yieldRange?.p90 || 0}
                  unit=" kg/ha"
                  label="Yield"
                  format={v => v.toFixed(0)}
                />
              </div>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={yieldChartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="label" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                  <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                  <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} formatter={(v: any) => [`${v.toFixed(0)} kg/ha`]} />
                  <Bar dataKey="value" radius={[6,6,0,0]}>
                    {yieldChartData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Profit Range Card */}
            <div className="card">
              <h4 style={{ marginBottom: '1rem' }}>💰 Profit Range (INR/ha)</h4>
              <div style={{ marginBottom: '1.25rem' }}>
                <RangeBar
                  min={prediction.profitRange?.minProfit || 0}
                  median={prediction.profitRange?.medProfit || 0}
                  max={prediction.profitRange?.maxProfit || 0}
                  label="Profit"
                  format={fmtINR}
                />
              </div>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={profitChartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="label" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                  <YAxis tickFormatter={v => fmtINR(v)} tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                  <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} formatter={(v: any) => [fmtINR(v)]} />
                  <ReferenceLine y={0} stroke="rgba(248,113,113,0.5)" />
                  <Bar dataKey="value" radius={[6,6,0,0]}>
                    {profitChartData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.75rem' }}>
                Input cost deducted: {fmtINR(prediction.profitRange?.inputCost || 0)}/ha
              </div>
            </div>
          </div>

          {/* Mandi price trend */}
          {priceChartData.length > 0 && (
            <div className="card">
              <div className="flex items-center gap-2" style={{ marginBottom: '1rem' }}>
                <TrendingUp size={18} style={{ color: 'var(--color-accent)' }} />
                <h4>Mandi Price Trend — {cropName}</h4>
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={priceChartData}>
                  <defs>
                    <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="var(--color-accent)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="var(--color-accent)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="date" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                  <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} tickFormatter={v => `₹${v}`} />
                  <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} formatter={(v: any) => [`₹${v}/qtl`]} />
                  <Area type="monotone" dataKey="max"   stroke="rgba(245,158,11,0.3)" fill="none" strokeDasharray="3 2" />
                  <Area type="monotone" dataKey="modal" stroke="var(--color-accent)"  fill="url(#priceGrad)" strokeWidth={2} />
                  <Area type="monotone" dataKey="min"   stroke="rgba(245,158,11,0.3)" fill="none" strokeDasharray="3 2" />
                </AreaChart>
              </ResponsiveContainer>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>INR per quintal (100 kg) · Nashik APMC</p>
            </div>
          )}

          {/* NDVI Forecast section */}
          {ndviFcLoading ? (
            <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
              <span className="spinner" style={{ width: 32, height: 32, margin: '0 auto' }} />
              <p style={{ color: 'var(--text-muted)', marginTop: '0.75rem', fontSize: '0.85rem' }}>Loading NDVI forecast…</p>
            </div>
          ) : ndviForecast ? (
            <NdviForecast
              historical={ndviForecast.historical || []}
              forecast={ndviForecast.forecast || []}
              trend={ndviForecast.trend || 0}
              residualStd={ndviForecast.residualStd || 0.04}
              ndviForecast3m={ndviForecast.ndviForecast3m || 0.4}
              healthAt3m={ndviForecast.healthAt3m || 'MODERATE'}
              district={ndviForecast.district}
            />
          ) : null}

          {/* SHAP explanations */}
          {prediction.explanations?.length > 0 && (
            <div className="card">
              <div className="flex items-center gap-2" style={{ marginBottom: '1rem' }}>
                <Info size={18} style={{ color: 'var(--color-info)' }} />
                <h4>Why this prediction? (SHAP Feature Importance)</h4>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {prediction.explanations.map((ex: any, i: number) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.875rem' }}>
                    <div style={{
                      flexShrink: 0, width: '32px', height: '32px',
                      borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: ex.direction === 'POSITIVE' ? 'rgba(34,197,94,0.15)' : 'rgba(248,113,113,0.15)',
                      color: ex.direction === 'POSITIVE' ? 'var(--color-primary)' : 'var(--color-danger)',
                      fontSize: '0.85rem', fontWeight: 700,
                    }}>
                      {ex.direction === 'POSITIVE' ? '+' : '−'}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                        <span style={{ fontWeight: 600, fontSize: '0.88rem' }}>{ex.label}</span>
                        <span style={{ fontSize: '0.8rem', color: ex.direction === 'POSITIVE' ? 'var(--color-primary)' : 'var(--color-danger)', fontWeight: 600 }}>
                          {ex.direction === 'POSITIVE' ? '+' : ''}{ex.shapValue} kg/ha
                        </span>
                      </div>
                      <div style={{ height: '4px', background: 'rgba(255,255,255,0.07)', borderRadius: '999px', marginBottom: '0.375rem' }}>
                        <div style={{
                          height: '100%', borderRadius: '999px',
                          width: `${Math.min(100, (Math.abs(ex.shapValue) / 200) * 100)}%`,
                          background: ex.direction === 'POSITIVE' ? 'var(--color-primary)' : 'var(--color-danger)',
                        }} />
                      </div>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{ex.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
