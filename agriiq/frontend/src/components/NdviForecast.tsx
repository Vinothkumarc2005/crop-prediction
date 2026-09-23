import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, ReferenceDot, Legend,
} from 'recharts'
import { Leaf, TrendingUp, TrendingDown, Info } from 'lucide-react'

interface NdviPoint {
  date:       string
  ndvi:       number | null
  low?:       number
  high?:      number
  isForecast: boolean
}

interface NdviForecastProps {
  historical:     NdviPoint[]
  forecast:       NdviPoint[]
  trend:          number
  residualStd:    number
  ndviForecast3m: number
  healthAt3m:     string
  district?:      string
}

const HEALTH_COLORS: Record<string, string> = {
  STRESSED:    'var(--color-danger)',
  MODERATE:    'var(--color-accent)',
  HEALTHY:     'var(--color-primary)',
  VERY_HEALTHY:'var(--color-primary-light)',
}

const HEALTH_BG: Record<string, string> = {
  STRESSED:    'rgba(248,113,113,0.12)',
  MODERATE:    'rgba(245,158,11,0.12)',
  HEALTHY:     'rgba(34,197,94,0.12)',
  VERY_HEALTHY:'rgba(74,222,128,0.12)',
}

const HEALTH_LABELS: Record<string, string> = {
  STRESSED:    'Stressed',
  MODERATE:    'Moderate',
  HEALTHY:     'Healthy',
  VERY_HEALTHY:'Very Healthy',
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  const ndviP  = payload.find((p: any) => p.dataKey === 'ndvi')
  const isFc   = payload[0]?.payload?.isForecast
  const lo     = payload[0]?.payload?.low
  const hi     = payload[0]?.payload?.high

  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border)',
      borderRadius: 10, padding: '0.75rem 1rem', fontSize: '0.82rem',
    }}>
      <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.3rem' }}>
        {label}{isFc ? ' (forecast)' : ''}
      </div>
      {ndviP && (
        <div style={{ color: isFc ? 'rgba(34,197,94,0.7)' : 'var(--color-primary)' }}>
          NDVI: <b>{ndviP.value?.toFixed(4)}</b>
        </div>
      )}
      {isFc && lo != null && hi != null && (
        <div style={{ color: 'var(--text-muted)', fontSize: '0.76rem' }}>
          Range: {lo?.toFixed(3)} – {hi?.toFixed(3)}
        </div>
      )}
    </div>
  )
}

export default function NdviForecast({
  historical, forecast, trend, residualStd, ndviForecast3m, healthAt3m, district,
}: NdviForecastProps) {
  // Combine historical + forecast into one chart dataset
  // We mark the junction point
  const lastHistDate = historical.length > 0 ? historical[historical.length - 1]?.date : ''

  const histData = historical.map(p => ({
    date:       p.date?.substring(5),   // MM-DD
    fullDate:   p.date,
    ndvi:       p.ndvi,
    low:        undefined as number | undefined,
    high:       undefined as number | undefined,
    isForecast: false,
  }))

  const fcData = forecast.map(p => ({
    date:       p.date?.substring(5, 10),  // MM-DD
    fullDate:   p.date,
    ndvi:       p.ndvi,
    low:        p.low,
    high:       p.high,
    isForecast: true,
  }))

  // Only show every 3rd forecast point label to avoid clutter (26 points = 6 months)
  const combinedData = [...histData, ...fcData]
  const trendUp = trend >= 0

  const healthColor = HEALTH_COLORS[healthAt3m] || 'var(--text-muted)'
  const healthBg    = HEALTH_BG[healthAt3m]    || 'rgba(255,255,255,0.05)'

  return (
    <div className="card">
      {/* Header */}
      <div className="flex items-center justify-between" style={{ marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div className="flex items-center gap-2">
          <Leaf size={18} style={{ color: 'var(--color-primary)' }} />
          <h4>NDVI Forecast — Next 6 Months</h4>
        </div>
        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', background: 'var(--bg-surface)', padding: '3px 10px', borderRadius: 20, border: '1px solid var(--border)' }}>
          Solid = historical · Dashed = forecast
        </div>
      </div>

      {/* Stats row */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
        gap: '0.75rem', marginBottom: '1.25rem',
      }}>
        {/* 3-month forecast health */}
        <div style={{ background: healthBg, border: `1px solid ${healthColor}30`, borderRadius: 10, padding: '0.65rem 0.9rem' }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>3-Month Outlook</div>
          <div style={{ fontWeight: 700, color: healthColor, fontSize: '0.95rem' }}>
            {HEALTH_LABELS[healthAt3m] || healthAt3m}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            NDVI: {ndviForecast3m.toFixed(3)}
          </div>
        </div>

        {/* Current trend */}
        <div style={{ background: trendUp ? 'rgba(34,197,94,0.08)' : 'rgba(248,113,113,0.08)', border: '1px solid var(--border)', borderRadius: 10, padding: '0.65rem 0.9rem' }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>NDVI Trend</div>
          <div className="flex items-center gap-1">
            {trendUp
              ? <TrendingUp size={14} style={{ color: 'var(--color-primary)' }} />
              : <TrendingDown size={14} style={{ color: 'var(--color-danger)' }} />}
            <span style={{ fontWeight: 700, color: trendUp ? 'var(--color-primary)' : 'var(--color-danger)', fontSize: '0.9rem' }}>
              {trendUp ? 'Improving' : 'Declining'}
            </span>
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            {trend >= 0 ? '+' : ''}{(trend * 1000).toFixed(2)} ×10⁻³/day
          </div>
        </div>

        {/* Model confidence */}
        <div style={{ background: 'rgba(56,189,248,0.06)', border: '1px solid rgba(56,189,248,0.15)', borderRadius: 10, padding: '0.65rem 0.9rem' }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>Forecast Accuracy</div>
          <div style={{ fontWeight: 700, color: 'var(--color-info)', fontSize: '0.9rem' }}>
            ±{(residualStd * 100).toFixed(1)}%
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            Widens at longer horizons
          </div>
        </div>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={230}>
        <AreaChart data={combinedData} margin={{ top: 5, right: 8, bottom: 4, left: 4 }}>
          <defs>
            {/* Solid historical gradient */}
            <linearGradient id="ndviHistGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="var(--color-primary)" stopOpacity={0.35} />
              <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0.02} />
            </linearGradient>
            {/* Dashed forecast gradient */}
            <linearGradient id="ndviFcGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="var(--color-primary-light)" stopOpacity={0.2} />
              <stop offset="95%" stopColor="var(--color-primary-light)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis
            dataKey="date"
            tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
            interval={4}
          />
          <YAxis
            domain={[0, 1]}
            tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
            tickFormatter={v => v.toFixed(1)}
            width={36}
          />
          <Tooltip content={<CustomTooltip />} />

          {/* Health zone reference lines */}
          <ReferenceLine y={0.2} stroke="rgba(248,113,113,0.3)" strokeDasharray="3 2"
            label={{ value: 'Stressed', fill: 'var(--color-danger)', fontSize: 9, position: 'right' }} />
          <ReferenceLine y={0.4} stroke="rgba(245,158,11,0.3)" strokeDasharray="3 2"
            label={{ value: 'Moderate', fill: 'var(--color-accent)', fontSize: 9, position: 'right' }} />
          <ReferenceLine y={0.6} stroke="rgba(34,197,94,0.3)" strokeDasharray="3 2"
            label={{ value: 'Healthy', fill: 'var(--color-primary)', fontSize: 9, position: 'right' }} />

          {/* Confidence band (forecast only) — high */}
          <Area
            type="monotone"
            dataKey="high"
            stroke="none"
            fill="rgba(74,222,128,0.1)"
            fillOpacity={1}
            activeDot={false}
            legendType="none"
          />
          {/* Confidence band — low (masks back to card bg) */}
          <Area
            type="monotone"
            dataKey="low"
            stroke="none"
            fill="var(--bg-card)"
            fillOpacity={1}
            activeDot={false}
            legendType="none"
          />

          {/* Historical NDVI — solid */}
          <Area
            type="monotone"
            dataKey="ndvi"
            stroke="var(--color-primary)"
            strokeWidth={2.5}
            fill="url(#ndviHistGrad)"
            dot={false}
            activeDot={{ r: 4, fill: 'var(--color-primary)' }}
            legendType="none"
            connectNulls={false}
          />
        </AreaChart>
      </ResponsiveContainer>

      {/* Legend / info */}
      <div style={{ marginTop: '0.75rem', display: 'flex', gap: '1.25rem', flexWrap: 'wrap', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
        <span>
          <span style={{ color: 'var(--color-primary)', fontWeight: 700 }}>━━</span> Historical NDVI
        </span>
        <span>
          <span style={{ color: 'var(--color-primary-light)', fontWeight: 700 }}>╌╌</span> Forecast ± confidence band
        </span>
        <span style={{ marginLeft: 'auto' }}>
          <Info size={11} style={{ display: 'inline', marginRight: 4 }} />
          Forecast blends seasonal curve with {historical.length} historical readings
        </span>
      </div>
    </div>
  )
}
