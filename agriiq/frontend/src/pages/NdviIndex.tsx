import { useState, useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fieldsApi } from '../api/client'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts'
import {
  Leaf, Activity, TrendingUp, TrendingDown, AlertTriangle,
  CheckCircle, Zap, Sun, Droplets, Wind, RefreshCw,
} from 'lucide-react'
import NdviForecast from '../components/NdviForecast'

// ── Health config ────────────────────────────────────────────────────────────
const HEALTH_CONFIG: Record<string, { label: string; color: string; bg: string; icon: JSX.Element; desc: string }> = {
  STRESSED:    { label: 'Stressed',    color: '#f87171', bg: 'rgba(248,113,113,0.12)', icon: <AlertTriangle size={18} />, desc: 'Crop showing signs of drought or disease stress. Irrigation or treatment advised.' },
  MODERATE:    { label: 'Moderate',    color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  icon: <Zap size={18} />,           desc: 'Vegetation growth is below optimal. Monitor soil moisture and nutrient levels.' },
  HEALTHY:     { label: 'Healthy',     color: '#22c55e', bg: 'rgba(34,197,94,0.12)',   icon: <CheckCircle size={18} />,   desc: 'Field is in good vegetative condition. Continue current management practices.' },
  VERY_HEALTHY:{ label: 'Very Healthy',color: '#4ade80', bg: 'rgba(74,222,128,0.12)',  icon: <Leaf size={18} />,          desc: 'Excellent biomass and canopy cover. Peak growing season conditions detected.' },
}

// ── NDVI health zone bands ────────────────────────────────────────────────────
const BANDS = [
  { label: 'Bare Soil / Water',  range: '-0.1 – 0.1', color: '#64748b', min: -0.1, max: 0.1 },
  { label: 'Sparse Vegetation',  range: '0.1 – 0.2',  color: '#fb923c', min: 0.1,  max: 0.2 },
  { label: 'Stressed Crop',      range: '0.2 – 0.35', color: '#f87171', min: 0.2,  max: 0.35 },
  { label: 'Moderate Crop',      range: '0.35 – 0.5', color: '#f59e0b', min: 0.35, max: 0.5 },
  { label: 'Healthy Crop',       range: '0.5 – 0.65', color: '#22c55e', min: 0.5,  max: 0.65 },
  { label: 'Very Healthy Crop',  range: '0.65 – 1.0', color: '#4ade80', min: 0.65, max: 1.0 },
]

// ── Seasonal NDVI calendar (Indian crops) ────────────────────────────────────
const SEASON_CALENDAR = [
  { month: 'Jan', ndvi: 0.48, season: 'Rabi Peak' },
  { month: 'Feb', ndvi: 0.52, season: 'Rabi Peak' },
  { month: 'Mar', ndvi: 0.42, season: 'Rabi' },
  { month: 'Apr', ndvi: 0.28, season: 'Zaid' },
  { month: 'May', ndvi: 0.22, season: 'Zaid' },
  { month: 'Jun', ndvi: 0.31, season: 'Kharif Start' },
  { month: 'Jul', ndvi: 0.54, season: 'Kharif' },
  { month: 'Aug', ndvi: 0.67, season: 'Kharif Peak' },
  { month: 'Sep', ndvi: 0.61, season: 'Kharif Peak' },
  { month: 'Oct', ndvi: 0.45, season: 'Kharif End' },
  { month: 'Nov', ndvi: 0.35, season: 'Rabi Start' },
  { month: 'Dec', ndvi: 0.41, season: 'Rabi' },
]

// ── NDVI Gauge (SVG arc) ──────────────────────────────────────────────────────
function NdviGauge({ value }: { value: number }) {
  const clampedValue = Math.max(0, Math.min(1, value))
  const rad = (a: number) => (a * Math.PI) / 180
  const cx = 110, cy = 110, r = 85

  const toXY = (a: number) => ({
    x: cx + r * Math.cos(rad(a - 90)),
    y: cy + r * Math.sin(rad(a - 90)),
  })

  const segmentPath = (start: number, end: number) => {
    const s = toXY(start)
    const e = toXY(end)
    const large = end - start > 180 ? 1 : 0
    return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`
  }

  const zones = [
    { color: '#64748b', from: -135, to: -108 },
    { color: '#fb923c', from: -108, to: -81 },
    { color: '#f87171', from: -81,  to: -40 },
    { color: '#f59e0b', from: -40,  to:   0 },
    { color: '#22c55e', from:   0,  to:  40 },
    { color: '#4ade80', from:  40,  to: 135 },
  ]

  const angle = -135 + clampedValue * 270
  const needleX = cx + (r - 14) * Math.cos(rad(angle - 90))
  const needleY = cy + (r - 14) * Math.sin(rad(angle - 90))

  return (
    <svg width={220} height={155} viewBox="0 0 220 155" style={{ overflow: 'visible' }}>
      <path
        d={`M ${toXY(-135).x} ${toXY(-135).y} A ${r} ${r} 0 1 1 ${toXY(135).x} ${toXY(135).y}`}
        fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={18} strokeLinecap="round"
      />
      {zones.map((z, i) => (
        <path key={i} d={segmentPath(z.from, z.to)} fill="none" stroke={z.color} strokeWidth={14} strokeLinecap="butt" opacity={0.75} />
      ))}
      <line x1={cx} y1={cy} x2={needleX} y2={needleY} stroke="white" strokeWidth={2.5} strokeLinecap="round" />
      <circle cx={cx} cy={cy} r={6} fill="white" />
      <text x={cx} y={cy + 32} textAnchor="middle" fill="#f0fdf4" fontSize={26} fontWeight={800} fontFamily="Outfit, sans-serif">
        {clampedValue.toFixed(3)}
      </text>
      <text x={cx} y={cy + 52} textAnchor="middle" fill="#4d7a58" fontSize={11} fontFamily="Inter, sans-serif">
        NDVI
      </text>
    </svg>
  )
}

// ── Tooltip ───────────────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: '0.7rem 1rem', fontSize: '0.8rem' }}>
      <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>{label}</div>
      {payload.map((p: any, i: number) => (
        <div key={i} style={{ color: p.color }}>{p.name}: <b>{typeof p.value === 'number' ? p.value.toFixed(3) : p.value}</b></div>
      ))}
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function NdviIndex() {
  const [selectedFieldId, setSelectedFieldId] = useState('')
  const [showForecast, setShowForecast] = useState(false)
  const [activeBand, setActiveBand] = useState<number | null>(null)
  const prevField = useRef('')

  const { data: fields = [] } = useQuery({ queryKey: ['fields'], queryFn: fieldsApi.list })

  useEffect(() => {
    if (!selectedFieldId && fields.length > 0) setSelectedFieldId(fields[0].id)
  }, [fields, selectedFieldId])

  useEffect(() => {
    if (selectedFieldId !== prevField.current) {
      setShowForecast(false)
      prevField.current = selectedFieldId
    }
  }, [selectedFieldId])

  const { data: ndvi, isLoading: ndviLoading, refetch: refetchNdvi } = useQuery({
    queryKey: ['ndvi', selectedFieldId],
    queryFn: () => fieldsApi.ndvi(selectedFieldId),
    enabled: !!selectedFieldId,
  })

  const { data: ndviForecast, isLoading: ndviFcLoading } = useQuery({
    queryKey: ['ndviForecast', selectedFieldId],
    queryFn: () => fieldsApi.ndviForecast(selectedFieldId, 6),
    enabled: !!selectedFieldId && showForecast,
  })

  const selectedField = (fields as any[]).find((f: any) => f.id === selectedFieldId)
  const healthStatus = ndvi?.stats?.healthStatus || 'MODERATE'
  const health = HEALTH_CONFIG[healthStatus] || HEALTH_CONFIG.MODERATE
  const ndviMean = ndvi?.stats?.mean != null ? Number(ndvi.stats.mean) : null
  const ndviPeak = ndvi?.stats?.peak != null ? Number(ndvi.stats.peak) : null
  const ndviTrend = ndvi?.stats?.trend != null ? Number(ndvi.stats.trend) : 0

  const chartData = (ndvi?.series || []).slice().reverse().map((pt: any) => ({
    date: pt.date?.substring(5),
    mean: pt.ndviMean != null ? parseFloat(Number(pt.ndviMean).toFixed(4)) : null,
    max:  pt.ndviMax  != null ? parseFloat(Number(pt.ndviMax).toFixed(4))  : null,
    min:  pt.ndviMin  != null ? parseFloat(Number(pt.ndviMin).toFixed(4))  : null,
  }))

  const currentBandIdx = ndviMean != null
    ? BANDS.findIndex(b => ndviMean >= b.min && ndviMean < b.max)
    : -1

  const avgCloudCover = ndvi?.series?.length
    ? ((ndvi.series as any[]).reduce((s: number, p: any) => s + (Number(p.cloudCover) || 0), 0) / ndvi.series.length).toFixed(1) + '%'
    : '—'

  if ((fields as any[]).length === 0) {
    return (
      <div className="container section-sm" style={{ textAlign: 'center', paddingTop: '4rem' }}>
        <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🌿</div>
        <h2>No fields yet</h2>
        <p style={{ color: 'var(--text-secondary)', margin: '0.75rem 0 1.5rem' }}>
          Add a field first to see NDVI analysis.
        </p>
      </div>
    )
  }

  return (
    <div className="container section-sm fade-in">
      {/* ── Page Header ── */}
      <div className="flex items-center justify-between" style={{ marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.25rem' }}>
            <Leaf size={24} style={{ color: 'var(--color-primary)' }} />
            NDVI Index Monitor
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Live vegetation index · health zones · seasonal patterns · 6-month forecast
          </p>
        </div>
        <div className="flex items-center gap-3" style={{ flexWrap: 'wrap' }}>
          <select
            className="select" style={{ width: 'auto', minWidth: 200 }}
            value={selectedFieldId}
            onChange={e => setSelectedFieldId(e.target.value)}
          >
            {(fields as any[]).map((f: any) => (
              <option key={f.id} value={f.id}>{f.name} — {f.district}</option>
            ))}
          </select>
          <button className="btn btn-outline btn-sm" onClick={() => refetchNdvi()} title="Refresh NDVI">
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* ── Hero Row: Gauge + Stats ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '1.5rem', marginBottom: '1.5rem', alignItems: 'stretch' }}>
        {/* Gauge card */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minWidth: 220, padding: '1.75rem 2rem' }}>
          {ndviLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}><span className="spinner" /></div>
          ) : (
            <>
              <NdviGauge value={ndviMean ?? 0.35} />
              <div style={{
                marginTop: '0.5rem',
                background: health.bg,
                border: `1px solid ${health.color}40`,
                borderRadius: 999,
                padding: '0.3rem 1rem',
                display: 'flex', alignItems: 'center', gap: '0.4rem',
                color: health.color, fontWeight: 700, fontSize: '0.85rem',
              }}>
                {health.icon}
                {health.label}
              </div>
              <p style={{ fontSize: '0.73rem', color: 'var(--text-muted)', marginTop: '0.6rem', textAlign: 'center', maxWidth: 180 }}>
                {health.desc}
              </p>
            </>
          )}
        </div>

        {/* Stats grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.875rem' }}>
          <div className="stat-card">
            <span className="stat-label">Mean NDVI</span>
            <span className="stat-value" style={{ color: health.color }}>
              {ndviMean != null ? ndviMean.toFixed(3) : '—'}
            </span>
            <span className="stat-change">Last 90 days avg</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Peak NDVI</span>
            <span className="stat-value" style={{ color: 'var(--color-primary-light)' }}>
              {ndviPeak != null ? ndviPeak.toFixed(3) : '—'}
            </span>
            <span className="stat-change">Season maximum</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">30-day Trend</span>
            <span className="stat-value" style={{ fontSize: '1.1rem', color: ndviTrend >= 0 ? 'var(--color-primary)' : 'var(--color-danger)', display: 'flex', alignItems: 'center', gap: 4 }}>
              {ndviTrend >= 0
                ? <TrendingUp size={18} />
                : <TrendingDown size={18} />}
              {ndviTrend >= 0 ? '+' : ''}{(ndviTrend * 1000).toFixed(2)} ×10⁻³
            </span>
            <span className="stat-change">NDVI / day</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Data Points</span>
            <span className="stat-value" style={{ fontSize: '1.4rem' }}>
              {ndvi?.series?.length ?? '—'}
            </span>
            <span className="stat-change">5-day interval</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Avg Cloud Cover</span>
            <span className="stat-value" style={{ fontSize: '1.3rem', color: 'var(--color-info)' }}>
              {avgCloudCover}
            </span>
            <span className="stat-change">
              <Droplets size={11} style={{ display: 'inline' }} /> Sentinel-2 avg
            </span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Location</span>
            <span className="stat-value" style={{ fontSize: '1rem', lineHeight: 1.8 }}>
              {selectedField?.district || '—'}
            </span>
            <span className="stat-change">{selectedField?.state || ''}</span>
          </div>
        </div>
      </div>

      {/* ── NDVI Time-Series Chart ── */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="flex items-center justify-between" style={{ marginBottom: '1rem' }}>
          <div className="flex items-center gap-2">
            <Activity size={18} style={{ color: 'var(--color-primary)' }} />
            <h4>NDVI Time Series — Last 90 Days</h4>
          </div>
          <span className="badge badge-green" style={{ fontSize: '0.72rem' }}>Sentinel-2 / Mock</span>
        </div>

        {ndviLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
            <span className="spinner" style={{ width: 36, height: 36 }} />
          </div>
        ) : chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={chartData} margin={{ top: 5, right: 8, bottom: 4, left: 4 }}>
              <defs>
                <linearGradient id="ndviMeanGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#22c55e" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="ndviMaxGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#4ade80" stopOpacity={0.12} />
                  <stop offset="95%" stopColor="#4ade80" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="date" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} interval={3} />
              <YAxis domain={[0, 1]} tick={{ fill: 'var(--text-muted)', fontSize: 10 }} tickFormatter={v => v.toFixed(1)} width={36} />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine y={0.2}  stroke="rgba(248,113,113,0.35)" strokeDasharray="3 2" label={{ value: 'Stressed', fill: '#f87171', fontSize: 9, position: 'right' }} />
              <ReferenceLine y={0.4}  stroke="rgba(245,158,11,0.35)"  strokeDasharray="3 2" label={{ value: 'Moderate', fill: '#f59e0b', fontSize: 9, position: 'right' }} />
              <ReferenceLine y={0.6}  stroke="rgba(34,197,94,0.35)"   strokeDasharray="3 2" label={{ value: 'Healthy',  fill: '#22c55e', fontSize: 9, position: 'right' }} />
              <Area type="monotone" dataKey="max"  stroke="rgba(74,222,128,0.3)"  strokeWidth={1} fill="url(#ndviMaxGrad)" dot={false} name="Max NDVI" />
              <Area type="monotone" dataKey="min"  stroke="rgba(248,113,113,0.2)" strokeWidth={1} fill="none" dot={false} name="Min NDVI" />
              <Area type="monotone" dataKey="mean" stroke="#22c55e" strokeWidth={2.5} fill="url(#ndviMeanGrad)" dot={false} activeDot={{ r: 4 }} name="Mean NDVI" />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2.5rem' }}>No NDVI data available yet</p>
        )}

        <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.75rem' }}>
          <span><span style={{ color: '#22c55e', fontWeight: 700 }}>━━</span> Mean NDVI</span>
          <span><span style={{ color: '#4ade80', fontWeight: 700 }}>━━</span> Max NDVI</span>
          <span><span style={{ color: '#f87171', fontWeight: 700 }}>━━</span> Min NDVI</span>
        </div>
      </div>

      {/* ── Health Zone Bands ── */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="flex items-center gap-2" style={{ marginBottom: '1.25rem' }}>
          <Zap size={18} style={{ color: 'var(--color-accent)' }} />
          <h4>NDVI Health Zone Breakdown</h4>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {BANDS.map((b, i) => {
            const isHighlighted = i === currentBandIdx || i === activeBand
            const pct = ndviMean != null && i === currentBandIdx
              ? Math.max(0, Math.min(100, ((ndviMean - b.min) / (b.max - b.min)) * 100))
              : i < currentBandIdx ? 100 : 0
            return (
              <div
                key={i}
                onMouseEnter={() => setActiveBand(i)}
                onMouseLeave={() => setActiveBand(null)}
                style={{
                  display: 'grid', gridTemplateColumns: '160px 1fr 90px',
                  alignItems: 'center', gap: '1rem',
                  padding: '0.55rem 0.75rem', borderRadius: 10,
                  background: isHighlighted ? `${b.color}14` : 'transparent',
                  border: `1px solid ${isHighlighted ? b.color + '40' : 'transparent'}`,
                  cursor: 'default', transition: 'all 0.18s',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: b.color, flexShrink: 0 }} />
                  <span style={{ fontSize: '0.82rem', color: isHighlighted ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: i === currentBandIdx ? 700 : 400 }}>
                    {b.label}
                  </span>
                </div>
                <div style={{ height: 6, background: 'rgba(255,255,255,0.07)', borderRadius: 999, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', borderRadius: 999,
                    width: `${pct}%`,
                    background: b.color, transition: 'width 0.6s ease',
                  }} />
                </div>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textAlign: 'right', fontFamily: 'monospace' }}>
                  {b.range}
                </span>
              </div>
            )
          })}
        </div>
        {ndviMean != null && (
          <div style={{ marginTop: '1rem', padding: '0.6rem 0.9rem', background: `${health.color}10`, border: `1px solid ${health.color}30`, borderRadius: 10, fontSize: '0.83rem' }}>
            <span style={{ color: health.color, fontWeight: 700 }}>Current field NDVI {ndviMean.toFixed(3)}</span>
            <span style={{ color: 'var(--text-muted)', marginLeft: '0.5rem' }}>
              falls in the <b style={{ color: health.color }}>{health.label}</b> zone.
            </span>
          </div>
        )}
      </div>

      {/* ── Seasonal NDVI Calendar ── */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="flex items-center gap-2" style={{ marginBottom: '1.25rem' }}>
          <Sun size={18} style={{ color: 'var(--color-accent)' }} />
          <h4>Typical NDVI Seasonal Pattern — Indian Agriculture</h4>
        </div>
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={SEASON_CALENDAR} margin={{ top: 5, right: 8, bottom: 4, left: 4 }}>
            <defs>
              <linearGradient id="seasonGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#f59e0b" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="month" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
            <YAxis domain={[0, 1]} tick={{ fill: 'var(--text-muted)', fontSize: 10 }} tickFormatter={v => v.toFixed(1)} width={32} />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine y={0.5} stroke="rgba(34,197,94,0.25)" strokeDasharray="3 2" />
            <Area type="monotone" dataKey="ndvi" stroke="#f59e0b" strokeWidth={2.5} fill="url(#seasonGrad)" dot={{ fill: '#f59e0b', r: 3 }} name="Typical NDVI" />
          </AreaChart>
        </ResponsiveContainer>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '0.5rem', marginTop: '0.875rem' }}>
          {[
            { label: 'Kharif Peak',  months: 'Aug–Sep', color: '#22c55e' },
            { label: 'Rabi Peak',    months: 'Jan–Feb', color: '#4ade80' },
            { label: 'Kharif Sow',  months: 'Jun–Jul', color: '#f59e0b' },
            { label: 'Lean Season', months: 'Apr–May', color: '#f87171' },
          ].map(s => (
            <div key={s.label} style={{ padding: '0.45rem 0.7rem', background: `${s.color}10`, border: `1px solid ${s.color}30`, borderRadius: 8, fontSize: '0.75rem' }}>
              <div style={{ color: s.color, fontWeight: 700 }}>{s.label}</div>
              <div style={{ color: 'var(--text-muted)' }}>{s.months}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── NDVI Formula Reference Card ── */}
      <div className="card" style={{ marginBottom: '1.5rem', background: 'rgba(34,197,94,0.04)' }}>
        <div className="flex items-center gap-2" style={{ marginBottom: '1rem' }}>
          <Wind size={18} style={{ color: 'var(--color-info)' }} />
          <h4>Understanding the NDVI Index</h4>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem' }}>
          <div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Formula</div>
            <div style={{ fontFamily: 'monospace', fontSize: '1rem', color: 'var(--color-primary)', background: 'rgba(34,197,94,0.08)', padding: '0.6rem 0.9rem', borderRadius: 8 }}>
              NDVI = (NIR - Red) / (NIR + Red)
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
              NIR = Near-Infrared reflectance · Red = visible red reflectance. Values range from -1 to +1.
            </p>
          </div>
          <div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Key Thresholds</div>
            <table style={{ width: '100%', fontSize: '0.8rem', borderCollapse: 'collapse' }}>
              <tbody>
                {[
                  ['< 0.1',       'Bare soil, water, or snow',  '#64748b'],
                  ['0.1 – 0.2',   'Very sparse vegetation',     '#fb923c'],
                  ['0.2 – 0.35',  'Sparse / stressed crop',     '#f87171'],
                  ['0.35 – 0.5',  'Moderate crop growth',       '#f59e0b'],
                  ['0.5 – 0.65',  'Dense healthy vegetation',   '#22c55e'],
                  ['> 0.65',      'Very dense canopy cover',    '#4ade80'],
                ].map(([range, desc, color]) => (
                  <tr key={range as string}>
                    <td style={{ padding: '0.2rem 0.4rem', color: color as string, fontWeight: 700, fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{range}</td>
                    <td style={{ padding: '0.2rem 0.4rem', color: 'var(--text-secondary)' }}>{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Data Source</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.82rem' }}>
              {[
                { label: 'Satellite',   value: 'Sentinel-2 (ESA)',      color: 'var(--color-info)' },
                { label: 'Resolution',  value: '10m · 5-day revisit',   color: 'var(--text-secondary)' },
                { label: 'Bands used',  value: 'B04 (Red) + B08 (NIR)', color: 'var(--text-secondary)' },
                { label: 'Provider',    value: 'Mock (dev mode)',        color: 'var(--color-accent)' },
              ].map(row => (
                <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>{row.label}</span>
                  <span style={{ color: row.color, fontWeight: 600 }}>{row.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── 6-Month Forecast Toggle ── */}
      <div style={{ marginBottom: '1.5rem' }}>
        <button
          className={`btn ${showForecast ? 'btn-primary' : 'btn-outline'}`}
          style={{ marginBottom: '1rem' }}
          onClick={() => setShowForecast(v => !v)}
        >
          <Leaf size={16} />
          {showForecast ? 'Hide' : 'Show'} 6-Month NDVI Forecast
        </button>

        {showForecast && (
          ndviFcLoading ? (
            <div className="card" style={{ textAlign: 'center', padding: '2.5rem' }}>
              <span className="spinner" style={{ width: 36, height: 36, margin: '0 auto' }} />
              <p style={{ color: 'var(--text-muted)', marginTop: '0.75rem', fontSize: '0.85rem' }}>
                Generating 6-month NDVI forecast using seasonal trend model...
              </p>
            </div>
          ) : ndviForecast ? (
            <NdviForecast
              historical={ndviForecast.historical || []}
              forecast={ndviForecast.forecast   || []}
              trend={ndviForecast.trend          || 0}
              residualStd={ndviForecast.residualStd || 0.04}
              ndviForecast3m={ndviForecast.ndviForecast3m || 0.4}
              healthAt3m={ndviForecast.healthAt3m   || 'MODERATE'}
              district={selectedField?.district}
            />
          ) : null
        )}
      </div>
    </div>
  )
}
