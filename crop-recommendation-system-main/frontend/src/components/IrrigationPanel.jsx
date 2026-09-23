import { useState, useMemo } from 'react'

// ── Crop irrigation data ───────────────────────────────────────────────────────
const CROP_IRRIGATION = {
  rice:       { season: 'Kharif', waterReq: 1200, growDays: 120, stages: ['Transplanting (20d)', 'Tillering (30d)', 'Panicle (20d)', 'Ripening (50d)'] },
  wheat:      { season: 'Rabi',   waterReq: 450,  growDays: 130, stages: ['Germination (20d)', 'Tillering (40d)', 'Jointing (30d)', 'Grain fill (40d)'] },
  maize:      { season: 'Kharif', waterReq: 500,  growDays: 100, stages: ['Seedling (15d)', 'V-stage (35d)', 'Tasseling (20d)', 'Maturity (30d)'] },
  cotton:     { season: 'Kharif', waterReq: 700,  growDays: 180, stages: ['Seedling (20d)', 'Squaring (40d)', 'Boll set (50d)', 'Boll open (70d)'] },
  sugarcane:  { season: 'Annual', waterReq: 1500, growDays: 365, stages: ['Germination (30d)', 'Grand growth (150d)', 'Maturation (120d)', 'Ripening (65d)'] },
  groundnut:  { season: 'Kharif', waterReq: 400,  growDays: 110, stages: ['Germination (15d)', 'Vegetative (30d)', 'Pegging (25d)', 'Pod fill (40d)'] },
  soybean:    { season: 'Kharif', waterReq: 450,  growDays: 100, stages: ['Seedling (15d)', 'Vegetative (35d)', 'Flowering (20d)', 'Pod fill (30d)'] },
  pulses:     { season: 'Rabi',   waterReq: 300,  growDays: 90,  stages: ['Germination (10d)', 'Vegetative (30d)', 'Flowering (20d)', 'Pod fill (30d)'] },
  muskmelon:  { season: 'Zaid',   waterReq: 350,  growDays: 80,  stages: ['Germination (10d)', 'Vine (25d)', 'Flowering (15d)', 'Fruit set (30d)'] },
  watermelon: { season: 'Zaid',   waterReq: 400,  growDays: 85,  stages: ['Germination (10d)', 'Vine (30d)', 'Flowering (15d)', 'Fruit set (30d)'] },
  grapes:     { season: 'Annual', waterReq: 800,  growDays: 200, stages: ['Budbreak (20d)', 'Shoot (60d)', 'Berry set (40d)', 'Veraison (80d)'] },
}

const SEASON_COLORS = {
  Kharif: { bg: 'rgba(74,222,128,0.12)', border: 'rgba(74,222,128,0.4)', text: '#4ade80' },
  Rabi:   { bg: 'rgba(96,165,250,0.12)', border: 'rgba(96,165,250,0.4)', text: '#60a5fa' },
  Annual: { bg: 'rgba(251,191,36,0.12)', border: 'rgba(251,191,36,0.4)', text: '#fbbf24' },
  Zaid:   { bg: 'rgba(167,139,250,0.12)', border: 'rgba(167,139,250,0.4)', text: '#a78bfa' },
}

// Drip vs Flood vs Sprinkler efficiency
const METHOD_EFFICIENCY = {
  drip: { name: 'Drip', savings: 0.45, icon: '💧', desc: 'High efficiency · Root zone delivery' },
  sprinkler: { name: 'Sprinkler', savings: 0.25, icon: '🌧️', desc: 'Medium efficiency · Uniform coverage' },
  flood: { name: 'Flood', savings: 0, icon: '🌊', desc: 'Traditional · High water use' },
}

function IrrigationBar({ label, value, max, color, unit }) {
  const pct = Math.min((value / max) * 100, 100)
  return (
    <div className="irr-bar-row">
      <div className="irr-bar-label">{label}</div>
      <div className="irr-bar-track">
        <div
          className="irr-bar-fill"
          style={{ width: `${pct}%`, background: color }}
          title={`${value} ${unit}`}
        />
      </div>
      <div className="irr-bar-val" style={{ color }}>{value} {unit}</div>
    </div>
  )
}

export default function IrrigationPanel({ result, landAreaAcres = 2.5 }) {
  const [selectedCrop, setSelectedCrop] = useState(null)
  const [method, setMethod] = useState('drip')
  const [annualRain, setAnnualRain] = useState(800) // mm

  const cropName = useMemo(() => {
    if (!result?.crop) return null
    const k = result.crop.toLowerCase()
    return Object.keys(CROP_IRRIGATION).find(c => k.includes(c)) || null
  }, [result])

  const activeCrop = selectedCrop || cropName
  const cropData   = CROP_IRRIGATION[activeCrop]
  const methodData = METHOD_EFFICIENCY[method]

  const schedule = useMemo(() => {
    if (!cropData) return null
    const hectares     = landAreaAcres * 0.404686
    const grossWater   = cropData.waterReq                              // mm
    const rainCover    = Math.min(annualRain * (cropData.growDays / 365), grossWater * 0.6)
    const netRequired  = Math.max(grossWater - rainCover, 0)
    const afterMethod  = netRequired * (1 - methodData.savings)
    const totalM3      = (afterMethod / 1000) * hectares * 10000        // m³
    const totalLitres  = totalM3 * 1000
    const dailyLitres  = totalLitres / cropData.growDays
    const irrigEvents  = Math.ceil(cropData.growDays / 7)
    const perEventL    = (totalLitres / irrigEvents).toFixed(0)
    const waterCostINR = totalM3 * 8                                    // ~₹8/m³ average
    const laborSaved   = method === 'drip' ? 0.6 : method === 'sprinkler' ? 0.3 : 0
    return {
      grossWater, rainCover: Math.round(rainCover), netRequired: Math.round(netRequired),
      afterMethod: Math.round(afterMethod), totalM3: Math.round(totalM3),
      totalLitres: Math.round(totalLitres), dailyLitres: Math.round(dailyLitres),
      irrigEvents, perEventL, waterCostINR: Math.round(waterCostINR), laborSaved,
      hectares: hectares.toFixed(2),
    }
  }, [cropData, landAreaAcres, annualRain, methodData])

  return (
    <div className="glass-card irr-panel">
      <div className="card-header">
        <span className="card-icon">💦</span>
        <div>
          <div className="card-title">Smart Irrigation Planner</div>
          <div className="card-subtitle">Water scheduling & method optimizer for your field</div>
        </div>
      </div>

      {/* ── Crop Selector ── */}
      <div className="irr-crop-selector">
        <div className="irr-section-label">Select Crop</div>
        <div className="irr-crop-chips">
          {Object.entries(CROP_IRRIGATION).map(([key, data]) => {
            const sc = SEASON_COLORS[data.season]
            const isActive = activeCrop === key
            return (
              <button
                key={key}
                className={`irr-crop-chip ${isActive ? 'active' : ''}`}
                style={isActive ? { background: sc.bg, borderColor: sc.border, color: sc.text } : {}}
                onClick={() => setSelectedCrop(key)}
              >
                {key}
                {cropName === key && <span className="irr-ai-dot" title="AI recommended" />}
              </button>
            )
          })}
        </div>
      </div>

      {cropData && (
        <>
          {/* ── Crop Info Strip ── */}
          <div className="irr-info-strip">
            <div className="irr-info-item">
              <span className="irr-info-lbl">Season</span>
              <span className="irr-info-val" style={{ color: SEASON_COLORS[cropData.season].text }}>
                {cropData.season}
              </span>
            </div>
            <div className="irr-info-item">
              <span className="irr-info-lbl">Growth Period</span>
              <span className="irr-info-val">{cropData.growDays} days</span>
            </div>
            <div className="irr-info-item">
              <span className="irr-info-lbl">Total Water Req</span>
              <span className="irr-info-val">{cropData.waterReq} mm</span>
            </div>
            <div className="irr-info-item">
              <span className="irr-info-lbl">Your Field</span>
              <span className="irr-info-val">{landAreaAcres} Acres</span>
            </div>
          </div>

          {/* ── Inputs: rainfall + method ── */}
          <div className="irr-controls-row">
            <div className="irr-control-item">
              <label className="irr-control-label">
                🌧️ Expected Seasonal Rain: <strong style={{ color: '#60a5fa' }}>{annualRain} mm</strong>
              </label>
              <input
                type="range" min={0} max={2000} step={20}
                value={annualRain}
                onChange={e => setAnnualRain(+e.target.value)}
                className="irr-slider"
              />
              <div className="irr-range-hints"><span>0 mm (Dry)</span><span>2000 mm (Heavy)</span></div>
            </div>

            <div className="irr-control-item">
              <label className="irr-control-label">💧 Irrigation Method</label>
              <div className="irr-method-grid">
                {Object.entries(METHOD_EFFICIENCY).map(([key, m]) => (
                  <button
                    key={key}
                    className={`irr-method-btn ${method === key ? 'active' : ''}`}
                    onClick={() => setMethod(key)}
                  >
                    <span className="irr-method-icon">{m.icon}</span>
                    <div>
                      <div className="irr-method-name">{m.name}</div>
                      <div className="irr-method-desc">{m.desc}</div>
                    </div>
                    {method === key && <span className="irr-method-check">✓</span>}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ── Water Budget ── */}
          {schedule && (
            <div className="irr-results-grid">
              <div className="irr-budget-card">
                <div className="irr-budget-title">💧 Water Budget</div>
                <div className="irr-budget-bars">
                  <IrrigationBar label="Crop Demand" value={schedule.grossWater} max={schedule.grossWater} color="#60a5fa" unit="mm" />
                  <IrrigationBar label="Rain Cover"  value={schedule.rainCover}  max={schedule.grossWater} color="#34d399" unit="mm" />
                  <IrrigationBar label="Net Required" value={schedule.netRequired} max={schedule.grossWater} color="#f97316" unit="mm" />
                  <IrrigationBar label={`After ${methodData.name}`} value={schedule.afterMethod} max={schedule.grossWater} color="#a78bfa" unit="mm" />
                </div>
              </div>

              <div className="irr-schedule-card">
                <div className="irr-budget-title">📅 Schedule Summary</div>
                <div className="irr-sched-rows">
                  <div className="irr-sched-row">
                    <span>Total Water Volume</span>
                    <strong>{(schedule.totalM3 / 1000).toFixed(1)} ML</strong>
                  </div>
                  <div className="irr-sched-row">
                    <span>Daily Requirement</span>
                    <strong>{schedule.dailyLitres.toLocaleString()} L/day</strong>
                  </div>
                  <div className="irr-sched-row">
                    <span>Irrigation Events (weekly)</span>
                    <strong>{schedule.irrigEvents} sessions</strong>
                  </div>
                  <div className="irr-sched-row">
                    <span>Per Session</span>
                    <strong>{parseInt(schedule.perEventL).toLocaleString()} L</strong>
                  </div>
                  <div className="irr-sched-row highlight">
                    <span>💰 Est. Water Cost</span>
                    <strong style={{ color: '#fbbf24' }}>₹{schedule.waterCostINR.toLocaleString()}</strong>
                  </div>
                  {schedule.laborSaved > 0 && (
                    <div className="irr-sched-row">
                      <span>Labour Saving</span>
                      <strong style={{ color: '#4ade80' }}>~{(schedule.laborSaved * 100).toFixed(0)}%</strong>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── Growth Stages ── */}
          <div className="irr-stages-section">
            <div className="irr-section-label">🌱 Crop Growth Stages & Irrigation Priority</div>
            <div className="irr-stages-track">
              {cropData.stages.map((stage, i) => {
                const intensity = [0.6, 1, 0.9, 0.5][i] || 0.7
                const colors    = ['#60a5fa', '#4ade80', '#fbbf24', '#f87171']
                return (
                  <div key={i} className="irr-stage-block" style={{ borderTop: `3px solid ${colors[i]}` }}>
                    <div className="irr-stage-num" style={{ color: colors[i] }}>Stage {i + 1}</div>
                    <div className="irr-stage-name">{stage}</div>
                    <div className="irr-stage-intensity">
                      <div className="irr-intensity-label">Water need</div>
                      <div className="irr-intensity-bar" style={{ background: 'rgba(255,255,255,0.06)' }}>
                        <div style={{ width: `${intensity * 100}%`, background: colors[i], height: '100%', borderRadius: '4px' }} />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* ── Tips ── */}
          <div className="irr-tips-box">
            <div className="irr-tips-title">💡 Smart Irrigation Tips for {activeCrop.charAt(0).toUpperCase() + activeCrop.slice(1)}</div>
            <ul className="irr-tips-list">
              {method === 'drip' && <li>Install sub-surface drip lines for up to 50% water savings and reduced weed growth.</li>}
              {method === 'sprinkler' && <li>Use early morning (before 8am) for sprinkler operation — reduces evaporation loss by 25%.</li>}
              {method === 'flood' && <li>Consider switching to furrow irrigation to reduce runoff. Saves 20% water vs. flat flood.</li>}
              <li>Install tensiometers at 15 & 30cm depth to trigger irrigation only when needed.</li>
              <li>Mulch with paddy straw (3–4 cm) to reduce evapotranspiration by 30%.</li>
              {activeCrop === 'rice' && <li>Use AWD (Alternate Wetting & Drying) for rice — saves 25–30% water with no yield loss.</li>}
              {activeCrop === 'wheat' && <li>Critical stages for wheat: CRI, jointing, and grain fill. Don't miss these windows.</li>}
              {annualRain > 800 && <li>Good rainfall year expected — consider rain harvesting to replenish groundwater.</li>}
            </ul>
          </div>
        </>
      )}

      {!cropData && (
        <div className="irr-empty-state">
          <div className="irr-empty-icon">🌱</div>
          <p>Select a crop above or get a prediction first to see your personalized irrigation schedule.</p>
        </div>
      )}
    </div>
  )
}
