import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fieldsApi, profitabilityApi, locationApi } from '../api/client'
import {
  TrendingUp,
  DollarSign,
  PieChart,
  BarChart3,
  Percent,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Scale,
  Layers,
  HelpCircle
} from 'lucide-react'
import toast from 'react-hot-toast'
import { Link } from 'react-router-dom'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  Legend
} from 'recharts'

const CROPS = [
  'Rice', 'Wheat', 'Maize', 'Soybean', 'Cotton', 'Sugarcane',
  'Tomato', 'Onion', 'Potato', 'Groundnut', 'Millets', 'Tur (Arhar)', 'Gram'
]

export default function Profitability() {
  const [selectedFieldId, setSelectedFieldId] = useState<string>('')
  const [crop, setCrop] = useState<string>('Rice')
  const [areaAcres, setAreaAcres] = useState<number>(2.5)
  const [state, setState] = useState<string>('Maharashtra')
  const [district, setDistrict] = useState<string>('Nashik')
  const [season, setSeason] = useState<string>('Kharif')
  const [customPrice, setCustomPrice] = useState<number | ''>('')
  const [customYield, setCustomYield] = useState<number | ''>('')
  const [loading, setLoading] = useState<boolean>(false)
  const [result, setResult] = useState<any>(null)

  // Fetch registered fields
  const { data: fields = [] } = useQuery({
    queryKey: ['fields'],
    queryFn: fieldsApi.list,
  })

  // Auto-fill from field if available
  useEffect(() => {
    if (fields.length > 0 && !selectedFieldId) {
      setSelectedFieldId(fields[0].id)
    }
  }, [fields, selectedFieldId])

  useEffect(() => {
    if (!selectedFieldId) return
    const f = fields.find((f: any) => f.id === selectedFieldId)
    if (f) {
      if (f.area_hectares) setAreaAcres(Math.round(f.area_hectares * 2.471 * 10) / 10)
      if (f.state) setState(f.state)
      if (f.district) setDistrict(f.district)
    }
  }, [selectedFieldId, fields])

  const handleCalculate = async () => {
    if (!crop || !areaAcres || areaAcres <= 0) {
      toast.error('Please specify crop and valid area')
      return
    }
    setLoading(true)
    try {
      const data = await profitabilityApi.calculate({
        crop,
        area_acres: Number(areaAcres),
        state: state || undefined,
        district: district || undefined,
        season: season || undefined,
        custom_price: customPrice !== '' ? Number(customPrice) : null,
        custom_yield: customYield !== '' ? Number(customYield) : null,
      })
      setResult(data)
      toast.success(`Profitability model generated for ${crop}!`)
    } catch (err) {
      toast.error('Calculation failed')
    } finally {
      setLoading(false)
    }
  }

  // Calculate once on mount
  useEffect(() => {
    if (!result) {
      handleCalculate()
    }
  }, [])

  // Prepare scenario chart data
  const scenarioChartData = result?.scenarios?.map((s: any) => ({
    name: s.label,
    Yield: Math.round(s.yield_kg_acre),
    Revenue: Math.round(s.revenue),
    Cost: Math.round(result.cost_breakdown.total),
    Profit: Math.round(s.profit),
  })) || []

  // Cost breakdown items
  const costItems = result?.cost_breakdown ? [
    { label: 'Seeds / Seedlings', val: result.cost_breakdown.seed, color: '#38bdf8' },
    { label: 'Fertilizers & Nutrients', val: result.cost_breakdown.fertilizer, color: '#22c55e' },
    { label: 'Crop Protection & Pesticides', val: result.cost_breakdown.pesticide, color: '#eab308' },
    { label: 'Labor & Operations', val: result.cost_breakdown.labor, color: '#f97316' },
    { label: 'Irrigation & Power', val: result.cost_breakdown.irrigation, color: '#818cf8' },
    { label: 'Machinery & Other Inputs', val: result.cost_breakdown.other, color: '#a855f7' },
  ] : []

  return (
    <div className="container section-sm" style={{ maxWidth: '1280px', margin: '0 auto', padding: '1.5rem' }}>
      {/* ── Header ── */}
      <div style={{ marginBottom: '1.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.35rem' }}>
          <span style={{
            background: 'rgba(34, 197, 94, 0.15)',
            color: 'var(--color-primary)',
            padding: '0.35rem',
            borderRadius: '8px',
            display: 'inline-flex'
          }}>
            <TrendingUp size={22} />
          </span>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0 }}>
            Agricultural Profitability & ROI Calculator
          </h1>
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', margin: 0 }}>
          Comprehensive financial modeling combining expected yields, live mandi prices, and production cost breakdowns.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 360px) 1fr', gap: '1.5rem', alignItems: 'start' }}>
        {/* ── Left Column: Inputs ── */}
        <div className="card" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '1.25rem' }}>
          <h2 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Layers size={17} style={{ color: 'var(--color-primary)' }} />
            Economic Inputs
          </h2>

          {fields.length > 0 && (
            <div className="form-group" style={{ marginBottom: '1rem' }}>
              <label className="label" style={{ fontSize: '0.82rem', fontWeight: 600 }}>Farm Field</label>
              <select
                className="select"
                value={selectedFieldId}
                onChange={e => setSelectedFieldId(e.target.value)}
                style={{ width: '100%', background: 'var(--bg-base)', fontSize: '0.88rem' }}
              >
                {fields.map((f: any) => (
                  <option key={f.id} value={f.id}>
                    {f.name} ({f.district}, {f.state})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <label className="label" style={{ fontSize: '0.82rem', fontWeight: 600 }}>Crop *</label>
            <select
              className="select"
              value={crop}
              onChange={e => setCrop(e.target.value)}
              style={{ width: '100%', background: 'var(--bg-base)', fontSize: '0.88rem' }}
            >
              {CROPS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <label className="label" style={{ fontSize: '0.82rem', fontWeight: 600 }}>Cultivated Area (Acres) *</label>
            <input
              type="number"
              step="0.1"
              min="0.1"
              className="input"
              value={areaAcres}
              onChange={e => setAreaAcres(parseFloat(e.target.value) || 0)}
              style={{ width: '100%', background: 'var(--bg-base)', fontSize: '0.88rem' }}
            />
          </div>

          <div className="grid-2" style={{ gap: '0.75rem', marginBottom: '1rem' }}>
            <div className="form-group">
              <label className="label" style={{ fontSize: '0.82rem', fontWeight: 600 }}>State</label>
              <input
                type="text"
                className="input"
                value={state}
                onChange={e => setState(e.target.value)}
                style={{ width: '100%', background: 'var(--bg-base)', fontSize: '0.85rem' }}
              />
            </div>
            <div className="form-group">
              <label className="label" style={{ fontSize: '0.82rem', fontWeight: 600 }}>District</label>
              <input
                type="text"
                className="input"
                value={district}
                onChange={e => setDistrict(e.target.value)}
                style={{ width: '100%', background: 'var(--bg-base)', fontSize: '0.85rem' }}
              />
            </div>
          </div>

          {/* Overrides */}
          <div style={{
            background: 'rgba(0,0,0,0.18)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            padding: '0.9rem',
            marginBottom: '1.25rem'
          }}>
            <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
              Advanced Overrides (Optional)
            </div>

            <div style={{ marginBottom: '0.6rem' }}>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                Override Mandi Price (₹ / quintal)
              </label>
              <input
                type="number"
                placeholder="Auto from Agmarknet"
                className="input"
                style={{ width: '100%', padding: '0.35rem 0.6rem', fontSize: '0.82rem', background: 'var(--bg-base)' }}
                value={customPrice}
                onChange={e => setCustomPrice(e.target.value ? Number(e.target.value) : '')}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                Override Expected Yield (kg / acre)
              </label>
              <input
                type="number"
                placeholder="Auto from ML model"
                className="input"
                style={{ width: '100%', padding: '0.35rem 0.6rem', fontSize: '0.82rem', background: 'var(--bg-base)' }}
                value={customYield}
                onChange={e => setCustomYield(e.target.value ? Number(e.target.value) : '')}
              />
            </div>
          </div>

          <button
            className="btn btn-primary"
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontWeight: 700 }}
            onClick={handleCalculate}
            disabled={loading}
          >
            {loading ? <span className="spinner" style={{ width: 18, height: 18 }} /> : <Sparkles size={16} />}
            Compute Financials
          </button>
        </div>

        {/* ── Right Column: Financial Results ── */}
        <div>
          {result ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Executive Summary Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.85rem' }}>
                {/* Net Profit Central */}
                <div className="card" style={{
                  background: result.profit_range?.central >= 0
                    ? 'linear-gradient(135deg, rgba(34, 197, 94, 0.2) 0%, rgba(10, 15, 13, 0.8) 100%)'
                    : 'linear-gradient(135deg, rgba(239, 68, 68, 0.2) 0%, rgba(10, 15, 13, 0.8) 100%)',
                  border: result.profit_range?.central >= 0 ? '1px solid rgba(34, 197, 94, 0.35)' : '1px solid rgba(239, 68, 68, 0.35)',
                  borderRadius: '12px',
                  padding: '1.15rem'
                }}>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>
                    Expected Net Profit
                  </div>
                  <div style={{
                    fontSize: '1.85rem',
                    fontWeight: 800,
                    color: result.profit_range?.central >= 0 ? 'var(--color-primary)' : 'var(--color-danger)',
                    margin: '0.25rem 0'
                  }}>
                    ₹{Math.round(result.profit_range?.central).toLocaleString('en-IN')}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Range: ₹{Math.round(result.profit_range?.low).toLocaleString('en-IN')} – ₹{Math.round(result.profit_range?.high).toLocaleString('en-IN')}
                  </div>
                </div>

                {/* Total Cost */}
                <div className="card" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '1.15rem' }}>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>
                    Total Production Cost
                  </div>
                  <div style={{ fontSize: '1.85rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0.25rem 0' }}>
                    ₹{Math.round(result.cost_breakdown?.total).toLocaleString('en-IN')}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    ₹{Math.round(result.cost_breakdown?.total / result.area_acres).toLocaleString('en-IN')} per acre
                  </div>
                </div>

                {/* ROI */}
                <div className="card" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '1.15rem' }}>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>
                    Estimated ROI
                  </div>
                  <div style={{
                    fontSize: '1.85rem',
                    fontWeight: 800,
                    color: result.return_on_investment_pct >= 50 ? '#4ade80' : result.return_on_investment_pct >= 20 ? '#facc15' : '#f87171',
                    margin: '0.25rem 0'
                  }}>
                    {result.return_on_investment_pct}%
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Return on Capital Invested
                  </div>
                </div>

                {/* Breakeven Yield */}
                <div className="card" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '1.15rem' }}>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>
                    Breakeven Yield
                  </div>
                  <div style={{ fontSize: '1.85rem', fontWeight: 800, color: '#38bdf8', margin: '0.25rem 0' }}>
                    {Math.round(result.breakeven_yield_kg_acre)} <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>kg/ac</span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    At ₹{result.price_inr_per_quintal}/qtl market price
                  </div>
                </div>
              </div>

              {/* Scenarios Comparison Chart */}
              <div className="card" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div>
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0 }}>
                      Yield & Profitability Scenarios
                    </h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', margin: '0.2rem 0 0 0' }}>
                      Comparing conservative (P10), realistic median (P50), and bumper harvest (P90) outcomes
                    </p>
                  </div>
                  <span className="badge badge-green" style={{ fontSize: '0.75rem' }}>
                    Market: ₹{result.price_inr_per_quintal} / quintal
                  </span>
                </div>

                <div style={{ height: '260px', width: '100%' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={scenarioChartData} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                      <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={12} />
                      <YAxis stroke="var(--text-muted)" fontSize={12} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                      <Tooltip
                        contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '0.85rem' }}
                        formatter={(val: any, name: string) => [
                          name === 'Yield' ? `${val} kg/ac` : `₹${Number(val).toLocaleString('en-IN')}`,
                          name
                        ]}
                      />
                      <Legend wrapperStyle={{ fontSize: '0.8rem', paddingTop: '10px' }} />
                      <Bar dataKey="Revenue" fill="#22c55e" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Cost" fill="#64748b" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Profit" fill="#38bdf8" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Cost Breakdown Table & Bar */}
              <div className="card" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '1.25rem' }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <PieChart size={17} style={{ color: 'var(--color-primary)' }} />
                  Production Cost Distribution ({result.area_acres} Acres)
                </h3>

                {/* Progress bar visual */}
                <div style={{
                  display: 'flex',
                  height: '14px',
                  borderRadius: '7px',
                  overflow: 'hidden',
                  marginBottom: '1.25rem',
                  background: 'rgba(255,255,255,0.05)'
                }}>
                  {costItems.map((item, idx) => {
                    const pct = (item.val / result.cost_breakdown.total) * 100
                    return (
                      <div
                        key={idx}
                        style={{
                          width: `${pct}%`,
                          background: item.color,
                          transition: 'width 0.3s ease'
                        }}
                        title={`${item.label}: ₹${Math.round(item.val)} (${pct.toFixed(1)}%)`}
                      />
                    )
                  })}
                </div>

                {/* Table of items */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.75rem' }}>
                  {costItems.map((item, idx) => {
                    const pct = ((item.val / result.cost_breakdown.total) * 100).toFixed(1)
                    return (
                      <div key={idx} style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.6rem 0.85rem',
                        background: 'rgba(0,0,0,0.2)',
                        border: '1px solid var(--border)',
                        borderRadius: '8px'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: item.color, flexShrink: 0 }} />
                          <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{item.label}</span>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <strong style={{ fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                            ₹{Math.round(item.val).toLocaleString('en-IN')}
                          </strong>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginLeft: '0.35rem' }}>
                            ({pct}%)
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Navigation links & Disclaimers */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '1rem',
                padding: '1rem',
                background: 'rgba(34, 197, 94, 0.05)',
                border: '1px solid rgba(34, 197, 94, 0.2)',
                borderRadius: '10px'
              }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)', marginBottom: '0.2rem' }}>
                    Need to fine-tune your fertilizer investment?
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    Visit the Fertilizer Advisor to optimize DAP, Urea, and MOP bag requirements.
                  </div>
                </div>
                <Link
                  to="/fertilizer"
                  className="btn btn-sm btn-primary"
                  style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem' }}
                >
                  Fertilizer Advisor <ArrowRight size={14} />
                </Link>
              </div>

              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                <strong>Disclaimer:</strong> {result.disclaimer}
              </div>
            </div>
          ) : (
            <div className="card" style={{ padding: '3rem 2rem', textAlign: 'center', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px' }}>
              <TrendingUp size={40} style={{ color: 'var(--text-muted)', margin: '0 auto 1rem auto' }} />
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)' }}>Calculate Profitability</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                Select a crop and click "Compute Financials" to view scenarios, cost breakdown, and ROI.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
