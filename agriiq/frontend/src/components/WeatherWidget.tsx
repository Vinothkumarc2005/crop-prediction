import { useState } from 'react'
import {
  ComposedChart, Bar, Line, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, Legend,
} from 'recharts'
import { CloudRain, Thermometer, AlertTriangle, TrendingUp, Calendar } from 'lucide-react'

interface WeatherPoint {
  yearMonth:    string
  rainfallMm:   number
  rainfallLow?: number
  rainfallHigh?: number
  tempAvgC:     number
  tempAvgLow?:  number
  tempAvgHigh?: number
  humidityPct:  number | undefined
  isForecast:   boolean
}

interface WeatherSummary {
  avgRainfallMm:       number
  avgTempC:            number
  droughtRiskScore:    number
  droughtRiskLabel:    string
  rainfallAnomaly:     number
  warmingTrendC:       number
  historicalYears:     number
  seasonRainfallTotal: number
}

interface WeatherWidgetProps {
  history:  WeatherPoint[]
  forecast: WeatherPoint[]
  summary:  WeatherSummary
  district: string
  season:   string
}

type Tab = 'history' | 'forecast'

const DROUGHT_COLORS: Record<string, string> = {
  LOW:      'var(--color-primary)',
  MODERATE: 'var(--color-accent)',
  HIGH:     'var(--color-warning)',
  SEVERE:   'var(--color-danger)',
}

const DROUGHT_BG: Record<string, string> = {
  LOW:      'rgba(34,197,94,0.12)',
  MODERATE: 'rgba(245,158,11,0.12)',
  HIGH:     'rgba(251,146,60,0.12)',
  SEVERE:   'rgba(248,113,113,0.12)',
}

// Format month label — show year only once per year
function formatXTick(tick: string, index: number, data: WeatherPoint[]) {
  const [yr, mo] = tick.split('-')
  if (index === 0 || mo === '01') return `${yr}`
  if (mo === '06') return `${yr}-Jun`
  return ''
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  const rain  = payload.find((p: any) => p.dataKey === 'rainfallMm')
  const temp  = payload.find((p: any) => p.dataKey === 'tempAvgC')
  const isFc  = payload[0]?.payload?.isForecast
  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border)',
      borderRadius: 10, padding: '0.75rem 1rem', fontSize: '0.82rem',
    }}>
      <div style={{ fontWeight: 700, marginBottom: '0.375rem', color: 'var(--text-primary)' }}>
        {label} {isFc && <span style={{ color: 'var(--color-info)', fontSize: '0.72rem' }}>FORECAST</span>}
      </div>
      {rain && (
        <div style={{ color: 'var(--color-info)' }}>
          🌧 Rainfall: <b>{rain.value?.toFixed(1)} mm</b>
        </div>
      )}
      {temp && (
        <div style={{ color: 'var(--color-accent)' }}>
          🌡 Avg Temp: <b>{temp.value?.toFixed(1)} °C</b>
        </div>
      )}
    </div>
  )
}

export default function WeatherWidget({ history, forecast, summary, district, season }: WeatherWidgetProps) {
  const [tab, setTab] = useState<Tab>('history')

  const driskColor = DROUGHT_COLORS[summary.droughtRiskLabel] || 'var(--text-muted)'
  const driskBg    = DROUGHT_BG[summary.droughtRiskLabel]    || 'rgba(255,255,255,0.05)'

  // Build chart data — last 24 months of history for readability
  const historySlice = history.slice(-24)
  const historyChartData = historySlice.map(p => ({
    yearMonth:  p.yearMonth,
    rainfallMm: p.rainfallMm,
    tempAvgC:   p.tempAvgC,
    isForecast: false,
  }))

  const forecastChartData = forecast.map(p => ({
    yearMonth:    p.yearMonth,
    rainfallMm:   p.rainfallMm,
    rainfallLow:  p.rainfallLow,
    rainfallHigh: p.rainfallHigh,
    tempAvgC:     p.tempAvgC,
    tempAvgLow:   p.tempAvgLow,
    tempAvgHigh:  p.tempAvgHigh,
    isForecast:   true,
  }))

  const chartData: any[] = tab === 'history' ? historyChartData : forecastChartData

  return (
    <div className="card" style={{ marginBottom: '1.5rem' }}>
      {/* Header */}
      <div className="flex items-center justify-between" style={{ marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div className="flex items-center gap-2">
          <CloudRain size={18} style={{ color: 'var(--color-info)' }} />
          <h4>Weather Patterns — {district}</h4>
        </div>
        <div className="flex items-center gap-2">
          {/* Tab switcher */}
          <div style={{
            display: 'flex', background: 'var(--bg-surface)',
            borderRadius: 8, padding: '2px', border: '1px solid var(--border)',
          }}>
            {(['history', 'forecast'] as Tab[]).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                style={{
                  padding: '0.3rem 0.85rem', borderRadius: 6, border: 'none', cursor: 'pointer',
                  fontSize: '0.78rem', fontWeight: 600, transition: 'all 0.2s',
                  background: tab === t ? 'var(--color-info)' : 'transparent',
                  color:      tab === t ? '#000' : 'var(--text-muted)',
                }}
              >
                {t === 'history' ? `${summary.historicalYears}yr History` : '6mo Forecast'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Summary stat strip */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
        gap: '0.75rem', marginBottom: '1.25rem',
      }}>
        {/* Drought risk */}
        <div style={{
          background: driskBg, border: `1px solid ${driskColor}30`,
          borderRadius: 10, padding: '0.6rem 0.9rem',
        }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Drought Risk</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <AlertTriangle size={14} style={{ color: driskColor }} />
            <span style={{ fontWeight: 700, color: driskColor, fontSize: '0.9rem' }}>
              {summary.droughtRiskLabel}
            </span>
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
            Score: {(summary.droughtRiskScore * 100).toFixed(0)}%
          </div>
        </div>

        {/* Avg rainfall */}
        <div style={{ background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.15)', borderRadius: 10, padding: '0.6rem 0.9rem' }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Avg Monthly Rain</div>
          <div style={{ fontWeight: 700, color: 'var(--color-info)', fontSize: '1rem' }}>
            {summary.avgRainfallMm.toFixed(0)} mm
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
            Season total ~{summary.seasonRainfallTotal.toFixed(0)} mm
          </div>
        </div>

        {/* Avg temp */}
        <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.15)', borderRadius: 10, padding: '0.6rem 0.9rem' }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Avg Temperature</div>
          <div style={{ fontWeight: 700, color: 'var(--color-accent)', fontSize: '1rem' }}>
            {summary.avgTempC.toFixed(1)} °C
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
            Trend: {summary.rainfallAnomaly >= 0 ? '+' : ''}{summary.rainfallAnomaly.toFixed(0)} mm/10yr
          </div>
        </div>

        {/* Season */}
        <div style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid var(--border)', borderRadius: 10, padding: '0.6rem 0.9rem' }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Season</div>
          <div style={{ fontWeight: 700, color: 'var(--color-primary)', fontSize: '0.9rem' }}>
            {season}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
            {season === 'Kharif' ? 'Jun – Oct' : 'Nov – Mar'}
          </div>
        </div>
      </div>

      {/* Main chart */}
      <div style={{ position: 'relative' }}>
        {tab === 'forecast' && (
          <div style={{
            position: 'absolute', top: 6, right: 8,
            fontSize: '0.72rem', color: 'var(--color-info)',
            background: 'rgba(56,189,248,0.1)', padding: '2px 8px', borderRadius: 6,
            border: '1px solid rgba(56,189,248,0.2)', zIndex: 1,
          }}>
            📡 AI-generated forecast based on 10-year climate patterns
          </div>
        )}
        <ResponsiveContainer width="100%" height={240}>
          <ComposedChart data={chartData} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
            <defs>
              <linearGradient id="rainGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="var(--color-info)" stopOpacity={0.5} />
                <stop offset="95%" stopColor="var(--color-info)" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis
              dataKey="yearMonth"
              tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
              tickFormatter={(v, i) => formatXTick(v, i, chartData)}
              interval="preserveStartEnd"
            />
            {/* Left Y: rainfall */}
            <YAxis
              yAxisId="rain"
              orientation="left"
              tick={{ fill: 'var(--color-info)', fontSize: 10 }}
              tickFormatter={v => `${v}mm`}
              width={48}
            />
            {/* Right Y: temperature */}
            <YAxis
              yAxisId="temp"
              orientation="right"
              tick={{ fill: 'var(--color-accent)', fontSize: 10 }}
              tickFormatter={v => `${v}°`}
              width={36}
            />
            <Tooltip content={<CustomTooltip />} />

            {tab === 'forecast' && (
              <>
                {/* Rainfall confidence band */}
                <Area
                  yAxisId="rain"
                  type="monotone"
                  dataKey="rainfallHigh"
                  stroke="none"
                  fill="rgba(56,189,248,0.1)"
                  fillOpacity={1}
                  legendType="none"
                />
                <Area
                  yAxisId="rain"
                  type="monotone"
                  dataKey="rainfallLow"
                  stroke="none"
                  fill="var(--bg-card)"
                  fillOpacity={1}
                  legendType="none"
                />
                {/* Temp confidence band */}
                <Area
                  yAxisId="temp"
                  type="monotone"
                  dataKey="tempAvgHigh"
                  stroke="none"
                  fill="rgba(245,158,11,0.08)"
                  fillOpacity={1}
                  legendType="none"
                />
                <Area
                  yAxisId="temp"
                  type="monotone"
                  dataKey="tempAvgLow"
                  stroke="none"
                  fill="var(--bg-card)"
                  fillOpacity={1}
                  legendType="none"
                />
              </>
            )}

            {/* Rainfall bars */}
            <Bar
              yAxisId="rain"
              dataKey="rainfallMm"
              fill="url(#rainGrad)"
              stroke="var(--color-info)"
              strokeWidth={0.5}
              radius={[3, 3, 0, 0]}
              name="Rainfall (mm)"
              strokeDasharray={tab === 'forecast' ? '3 2' : '0'}
              opacity={tab === 'forecast' ? 0.75 : 1}
            />

            {/* Temperature line */}
            <Line
              yAxisId="temp"
              type="monotone"
              dataKey="tempAvgC"
              stroke="var(--color-accent)"
              strokeWidth={2}
              dot={false}
              name="Avg Temp (°C)"
              strokeDasharray={tab === 'forecast' ? '5 3' : '0'}
              opacity={tab === 'forecast' ? 0.85 : 1}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
        <span>
          <span style={{ color: 'var(--color-info)' }}>■</span> Rainfall (mm, left axis) &nbsp;
          <span style={{ color: 'var(--color-accent)' }}>—</span> Temperature (°C, right axis)
        </span>
        <span>{tab === 'history' ? 'Source: IMD district normals (synthetic)' : 'Forecast uses 10yr seasonal trend'}</span>
      </div>
    </div>
  )
}
