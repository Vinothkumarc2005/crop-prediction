import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fieldsApi, predictApi } from '../api/client'
import {
  Sprout,
  TrendingUp,
  Droplets,
  ShieldAlert,
  CheckCircle2,
  Calendar,
  Layers,
  ArrowRight,
  Sparkles,
  BarChart2,
  Scale,
  Award,
  AlertCircle,
  FlaskConical,
  DollarSign
} from 'lucide-react'
import toast from 'react-hot-toast'
import { Link } from 'react-router-dom'

interface CropItem {
  crop: string
  confidence: number
  suitability_score?: number
  yield_estimate_kg_ha?: number
  yield_range?: { low: number; central: number; high: number }
  revenue_estimate_inr?: number
  profit_estimate_inr?: number
  water_requirement?: 'Low' | 'Medium' | 'High'
  duration_days?: number
  risks?: string[]
  reasons?: string[]
  market_outlook?: 'Bullish' | 'Stable' | 'Volatile'
}

// Fallback richness data for crops
const CROP_METADATA: Record<string, Partial<CropItem>> = {
  Rice: {
    water_requirement: 'High',
    duration_days: 125,
    market_outlook: 'Stable',
    reasons: ['Optimal clay loam soil retention', 'Kharif rainfall sufficiency', 'High local MSP assurance'],
    risks: ['Pest incidence (Blast / Stem borer)', 'High standing water requirement']
  },
  Wheat: {
    water_requirement: 'Medium',
    duration_days: 120,
    market_outlook: 'Bullish',
    reasons: ['Ideal cool winter temperature profile', 'High regional procurement', 'Excellent soil NPK response'],
    risks: ['Terminal heat stress in March', 'Yellow rust vulnerability']
  },
  Maize: {
    water_requirement: 'Medium',
    duration_days: 100,
    market_outlook: 'Bullish',
    reasons: ['Fast-growing with versatile industrial demand', 'High grain yield per acre', 'Good drought resilience'],
    risks: ['Fall armyworm vigilance needed', 'Requires well-drained soil']
  },
  Soybean: {
    water_requirement: 'Low',
    duration_days: 95,
    market_outlook: 'Bullish',
    reasons: ['Natural biological nitrogen fixation', 'Low input requirement', 'High oilseed market demand'],
    risks: ['Excessive rainfall during harvesting', 'Yellow mosaic virus']
  },
  Cotton: {
    water_requirement: 'Medium',
    duration_days: 160,
    market_outlook: 'Volatile',
    reasons: ['Deep black cotton soil compatibility', 'High cash crop revenue potential'],
    risks: ['Pink bollworm infestation risk', 'Price fluctuations in international markets']
  },
  Groundnut: {
    water_requirement: 'Low',
    duration_days: 110,
    market_outlook: 'Stable',
    reasons: ['Well-drained sandy loam match', 'Enriches soil nitrogen for next crop cycle'],
    risks: ['Tikka disease during humidity', 'Pegging stage moisture sensitive']
  },
  Sugarcane: {
    water_requirement: 'High',
    duration_days: 360,
    market_outlook: 'Stable',
    reasons: ['Assured mill procurement pricing', 'High biomass and total gross revenue'],
    risks: ['Long year-round duration', 'High irrigation dependency']
  },
  Tomato: {
    water_requirement: 'Medium',
    duration_days: 85,
    market_outlook: 'Volatile',
    reasons: ['Fast turnaround horticultural crop', 'Exceptional peak profitability potential'],
    risks: ['High price volatility', 'Early blight & bacterial wilt risk']
  },
  Onion: {
    water_requirement: 'Medium',
    duration_days: 120,
    market_outlook: 'Volatile',
    reasons: ['High market demand and export potential', 'Well suited for rotational cropping'],
    risks: ['Bulb rot during sudden rain', 'Storage losses']
  },
  Millets: {
    water_requirement: 'Low',
    duration_days: 80,
    market_outlook: 'Bullish',
    reasons: ['Supreme climate resilience & minimal water need', 'Surging superfood consumer demand', 'Extremely low fertilizer cost'],
    risks: ['Bird damage during grain maturity', 'Lower gross yield volume']
  },
}

export default function CropIntelligence() {
  const [selectedFieldId, setSelectedFieldId] = useState<string>('')
  const [season, setSeason] = useState<string>('Kharif')
  const [activeCrop, setActiveCrop] = useState<string>('')
  const [sortBy, setSortBy] = useState<'score' | 'profit' | 'yield' | 'water'>('score')
  const [loading, setLoading] = useState<boolean>(false)
  const [recoData, setRecoData] = useState<any>(null)

  // Fetch fields
  const { data: fields = [] } = useQuery({
    queryKey: ['fields'],
    queryFn: fieldsApi.list,
  })

  useEffect(() => {
    if (fields.length > 0 && !selectedFieldId) {
      setSelectedFieldId(fields[0].id)
    }
  }, [fields, selectedFieldId])

  const selectedField = fields.find((f: any) => f.id === selectedFieldId)

  // Fetch recommendations
  const fetchRecommendations = async (fieldId: string, seasonVal: string) => {
    if (!fieldId) return
    setLoading(true)
    try {
      const data = await predictApi.recommend({ fieldId, season: seasonVal })
      setRecoData(data)
      if (data.crops && data.crops.length > 0) {
        setActiveCrop(data.crops[0].crop)
      }
      toast.success(`Evaluated ${data.crops?.length || 0} crops for ${selectedField?.name || 'field'}!`)
    } catch (err) {
      toast.error('Failed to load crop intelligence')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (selectedFieldId) {
      fetchRecommendations(selectedFieldId, season)
    }
  }, [selectedFieldId, season])

  // Combine and enrich crops
  const enrichedCrops = (recoData?.crops || []).map((c: any) => {
    const meta = CROP_METADATA[c.crop] || {}
    const conf = c.confidenceScore !== undefined ? c.confidenceScore : (c.confidence || 0.85)
    const scorePct = Math.round(conf * 100)
    const yieldKg = c.yieldRange?.p50 || c.yield_estimate_kg_ha || 2800
    const areaHa = selectedField?.area_hectares || 1.0
    const estProfit = c.profitRange?.medProfit ? Math.round(c.profitRange.medProfit * areaHa) : (c.profit_estimate_inr || Math.round(yieldKg * 14 * areaHa))

    const reasons = c.explanations && c.explanations.length > 0
      ? c.explanations.map((e: any) => e.description || `${e.label}: ${e.direction}`)
      : (meta.reasons || ['Suitable climate conditions', 'Favorable regional soil profile'])

    const risks = c.riskReason
      ? [c.riskReason, ...(meta.risks || [])]
      : (meta.risks || ['Monitor seasonal weather variations'])

    return {
      crop: c.crop,
      confidence: conf,
      suitability_score: scorePct,
      yield_estimate_kg_ha: Math.round(yieldKg),
      profit_estimate_inr: estProfit,
      water_requirement: meta.water_requirement || 'Medium',
      duration_days: meta.duration_days || 110,
      market_outlook: meta.market_outlook || 'Stable',
      reasons,
      risks,
    }
  })

  // Sort crops based on active filter
  const sortedCrops = [...enrichedCrops].sort((a, b) => {
    if (sortBy === 'score') return b.suitability_score - a.suitability_score
    if (sortBy === 'profit') return b.profit_estimate_inr - a.profit_estimate_inr
    if (sortBy === 'yield') return b.yield_estimate_kg_ha - a.yield_estimate_kg_ha
    if (sortBy === 'water') {
      const order = { Low: 1, Medium: 2, High: 3 }
      return (order[a.water_requirement as keyof typeof order] || 2) - (order[b.water_requirement as keyof typeof order] || 2)
    }
    return 0
  })

  const currentCrop = enrichedCrops.find((c: any) => c.crop === activeCrop) || enrichedCrops[0]

  return (
    <div className="container section-sm" style={{ maxWidth: '1280px', margin: '0 auto', padding: '1.5rem' }}>
      {/* ── Page Header ── */}
      <div style={{ marginBottom: '1.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.35rem' }}>
          <span style={{
            background: 'rgba(34, 197, 94, 0.15)',
            color: 'var(--color-primary)',
            padding: '0.35rem',
            borderRadius: '8px',
            display: 'inline-flex'
          }}>
            <Sprout size={22} />
          </span>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0 }}>
            Crop Intelligence & Comparative Matrix
          </h1>
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', margin: 0 }}>
          Multi-factor crop suitability engine integrating soil nutrients, NDVI indices, weather outlook, and market economics.
        </p>
      </div>

      {/* ── Selection Control Bar ── */}
      <div className="card" style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: '12px',
        padding: '1rem 1.25rem',
        marginBottom: '1.5rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          {fields.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Field:</span>
              <select
                className="select"
                value={selectedFieldId}
                onChange={e => setSelectedFieldId(e.target.value)}
                style={{ background: 'var(--bg-base)', fontSize: '0.85rem', padding: '0.35rem 0.75rem' }}
              >
                {fields.map((f: any) => (
                  <option key={f.id} value={f.id}>
                    {f.name} ({f.district}, {f.state})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Season:</span>
            <div style={{ display: 'flex', background: 'var(--bg-base)', padding: '2px', borderRadius: '8px', border: '1px solid var(--border)' }}>
              {['Kharif', 'Rabi', 'Zaid'].map(s => (
                <button
                  key={s}
                  type="button"
                  className={`btn btn-xs ${season === s ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => setSeason(s)}
                  style={{ fontSize: '0.78rem', padding: '0.25rem 0.6rem' }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Sort Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Sort By:</span>
          <button
            type="button"
            className={`btn btn-xs ${sortBy === 'score' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setSortBy('score')}
            style={{ fontSize: '0.75rem' }}
          >
            ⭐ Match Score
          </button>
          <button
            type="button"
            className={`btn btn-xs ${sortBy === 'profit' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setSortBy('profit')}
            style={{ fontSize: '0.75rem' }}
          >
            💰 Profit
          </button>
          <button
            type="button"
            className={`btn btn-xs ${sortBy === 'yield' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setSortBy('yield')}
            style={{ fontSize: '0.75rem' }}
          >
            🌾 Yield
          </button>
          <button
            type="button"
            className={`btn btn-xs ${sortBy === 'water' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setSortBy('water')}
            style={{ fontSize: '0.75rem' }}
          >
            💧 Water Need
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: '4rem', textAlign: 'center' }}>
          <span className="spinner" style={{ width: 36, height: 36 }} />
          <p style={{ color: 'var(--text-secondary)', marginTop: '1rem', fontSize: '0.9rem' }}>
            Analyzing soil chemistry, historical weather, and market price matrices…
          </p>
        </div>
      ) : sortedCrops.length > 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr minmax(320px, 400px)', gap: '1.5rem', alignItems: 'start' }}>
          {/* ── Left Column: Side-by-Side Comparison Table ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div className="card" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '0', overflow: 'hidden' }}>
              <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0 }}>
                  Crop Suitability Matrix
                </h3>
                <span className="badge badge-green" style={{ fontSize: '0.72rem' }}>
                  {sortedCrops.length} Crops Evaluated
                </span>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ background: 'rgba(0,0,0,0.3)', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                      <th style={{ padding: '0.75rem 1rem' }}>Rank & Crop</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Match Score</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Est. Yield</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Est. Net Profit</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Water</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Duration</th>
                      <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedCrops.map((c: any, idx: number) => {
                      const isSelected = c.crop === currentCrop?.crop
                      return (
                        <tr
                          key={c.crop}
                          onClick={() => setActiveCrop(c.crop)}
                          style={{
                            cursor: 'pointer',
                            background: isSelected ? 'rgba(34, 197, 94, 0.12)' : idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)',
                            borderBottom: '1px solid var(--border)',
                            transition: 'background 0.15s ease'
                          }}
                        >
                          <td style={{ padding: '0.85rem 1rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                              <span style={{
                                width: '22px',
                                height: '22px',
                                borderRadius: '50%',
                                background: idx === 0 ? '#eab308' : idx === 1 ? '#94a3b8' : idx === 2 ? '#b45309' : 'rgba(255,255,255,0.08)',
                                color: idx < 3 ? '#000' : 'var(--text-secondary)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 800,
                                fontSize: '0.72rem',
                                flexShrink: 0
                              }}>
                                {idx + 1}
                              </span>
                              <strong style={{ fontSize: '0.92rem', color: isSelected ? 'var(--color-primary)' : 'var(--text-primary)' }}>
                                {c.crop}
                              </strong>
                            </div>
                          </td>

                          <td style={{ padding: '0.85rem 1rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              <div style={{ width: '45px', height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                                <div style={{ width: `${c.suitability_score}%`, height: '100%', background: c.suitability_score >= 80 ? '#22c55e' : c.suitability_score >= 65 ? '#eab308' : '#ef4444' }} />
                              </div>
                              <span style={{ fontWeight: 700, color: c.suitability_score >= 80 ? '#4ade80' : '#facc15' }}>
                                {c.suitability_score}%
                              </span>
                            </div>
                          </td>

                          <td style={{ padding: '0.85rem 1rem', color: 'var(--text-secondary)' }}>
                            {Math.round(c.yield_estimate_kg_ha).toLocaleString('en-IN')} kg/ha
                          </td>

                          <td style={{ padding: '0.85rem 1rem' }}>
                            <strong style={{ color: 'var(--color-primary)' }}>
                              ₹{Math.round(c.profit_estimate_inr).toLocaleString('en-IN')}
                            </strong>
                          </td>

                          <td style={{ padding: '0.85rem 1rem' }}>
                            <span style={{
                              fontSize: '0.72rem',
                              padding: '0.2rem 0.5rem',
                              borderRadius: '4px',
                              background: c.water_requirement === 'Low' ? 'rgba(34,197,94,0.15)' : c.water_requirement === 'High' ? 'rgba(239,68,68,0.15)' : 'rgba(234,179,8,0.15)',
                              color: c.water_requirement === 'Low' ? '#4ade80' : c.water_requirement === 'High' ? '#f87171' : '#facc15',
                              fontWeight: 600
                            }}>
                              {c.water_requirement}
                            </span>
                          </td>

                          <td style={{ padding: '0.85rem 1rem', color: 'var(--text-muted)' }}>
                            {c.duration_days} days
                          </td>

                          <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                            <span style={{ fontSize: '0.75rem', color: 'var(--color-primary)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
                              View <ArrowRight size={13} />
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Quick Actions Bar */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
              <Link
                to="/fertilizer"
                className="card"
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  borderRadius: '10px',
                  padding: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  textDecoration: 'none'
                }}
              >
                <FlaskConical size={20} style={{ color: 'var(--color-primary)' }} />
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-primary)' }}>Fertilizer Schedule</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>DAP, Urea, MOP calculation</div>
                </div>
              </Link>

              <Link
                to="/profitability"
                className="card"
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  borderRadius: '10px',
                  padding: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  textDecoration: 'none'
                }}
              >
                <DollarSign size={20} style={{ color: '#eab308' }} />
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-primary)' }}>P&L & ROI Modeler</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Detailed cost and break-even</div>
                </div>
              </Link>

              <Link
                to="/market"
                className="card"
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  borderRadius: '10px',
                  padding: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  textDecoration: 'none'
                }}
              >
                <TrendingUp size={20} style={{ color: '#38bdf8' }} />
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-primary)' }}>Mandi Trends</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Live Agmarknet prices</div>
                </div>
              </Link>
            </div>
          </div>

          {/* ── Right Column: Selected Crop Deep Dive ── */}
          {currentCrop && (
            <div className="card" style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-active)',
              borderRadius: '12px',
              padding: '1.25rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.2rem'
            }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.35rem' }}>
                  <span className="badge badge-green" style={{ fontSize: '0.75rem' }}>
                    Top Recommendation
                  </span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Outlook: <strong>{currentCrop.market_outlook}</strong>
                  </span>
                </div>
                <h3 style={{ fontSize: '1.4rem', fontWeight: 800, margin: '0 0 0.2rem 0' }}>
                  {currentCrop.crop}
                </h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', margin: 0 }}>
                  Detailed agronomic dossier for {season} season
                </p>
              </div>

              {/* Match Score Meter */}
              <div style={{
                background: 'rgba(34, 197, 94, 0.08)',
                border: '1px solid rgba(34, 197, 94, 0.2)',
                borderRadius: '10px',
                padding: '1rem',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>
                  Overall Suitability Confidence
                </div>
                <div style={{ fontSize: '2.2rem', fontWeight: 900, color: 'var(--color-primary)', margin: '0.2rem 0' }}>
                  {currentCrop.suitability_score}%
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Grounded in LightGBM agronomic recommendation model
                </div>
              </div>

              {/* Key Driver Highlights */}
              <div>
                <h4 style={{ fontSize: '0.88rem', fontWeight: 700, marginBottom: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <CheckCircle2 size={15} style={{ color: 'var(--color-primary)' }} />
                  Why AgriIQ Recommends {currentCrop.crop}
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                  {currentCrop.reasons.map((r: string, idx: number) => (
                    <div key={idx} style={{
                      display: 'flex',
                      alignItems: 'baseline',
                      gap: '0.5rem',
                      fontSize: '0.82rem',
                      color: 'var(--text-secondary)'
                    }}>
                      <span style={{ color: 'var(--color-primary)', fontWeight: 700 }}>✓</span>
                      <span>{r}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Risk Factors */}
              <div>
                <h4 style={{ fontSize: '0.88rem', fontWeight: 700, marginBottom: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#f87171' }}>
                  <ShieldAlert size={15} style={{ color: '#ef4444' }} />
                  Agronomic Risks to Mitigate
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                  {currentCrop.risks.map((risk: string, idx: number) => (
                    <div key={idx} style={{
                      display: 'flex',
                      alignItems: 'baseline',
                      gap: '0.5rem',
                      fontSize: '0.82rem',
                      color: 'var(--text-secondary)',
                      background: 'rgba(239, 68, 68, 0.06)',
                      padding: '0.4rem 0.6rem',
                      borderRadius: '6px'
                    }}>
                      <span style={{ color: '#ef4444' }}>⚠</span>
                      <span>{risk}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Direct Route Links */}
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <Link
                  to={`/fertilizer`}
                  className="btn btn-primary"
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', fontSize: '0.85rem', fontWeight: 600 }}
                >
                  <FlaskConical size={15} /> Calculate Fertilizer Dosage for {currentCrop.crop}
                </Link>
                <Link
                  to={`/profitability`}
                  className="btn btn-outline"
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', fontSize: '0.85rem' }}
                >
                  <TrendingUp size={15} /> Compute P&L Scenarios
                </Link>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="card" style={{ padding: '3rem 2rem', textAlign: 'center', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px' }}>
          <Sprout size={40} style={{ color: 'var(--text-muted)', margin: '0 auto 1rem auto' }} />
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)' }}>No recommendations yet</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            Please ensure you have created at least one field under Farm Map.
          </p>
          <Link to="/fields/new" className="btn btn-primary" style={{ marginTop: '1rem' }}>
            Create Farm Field
          </Link>
        </div>
      )}
    </div>
  )
}
