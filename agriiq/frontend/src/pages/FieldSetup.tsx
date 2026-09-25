import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import FieldMapDrawer from '../components/FieldMapDrawer'
import { fieldsApi, locationApi } from '../api/client'
import toast from 'react-hot-toast'
import { MapPin, Leaf, Save, ChevronRight, Loader2, Navigation } from 'lucide-react'
import { formatArea, calculatePolygonAreaHectares } from '../utils/geoUtils'
import { useQuery } from '@tanstack/react-query'

const CROPS = ['Rice', 'Wheat', 'Maize', 'Soybean', 'Cotton', 'Groundnut', 'Sugarcane', 'Tur (Arhar)', 'Gram', 'None / Fallow']

const DEFAULT_CENTER: [number, number] = [20.5937, 78.9629] // India center

export default function FieldSetup() {
  const navigate = useNavigate()
  const [step, setStep]                   = useState<'info' | 'map' | 'review'>('info')
  const [loading, setLoading]             = useState(false)
  const [geocoding, setGeocoding]         = useState(false)
  const [mapCenter, setMapCenter]         = useState<[number, number]>(DEFAULT_CENTER)
  const [mapZoom, setMapZoom]             = useState(5)
  const [drawnPolygon, setDrawnPolygon]   = useState<number[][]>([])
  const [drawnAreaHa, setDrawnAreaHa]     = useState<number>(0)

  const [form, setForm] = useState({
    name: '',
    state: '',
    city: '',
    previousCrop: '',
    prevPrevCrop: '',
  })

  // ── Load states from backend ───────────────────────────────────────────────
  const { data: states = [] } = useQuery<string[]>({
    queryKey: ['location-states'],
    queryFn: locationApi.states,
    staleTime: Infinity,
  })

  // ── Load cities for selected state ────────────────────────────────────────
  const { data: cities = [] } = useQuery<string[]>({
    queryKey: ['location-cities', form.state],
    queryFn: () => locationApi.cities(form.state),
    enabled: !!form.state,
    staleTime: Infinity,
  })

  // Reset city when state changes
  useEffect(() => {
    setForm(f => ({ ...f, city: '' }))
  }, [form.state])

  // Default first state when states load
  useEffect(() => {
    if (states.length > 0 && !form.state) {
      setForm(f => ({ ...f, state: states[0] }))
    }
  }, [states])

  // ── Geocode and fly to city ────────────────────────────────────────────────
  const geocodeAndFly = useCallback(async (city: string, state: string) => {
    if (!city || !state) return
    setGeocoding(true)
    try {
      const result = await locationApi.geocode(city, state)
      setMapCenter([result.lat, result.lng])
      setMapZoom(12)
      toast.success(`Map moved to ${city}`)
    } catch {
      toast.error(`Could not find ${city} — try another city or draw manually`)
    } finally {
      setGeocoding(false)
    }
  }, [])

  // Auto-geocode when city is selected
  useEffect(() => {
    if (form.city && form.state) {
      geocodeAndFly(form.city, form.state)
    }
  }, [form.city])

  // ── Demo polygon for review shortcut ──────────────────────────────────────
  const demoPolygon = [
    [73.78, 19.99], [73.80, 19.99],
    [73.80, 20.01], [73.78, 20.01], [73.78, 19.99],
  ]

  const handleSubmit = async () => {
    if (!form.name || !form.city) {
      toast.error('Please fill in field name and select a city')
      return
    }
    const coords = drawnPolygon.length > 0 ? drawnPolygon : demoPolygon
    setLoading(true)
    try {
      const field = await fieldsApi.create({
        name: form.name,
        coordinates: coords,
        district: form.city,
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
        <p className="page-subtitle">Select your location, draw your field boundary, and get satellite NDVI analysis</p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-3" style={{ marginBottom: '2rem', flexWrap: 'wrap' }}>
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
              {s === 'info' ? 'Farm Info' : s === 'map' ? 'Draw on Map' : 'Review & Save'}
            </span>
            {i < 2 && <ChevronRight size={14} style={{ color: 'var(--text-dim)' }} />}
          </div>
        ))}
      </div>

      <div style={{ maxWidth: step === 'map' ? '1100px' : '760px', transition: 'max-width 0.3s ease', width: '100%' }}>

        {/* ── Step 1: Info ── */}
        {step === 'info' && (
          <div className="card fade-in">
            <h3 style={{ marginBottom: '1.5rem' }}>Farm Information</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

              {/* Field name */}
              <div className="form-group">
                <label className="label">Farm Name *</label>
                <input
                  className="input"
                  placeholder="e.g. North Block — Rice Field A"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>

              {/* State + City */}
              <div className="grid-2" style={{ gap: '1rem' }}>
                <div className="form-group">
                  <label className="label">State *</label>
                  <select
                    className="select"
                    value={form.state}
                    onChange={e => setForm({ ...form, state: e.target.value })}
                  >
                    <option value="">— Select State —</option>
                    {states.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="label">City / District *</label>
                  <div style={{ position: 'relative' }}>
                    <select
                      className="select"
                      value={form.city}
                      disabled={!form.state || cities.length === 0}
                      onChange={e => setForm({ ...form, city: e.target.value })}
                      style={{ paddingRight: geocoding ? '2.5rem' : undefined }}
                    >
                      <option value="">— Select City —</option>
                      {cities.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    {geocoding && (
                      <Loader2
                        size={16}
                        style={{
                          position: 'absolute', right: '0.7rem', top: '50%',
                          transform: 'translateY(-50%)',
                          color: 'var(--color-primary)', animation: 'spin 1s linear infinite',
                        }}
                      />
                    )}
                  </div>
                </div>
              </div>

              {/* Geocode status */}
              {form.city && form.state && !geocoding && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                  padding: '0.6rem 0.9rem', borderRadius: 'var(--radius)',
                  background: 'rgba(34,197,94,0.07)', border: '1px solid rgba(34,197,94,0.2)',
                  fontSize: '0.82rem', color: 'var(--text-secondary)',
                }}>
                  <Navigation size={13} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
                  Map will automatically fly to <strong>{form.city}, {form.state}</strong> in the next step.
                </div>
              )}

              {/* Crop rotation */}
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

              <button
                className="btn btn-primary"
                onClick={() => {
                  if (!form.name || !form.city || !form.state) {
                    toast.error('Farm name, state, and city are required')
                    return
                  }
                  setStep('map')
                }}
              >
                Next: Draw Field on Map <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* ── Step 2: Map ── */}
        {step === 'map' && (
          <div className="fade-in">
            <div className="card" style={{ marginBottom: '1rem' }}>
              <div className="flex items-center gap-2" style={{ marginBottom: '0.5rem' }}>
                <MapPin size={16} style={{ color: 'var(--color-primary)' }} />
                <strong>
                  {form.city ? `Drawing on map — ${form.city}, ${form.state}` : 'Define Field Boundary'}
                </strong>
                {geocoding && <Loader2 size={14} style={{ color: 'var(--color-primary)', animation: 'spin 1s linear infinite' }} />}
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                The map has flown to your selected location. Use <strong>Draw Farm</strong> to trace your field boundary.
                You can use point-by-point or freehand drawing modes.
              </p>
            </div>

            <FieldMapDrawer
              initialCenter={mapCenter}
              initialZoom={mapZoom}
              onPolygonChange={(coords) => setDrawnPolygon(coords)}
              onAreaChange={(ha) => setDrawnAreaHa(ha)}
            />

            <div className="flex items-center justify-between" style={{ marginTop: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div className="flex items-center gap-3">
                <button className="btn btn-ghost" onClick={() => setStep('info')}>← Back</button>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => {
                    setDrawnPolygon(demoPolygon)
                    const demoHa = calculatePolygonAreaHectares(demoPolygon as [number, number][])
                    setDrawnAreaHa(demoHa)
                    toast('Using demo field boundary')
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

        {/* ── Step 3: Review ── */}
        {step === 'review' && (
          <div className="card fade-in">
            <h3 style={{ marginBottom: '1.25rem' }}>Review & Save</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem', marginBottom: '1.5rem' }}>
              {[
                ['Farm Name',          form.name],
                ['Location',           `${form.city}, ${form.state}`],
                ['Previous Crop',      form.previousCrop || 'Unknown'],
                ['Crop 2 seasons ago', form.prevPrevCrop || 'Unknown'],
                ['Boundary Vertices',  `${drawnPolygon.length || demoPolygon.length} coordinates`],
                ['Estimated Area',     formatArea(drawnAreaHa || calculatePolygonAreaHectares(demoPolygon as [number, number][]))],
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
                {loading
                  ? <><span className="spinner" style={{ width: 18, height: 18 }} /> Saving…</>
                  : <><Save size={16} /> Save Field & Get Analysis</>}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
