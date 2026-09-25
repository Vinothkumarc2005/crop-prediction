import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fieldsApi, fertilizerApi } from '../api/client'
import {
  FlaskConical,
  Sprout,
  CheckCircle2,
  AlertTriangle,
  Info,
  Calendar,
  Layers,
  ChevronRight,
  TrendingUp,
  FileText,
  MapPin,
  Sparkles
} from 'lucide-react'
import toast from 'react-hot-toast'
import { Link } from 'react-router-dom'

export default function FertilizerAdvisor() {
  const [selectedFieldId, setSelectedFieldId] = useState<string>('')
  const [crop, setCrop] = useState<string>('Rice')
  const [areaAcres, setAreaAcres] = useState<number>(2.5)
  const [soilN, setSoilN] = useState<number | ''>('')
  const [soilP, setSoilP] = useState<number | ''>('')
  const [soilK, setSoilK] = useState<number | ''>('')
  const [soilPh, setSoilPh] = useState<number | ''>('')
  const [growthStage, setGrowthStage] = useState<string>('Sowing')
  const [loading, setLoading] = useState<boolean>(false)
  const [result, setResult] = useState<any>(null)

  // Fetch registered fields
  const { data: fields = [] } = useQuery({
    queryKey: ['fields'],
    queryFn: fieldsApi.list,
  })

  // Fetch supported crops
  const { data: availableCrops = [] } = useQuery({
    queryKey: ['fertilizer-crops'],
    queryFn: fertilizerApi.crops,
  })

  // Auto-populate from selected field
  useEffect(() => {
    if (fields.length > 0 && !selectedFieldId) {
      setSelectedFieldId(fields[0].id)
    }
  }, [fields, selectedFieldId])

  const selectedField = fields.find((f: any) => f.id === selectedFieldId)

  // When field changes, fetch its soil and set acres
  useEffect(() => {
    if (!selectedFieldId) return
    const f = fields.find((f: any) => f.id === selectedFieldId)
    if (f && f.area_hectares) {
      setAreaAcres(Math.round(f.area_hectares * 2.471 * 10) / 10)
    }
    fieldsApi.soil(selectedFieldId).then(soil => {
      if (soil) {
        if (soil.n_value !== undefined) setSoilN(Math.round(soil.n_value))
        if (soil.p_value !== undefined) setSoilP(Math.round(soil.p_value))
        if (soil.k_value !== undefined) setSoilK(Math.round(soil.k_value))
        if (soil.ph_value !== undefined) setSoilPh(soil.ph_value)
      }
    }).catch(() => {})
  }, [selectedFieldId, fields])

  const handleCalculate = async () => {
    if (!crop || !areaAcres || areaAcres <= 0) {
      toast.error('Please specify a crop and valid farm area')
      return
    }
    setLoading(true)
    try {
      const data = await fertilizerApi.recommend({
        crop,
        area_acres: Number(areaAcres),
        soil_n: soilN !== '' ? Number(soilN) : null,
        soil_p: soilP !== '' ? Number(soilP) : null,
        soil_k: soilK !== '' ? Number(soilK) : null,
        soil_ph: soilPh !== '' ? Number(soilPh) : null,
        growth_stage: growthStage,
      })
      setResult(data)
      toast.success(`Nutrient plan generated for ${crop}!`)
    } catch (err) {
      toast.error('Failed to compute fertilizer recommendation')
    } finally {
      setLoading(false)
    }
  }

  // Calculate automatically on initial mount once crops are ready
  useEffect(() => {
    if (availableCrops.length > 0 && !result) {
      handleCalculate()
    }
  }, [availableCrops])

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
            <FlaskConical size={22} />
          </span>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0 }}>
            Precision Fertilizer & Nutrient Advisor
          </h1>
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', margin: 0 }}>
          ICAR-grounded crop nutrient plans customized to your field soil profile, growth stage, and acreage.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 360px) 1fr', gap: '1.5rem', alignItems: 'start' }}>
        {/* ── Left Column: Configuration Controls ── */}
        <div className="card" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '1.25rem' }}>
          <h2 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Layers size={17} style={{ color: 'var(--color-primary)' }} />
            Field & Crop Parameters
          </h2>

          {/* Field selection */}
          {fields.length > 0 && (
            <div className="form-group" style={{ marginBottom: '1rem' }}>
              <label className="label" style={{ fontSize: '0.82rem', fontWeight: 600 }}>Select Saved Field</label>
              <select
                className="select"
                value={selectedFieldId}
                onChange={e => setSelectedFieldId(e.target.value)}
                style={{ width: '100%', background: 'var(--bg-base)', fontSize: '0.88rem' }}
              >
                {fields.map((f: any) => (
                  <option key={f.id} value={f.id}>
                    {f.name} ({f.district}, {f.state} — {(f.area_hectares * 2.471).toFixed(1)} ac)
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Crop Dropdown */}
          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <label className="label" style={{ fontSize: '0.82rem', fontWeight: 600 }}>Target Crop *</label>
            <select
              className="select"
              value={crop}
              onChange={e => setCrop(e.target.value)}
              style={{ width: '100%', background: 'var(--bg-base)', fontSize: '0.88rem' }}
            >
              {(availableCrops.length > 0 ? availableCrops : ['Rice', 'Wheat', 'Maize', 'Soybean', 'Cotton', 'Sugarcane', 'Tomato', 'Onion', 'Potato', 'Groundnut', 'Millets']).map((c: string) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Acreage */}
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

          {/* Growth Stage */}
          <div className="form-group" style={{ marginBottom: '1.25rem' }}>
            <label className="label" style={{ fontSize: '0.82rem', fontWeight: 600 }}>Current Growth Stage</label>
            <select
              className="select"
              value={growthStage}
              onChange={e => setGrowthStage(e.target.value)}
              style={{ width: '100%', background: 'var(--bg-base)', fontSize: '0.88rem' }}
            >
              <option value="Sowing">Sowing / Land Preparation (Basal)</option>
              <option value="Vegetative">Vegetative / Tillering</option>
              <option value="Flowering">Flowering / Heading</option>
              <option value="Grain fill">Pod / Grain / Fruit Fill</option>
            </select>
          </div>

          {/* Soil Test Overrides */}
          <div style={{
            background: 'rgba(0,0,0,0.18)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            padding: '0.9rem',
            marginBottom: '1.25rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                Soil Test Values (kg/ha)
              </span>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Optional</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Soil N (kg/ha)</label>
                <input
                  type="number"
                  placeholder="e.g. 180"
                  className="input"
                  style={{ width: '100%', padding: '0.35rem 0.6rem', fontSize: '0.82rem', background: 'var(--bg-base)' }}
                  value={soilN}
                  onChange={e => setSoilN(e.target.value ? Number(e.target.value) : '')}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Soil P (kg/ha)</label>
                <input
                  type="number"
                  placeholder="e.g. 25"
                  className="input"
                  style={{ width: '100%', padding: '0.35rem 0.6rem', fontSize: '0.82rem', background: 'var(--bg-base)' }}
                  value={soilP}
                  onChange={e => setSoilP(e.target.value ? Number(e.target.value) : '')}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Soil K (kg/ha)</label>
                <input
                  type="number"
                  placeholder="e.g. 150"
                  className="input"
                  style={{ width: '100%', padding: '0.35rem 0.6rem', fontSize: '0.82rem', background: 'var(--bg-base)' }}
                  value={soilK}
                  onChange={e => setSoilK(e.target.value ? Number(e.target.value) : '')}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Soil pH</label>
                <input
                  type="number"
                  step="0.1"
                  placeholder="e.g. 6.8"
                  className="input"
                  style={{ width: '100%', padding: '0.35rem 0.6rem', fontSize: '0.82rem', background: 'var(--bg-base)' }}
                  value={soilPh}
                  onChange={e => setSoilPh(e.target.value ? Number(e.target.value) : '')}
                />
              </div>
            </div>
          </div>

          <button
            className="btn btn-primary"
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontWeight: 700 }}
            onClick={handleCalculate}
            disabled={loading}
          >
            {loading ? <span className="spinner" style={{ width: 18, height: 18 }} /> : <Sparkles size={16} />}
            Generate Nutrient Plan
          </button>
        </div>

        {/* ── Right Column: Nutrient Plan Output ── */}
        <div>
          {result ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Top Banner: Crop & Total Requirements */}
              <div className="card" style={{
                background: 'linear-gradient(135deg, rgba(22, 101, 52, 0.25) 0%, rgba(10, 15, 13, 0.8) 100%)',
                border: '1px solid rgba(34, 197, 94, 0.3)',
                borderRadius: '12px',
                padding: '1.25rem'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.2rem' }}>
                  <div>
                    <span className="badge badge-green" style={{ marginBottom: '0.4rem', fontSize: '0.75rem' }}>
                      ICAR Standard Schedule
                    </span>
                    <h3 style={{ fontSize: '1.35rem', fontWeight: 800, margin: '0 0 0.25rem 0' }}>
                      {result.crop} Nutrient Dosage Plan
                    </h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: 0 }}>
                      Calculated for <strong>{result.area_acres} acres</strong> ({result.area_ha} hectares)
                    </p>
                  </div>

                  <Link
                    to="/profitability"
                    className="btn btn-sm btn-outline"
                    style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem' }}
                  >
                    <TrendingUp size={14} /> Calculate Profit with Fertilizers
                  </Link>
                </div>

                {/* N-P-K Metric Badges */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem' }}>
                  <div style={{ background: 'var(--bg-card)', padding: '0.85rem', borderRadius: '10px', border: '1px solid var(--border)', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.75rem', color: '#60a5fa', fontWeight: 700, textTransform: 'uppercase' }}>Nitrogen (N)</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#93c5fd', margin: '0.2rem 0' }}>
                      {Math.round(result.n_requirement_kg_ha * result.area_ha)} <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>kg</span>
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{result.n_requirement_kg_ha} kg/ha</div>
                  </div>

                  <div style={{ background: 'var(--bg-card)', padding: '0.85rem', borderRadius: '10px', border: '1px solid var(--border)', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.75rem', color: '#f59e0b', fontWeight: 700, textTransform: 'uppercase' }}>Phosphorus (P₂O₅)</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#fcd34d', margin: '0.2rem 0' }}>
                      {Math.round(result.p_requirement_kg_ha * result.area_ha)} <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>kg</span>
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{result.p_requirement_kg_ha} kg/ha</div>
                  </div>

                  <div style={{ background: 'var(--bg-card)', padding: '0.85rem', borderRadius: '10px', border: '1px solid var(--border)', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.75rem', color: '#a855f7', fontWeight: 700, textTransform: 'uppercase' }}>Potassium (K₂O)</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#d8b4fe', margin: '0.2rem 0' }}>
                      {Math.round(result.k_requirement_kg_ha * result.area_ha)} <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>kg</span>
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{result.k_requirement_kg_ha} kg/ha</div>
                  </div>
                </div>
              </div>

              {/* Commercial Fertilizer Bags Requirement */}
              <div className="card" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '1.25rem' }}>
                <h4 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <CheckCircle2 size={17} style={{ color: 'var(--color-primary)' }} />
                  Commercial Fertilizer Procurement (Estimated Bags)
                </h4>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                  {result.recommended_products?.map((p: any, idx: number) => {
                    const totalKg = Math.round(p.quantity_kg_per_acre * result.area_acres)
                    const bags50kg = (totalKg / 50).toFixed(1)
                    return (
                      <div key={idx} style={{
                        background: 'rgba(0,0,0,0.22)',
                        border: '1px solid var(--border)',
                        borderRadius: '10px',
                        padding: '1rem',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between'
                      }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                            {p.product}
                          </div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                            {p.purpose}
                          </div>
                        </div>

                        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '0.75rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.2rem' }}>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Per Acre:</span>
                            <strong style={{ fontSize: '0.92rem' }}>{p.quantity_kg_per_acre} kg</strong>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.5rem' }}>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total Farm ({result.area_acres} ac):</span>
                            <strong style={{ fontSize: '1.05rem', color: 'var(--color-primary)' }}>
                              {totalKg} kg (~{bags50kg} bags of 50kg)
                            </strong>
                          </div>
                          <div style={{ fontSize: '0.72rem', color: '#eab308', background: 'rgba(234,179,8,0.08)', padding: '0.35rem 0.5rem', borderRadius: '4px' }}>
                            ⏱ {p.timing}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Growth Stage Schedule & Micronutrients */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
                {/* Growth stages split */}
                <div className="card" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '1.15rem' }}>
                  <h4 style={{ fontSize: '0.92rem', fontWeight: 700, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Calendar size={15} style={{ color: 'var(--color-primary)' }} />
                    Crop Growth Stages
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {result.growth_stages?.map((stage: string, idx: number) => {
                      const isCurrent = stage.toLowerCase().includes(growthStage.toLowerCase())
                      return (
                        <div key={idx} style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.6rem',
                          padding: '0.5rem 0.75rem',
                          borderRadius: '6px',
                          background: isCurrent ? 'rgba(34, 197, 94, 0.12)' : 'rgba(0,0,0,0.15)',
                          border: isCurrent ? '1px solid var(--color-primary)' : '1px solid transparent',
                          fontSize: '0.82rem'
                        }}>
                          <span style={{
                            width: '20px',
                            height: '20px',
                            borderRadius: '50%',
                            background: isCurrent ? 'var(--color-primary)' : 'rgba(255,255,255,0.1)',
                            color: isCurrent ? '#000' : 'var(--text-secondary)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 700,
                            fontSize: '0.72rem',
                            flexShrink: 0
                          }}>
                            {idx + 1}
                          </span>
                          <span style={{ fontWeight: isCurrent ? 700 : 400, color: isCurrent ? 'var(--color-primary)' : 'var(--text-primary)' }}>
                            {stage}
                          </span>
                          {isCurrent && (
                            <span className="badge badge-green" style={{ marginLeft: 'auto', fontSize: '0.68rem', padding: '0.1rem 0.4rem' }}>
                              Current
                            </span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Micronutrients & Advisory notes */}
                <div className="card" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '1.15rem' }}>
                  <h4 style={{ fontSize: '0.92rem', fontWeight: 700, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Info size={15} style={{ color: '#38bdf8' }} />
                    Special Nutrients & ICAR Advisory
                  </h4>

                  {result.micronutrients && result.micronutrients.length > 0 && (
                    <div style={{ marginBottom: '0.85rem' }}>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Micronutrients Recommended:</span>
                      <ul style={{ margin: '0.35rem 0 0 1.1rem', padding: 0, fontSize: '0.82rem', color: 'var(--text-primary)' }}>
                        {result.micronutrients.map((m: string, idx: number) => (
                          <li key={idx} style={{ marginBottom: '0.25rem' }}>{m}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {result.notes && (
                    <div style={{
                      padding: '0.75rem',
                      background: 'rgba(56, 189, 248, 0.08)',
                      border: '1px solid rgba(56, 189, 248, 0.2)',
                      borderRadius: '8px',
                      fontSize: '0.82rem',
                      color: 'var(--text-secondary)',
                      lineHeight: 1.4,
                      marginBottom: '0.75rem'
                    }}>
                      💡 <strong>Note:</strong> {result.notes}
                    </div>
                  )}

                  {result.soil_test_recommended && (
                    <div style={{
                      padding: '0.65rem',
                      background: 'rgba(234, 179, 8, 0.08)',
                      border: '1px solid rgba(234, 179, 8, 0.2)',
                      borderRadius: '8px',
                      fontSize: '0.78rem',
                      color: '#fbbf24',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem'
                    }}>
                      <AlertTriangle size={15} style={{ flexShrink: 0 }} />
                      Conducting a field soil test will help calibrate exact micro-dosages and save up to 25% on fertilizer expenses.
                    </div>
                  )}
                </div>
              </div>

              {/* Data source footer */}
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'right' }}>
                Source: {result.data_source} | Updated guidelines
              </div>
            </div>
          ) : (
            <div className="card" style={{ padding: '3rem 2rem', textAlign: 'center', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px' }}>
              <FlaskConical size={40} style={{ color: 'var(--text-muted)', margin: '0 auto 1rem auto' }} />
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)' }}>Select crop parameters</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                Click "Generate Nutrient Plan" to view commercial fertilizer requirements and dosage timing.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
