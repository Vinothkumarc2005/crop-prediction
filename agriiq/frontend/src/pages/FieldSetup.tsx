import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import FieldMapDrawer from '../components/FieldMapDrawer'
import { fieldsApi } from '../api/client'
import toast from 'react-hot-toast'
import { MapPin, Leaf, Save, ChevronRight } from 'lucide-react'
import { formatArea, calculatePolygonAreaHectares } from '../utils/geoUtils'

const NASHIK_CENTER: [number, number] = [20.0, 74.0]

const CROPS = ['Rice', 'Wheat', 'Maize', 'Soybean', 'Cotton', 'Groundnut', 'Sugarcane', 'Tur (Arhar)', 'Gram', 'None / Fallow']
const STATES = ['Maharashtra', 'Punjab', 'Andhra Pradesh', 'Uttar Pradesh', 'Madhya Pradesh', 'Rajasthan', 'Karnataka', 'Tamil Nadu', 'Gujarat', 'Haryana']

export default function FieldSetup() {
  const navigate = useNavigate()
  const [step, setStep] = useState<'info' | 'map' | 'review'>('info')
  const [loading, setLoading] = useState(false)
  const [drawnPolygon, setDrawnPolygon] = useState<number[][]>([])
  const [drawnAreaHa, setDrawnAreaHa] = useState<number>(0)
  const [form, setForm] = useState({
    name: '',
    district: '',
    state: 'Maharashtra',
    previousCrop: '',
    prevPrevCrop: '',
  })

  // Default polygon for Nashik demo field (if user doesn't draw)
  const demoPolygon = [
    [73.78, 19.99],
    [73.80, 19.99],
    [73.80, 20.01],
    [73.78, 20.01],
    [73.78, 19.99],
  ]


  const handleSubmit = async () => {
    if (!form.name || !form.district) {
      toast.error('Please fill in field name and district')
      return
    }
    const coords = drawnPolygon.length > 0 ? drawnPolygon : demoPolygon
    setLoading(true)
    try {
      const field = await fieldsApi.create({
        name: form.name,
        coordinates: coords,
        district: form.district,
        state: form.state,
        previousCrop: form.previousCrop || null,
        prevPrevCrop: form.prevPrevCrop || null,
      })
      toast.success('Field saved! Fetching NDVI and soil data…')
      navigate(`/dashboard/${field.id}`)
    } catch (err: any) {
      const detail = err.response?.data?.detail
      let msg = 'Failed to save field'
      if (typeof detail === 'string') msg = detail
      else if (Array.isArray(detail) && detail.length > 0) msg = detail.map((d: any) => d.msg).join(', ')
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container section-sm">
      <div className="page-header">
        <h1 className="page-title">Add New Field</h1>
        <p className="page-subtitle">Draw your field boundary on the map to get satellite NDVI and soil analysis</p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-3" style={{ marginBottom: '2rem' }}>
        {(['info', 'map', 'review'] as const).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              background: step === s ? 'var(--color-primary)' : s < step ? 'rgba(34,197,94,0.3)' : 'var(--bg-card)',
              border: `2px solid ${step === s ? 'var(--color-primary)' : 'var(--border)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.75rem', fontWeight: 700,
            }}>
              {i + 1}
            </div>
            <span style={{ fontSize: '0.85rem', color: step === s ? 'var(--text-primary)' : 'var(--text-muted)', fontWeight: step === s ? 600 : 400 }}>
              {s === 'info' ? 'Field Info' : s === 'map' ? 'Draw Field' : 'Review'}
            </span>
            {i < 2 && <ChevronRight size={14} style={{ color: 'var(--text-dim)' }} />}
          </div>
        ))}
      </div>

      <div style={{ maxWidth: step === 'map' ? '1060px' : '760px', transition: 'max-width 0.3s ease', width: '100%' }}>
        {/* Step 1: Info */}
        {step === 'info' && (
          <div className="card fade-in">
            <h3 style={{ marginBottom: '1.25rem' }}>Field Information</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group">
                <label className="label">Field Name *</label>
                <input className="input" placeholder="e.g. North Farm — Block A"
                  value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div className="grid-2" style={{ gap: '1rem' }}>
                <div className="form-group">
                  <label className="label">State *</label>
                  <select className="select" value={form.state} onChange={e => setForm({ ...form, state: e.target.value })}>
                    {STATES.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="label">District *</label>
                  <input className="input" placeholder="e.g. Nashik"
                    value={form.district} onChange={e => setForm({ ...form, district: e.target.value })} required />
                </div>
              </div>
              <div className="grid-2" style={{ gap: '1rem' }}>
                <div className="form-group">
                  <label className="label">Previous Crop (last season)</label>
                  <select className="select" value={form.previousCrop} onChange={e => setForm({ ...form, previousCrop: e.target.value })}>
                    <option value="">— Unknown —</option>
                    {CROPS.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="label">Crop 2 seasons ago</label>
                  <select className="select" value={form.prevPrevCrop} onChange={e => setForm({ ...form, prevPrevCrop: e.target.value })}>
                    <option value="">— Unknown —</option>
                    {CROPS.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ padding: '0.75rem', background: 'rgba(34,197,94,0.05)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                <Leaf size={13} style={{ display: 'inline', marginRight: '0.25rem', color: 'var(--color-primary)' }} />
                Crop rotation history helps AgriIQ factor in soil nutrient depletion and recommend complementary crops.
              </div>
              <button className="btn btn-primary" onClick={() => { if (!form.name || !form.district) { toast.error('Name and district are required'); return } setStep('map') }}>
                Next: Draw Field <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Map */}
        {step === 'map' && (
          <div className="fade-in">
            <div className="card" style={{ marginBottom: '1rem' }}>
              <div className="flex items-center gap-2" style={{ marginBottom: '0.5rem' }}>
                <MapPin size={16} style={{ color: 'var(--color-primary)' }} />
                <strong>Define Field Boundary</strong>
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Mark points to place draggable pins with <strong>curved or straight edges</strong>, or choose <strong>Draw Manually</strong> to trace your field freely with your mouse/touch.
              </p>
            </div>

            <FieldMapDrawer
              initialCenter={NASHIK_CENTER}
              onPolygonChange={(coords) => {
                setDrawnPolygon(coords)
              }}
              onAreaChange={(ha) => {
                setDrawnAreaHa(ha)
              }}
            />

            <div className="flex items-center justify-between" style={{ marginTop: '1.25rem' }}>
              <div className="flex items-center gap-3">
                <button className="btn btn-ghost" onClick={() => setStep('info')}>← Back</button>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => {
                    setDrawnPolygon(demoPolygon)
                    const demoHa = calculatePolygonAreaHectares(demoPolygon as [number, number][])
                    setDrawnAreaHa(demoHa)
                    toast('Using demo field boundary (Nashik)')
                    setStep('review')
                  }}
                >
                  Use Demo Field
                </button>
              </div>

              <button
                className="btn btn-primary"
                disabled={drawnPolygon.length < 3}
                onClick={() => setStep('review')}
              >
                Next: Review & Save <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Review */}
        {step === 'review' && (
          <div className="card fade-in">
            <h3 style={{ marginBottom: '1.25rem' }}>Review & Save</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem', marginBottom: '1.5rem' }}>
              {[
                ['Field Name', form.name],
                ['Location', `${form.district}, ${form.state}`],
                ['Previous Crop', form.previousCrop || 'Unknown'],
                ['Crop 2 seasons ago', form.prevPrevCrop || 'Unknown'],
                ['Boundary Vertices', `${drawnPolygon.length || demoPolygon.length} coordinates`],
                ['Estimated Field Area', formatArea(drawnAreaHa || calculatePolygonAreaHectares(demoPolygon as [number, number][]))],
              ].map(([k, v]) => (
                <div key={k as string} className="flex justify-between" style={{ borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>{k}</span>
                  <span style={{ fontWeight: 600, fontSize: '0.88rem' }}>{v}</span>
                </div>
              ))}
            </div>
            <div style={{ padding: '0.75rem', background: 'rgba(34,197,94,0.05)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
              After saving, AgriIQ will automatically fetch <strong>NDVI satellite data</strong> and <strong>SoilGrids soil profile</strong> for this field.
            </div>
            <div className="flex gap-3">
              <button className="btn btn-ghost" onClick={() => setStep('map')}>← Back</button>
              <button className="btn btn-primary" disabled={loading} onClick={handleSubmit} style={{ flex: 1 }}>
                {loading ? <><span className="spinner" style={{ width: 18, height: 18 }} /> Saving…</> : <><Save size={16} /> Save Field & Get Recommendations</>}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

