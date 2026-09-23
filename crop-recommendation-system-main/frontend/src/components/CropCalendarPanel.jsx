import { useState, useMemo } from 'react'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const CROP_CALENDARS = {
  rice: {
    name: 'Rice (Paddy)',
    season: 'Kharif Season',
    seasonColor: '#38bdf8',
    durationDays: '120–140 days',
    msp: '₹2,300 / quintal (Common) · ₹2,320 (Grade A)',
    stages: [
      { name: 'Nursery & Land Prep', months: [5, 6], desc: 'Puddle field, apply basal DAP/MOP, sow nursery beds' },
      { name: 'Transplanting', months: [6, 7], desc: '20–25 day old seedlings, maintain 2–3 cm standing water' },
      { name: 'Tillering & Vegetative', months: [7, 8], desc: 'First urea split dose, weed control within 30 DAT' },
      { name: 'Panicle & Flowering', months: [8, 9], desc: 'Critical water requirement; apply second urea split' },
      { name: 'Ripening & Harvest', months: [9, 10], desc: 'Drain water 10 days before harvest when 85% grains turn golden' },
    ],
    pests: [
      { name: 'Yellow Stem Borer', peakMonths: [7, 8], action: 'Pheromone traps (5/acre) or Chlorantraniliprole 18.5% SC' },
      { name: 'Brown Plant Hopper (BPH)', peakMonths: [8, 9], action: 'Alternate wetting & drying; avoid excess urea' },
      { name: 'Blast & Sheath Blight', peakMonths: [8, 9], action: 'Tricyclazole 75 WP or Azoxystrobin spray' },
    ],
    insuranceCutoff: 'July 31 (Kharif PMFBY)',
  },
  wheat: {
    name: 'Wheat',
    season: 'Rabi Season',
    seasonColor: '#fbbf24',
    durationDays: '110–130 days',
    msp: '₹2,275 / quintal',
    stages: [
      { name: 'Field Prep & Sowing', months: [10, 11], desc: 'Sow at 20 cm row spacing; seed treatment with Trichoderma' },
      { name: 'Crown Root Initiation (CRI)', months: [11, 0], desc: 'Most critical irrigation 21 days after sowing; first urea top dressing' },
      { name: 'Tillering & Jointing', months: [0, 1], desc: 'Second irrigation at 40–45 DAS; broadleaf weed management' },
      { name: 'Heading & Flowering', months: [1, 2], desc: 'Milking stage irrigation; monitor for yellow rust in cool humid spells' },
      { name: 'Maturity & Harvesting', months: [2, 3], desc: 'Harvest when grain moisture drops below 14%' },
    ],
    pests: [
      { name: 'Yellow / Stripe Rust', peakMonths: [0, 1], action: 'Propiconazole 25% EC at first sign of yellow pustules' },
      { name: 'Aphids', peakMonths: [1, 2], action: 'Spray Dimethoate or Thiamethoxam if >5 aphids/earhead' },
      { name: 'Termites', peakMonths: [10, 11], action: 'Seed treatment with Chlorpyriphos 20 EC' },
    ],
    insuranceCutoff: 'December 31 (Rabi PMFBY)',
  },
  maize: {
    name: 'Maize (Corn)',
    season: 'Kharif / Rabi',
    seasonColor: '#4ade80',
    durationDays: '95–110 days',
    msp: '₹2,090 / quintal',
    stages: [
      { name: 'Land Preparation & Sowing', months: [5, 6], desc: 'Ridge and furrow method; seed priming with Zinc' },
      { name: 'Early Vegetative', months: [6, 7], desc: 'Knee-high stage top dressing of Nitrogen' },
      { name: 'Tasseling & Silking', months: [7, 8], desc: 'Peak moisture sensitivity; drought here drops yield by 40%' },
      { name: 'Grain Filling', months: [8, 9], desc: 'Maintain field capacity moisture; protect cobs from borers' },
      { name: 'Harvesting', months: [9, 10], desc: 'Harvest when black layer forms at grain base' },
    ],
    pests: [
      { name: 'Fall Armyworm (FAW)', peakMonths: [6, 7], action: 'Emamectin benzoate 5% SG or Spinetoram in whorl' },
      { name: 'Stem Borer', peakMonths: [7, 8], action: 'Pheromone traps & Carbofuran 3G whorl application' },
    ],
    insuranceCutoff: 'July 31 (Kharif) / Dec 31 (Rabi)',
  },
  cotton: {
    name: 'Cotton',
    season: 'Kharif Season',
    seasonColor: '#f43f5e',
    durationDays: '150–180 days',
    msp: '₹7,121 / quintal (Medium) · ₹7,521 (Long Staple)',
    stages: [
      { name: 'Sowing & Germination', months: [4, 5], desc: 'Sow on ridges with pre-monsoon shower or canal water' },
      { name: 'Squaring & Branching', months: [6, 7], desc: 'Square formation; nip terminal bud at 85 days to boost branches' },
      { name: 'Peak Flowering', months: [7, 8], desc: 'High potassium requirement; foliar spray of 1% 13:0:45' },
      { name: 'Boll Development', months: [8, 9, 10], desc: 'Critical pest monitoring; avoid water stress during boll expansion' },
      { name: 'Picking / Harvest', months: [10, 11, 0], desc: 'Multi-stage picking of clean burst bolls in dry morning hours' },
    ],
    pests: [
      { name: 'Pink Bollworm (PBW)', peakMonths: [8, 9, 10], action: 'Install PBW pheromone traps (8/ac); release Trichogramma' },
      { name: 'Whitefly & Aphids', peakMonths: [6, 7], action: 'Yellow sticky traps (15/ac); spray Diafenthiuron' },
    ],
    insuranceCutoff: 'July 31 (Kharif PMFBY)',
  },
  chickpea: {
    name: 'Chickpea (Gram)',
    season: 'Rabi Season',
    seasonColor: '#a78bfa',
    durationDays: '90–115 days',
    msp: '₹5,440 / quintal',
    stages: [
      { name: 'Sowing & Seed Treatment', months: [9, 10], desc: 'Treat seed with Rhizobium & PSB inoculants; conserve residual moisture' },
      { name: 'Vegetative & Branching', months: [10, 11], desc: 'Nipping of tender tips at 30–35 DAS to induce prolific podding' },
      { name: 'Pod Initiation & Filling', months: [11, 0, 1], desc: 'Branching irrigation; spray 2% Urea or DAP foliar boost' },
      { name: 'Physiological Maturity', months: [1, 2], desc: 'Leaves turn brown and pods rattle on shaking; harvest immediately' },
    ],
    pests: [
      { name: 'Gram Pod Borer (Helicoverpa)', peakMonths: [11, 0], action: 'Bird perches (20/ac), HaNPV spray, or Flubendiamide' },
      { name: 'Fusarium Wilt', peakMonths: [10, 11], action: 'Seed treatment with Trichoderma viride (10g/kg seed)' },
    ],
    insuranceCutoff: 'December 31 (Rabi PMFBY)',
  },
}

// Fallback calendar for other crops
const DEFAULT_CALENDAR = {
  name: 'Commercial Field Crop',
  season: 'Standard Ag Season',
  seasonColor: '#4ade80',
  durationDays: '110–135 days',
  msp: 'Market-linked / State Advisory Price',
  stages: [
    { name: 'Land Prep & Sowing', months: [5, 6], desc: 'Deep ploughing, basal compost & fertiliser application' },
    { name: 'Vegetative Growth', months: [6, 7], desc: 'Active shoot & root elongation; inter-cultivation & weeding' },
    { name: 'Flowering & Fruiting', months: [7, 8], desc: 'Crucial irrigation window; ensure no moisture deficit' },
    { name: 'Maturation & Harvest', months: [8, 9], desc: 'Harvest during dry weather when crop reaches peak dry matter' },
  ],
  pests: [
    { name: 'Sucking Pests (Aphids/Thrips)', peakMonths: [6, 7], action: 'Neem oil spray (5ml/L) or systemic insecticide' },
    { name: 'Fungal Leaf Spot', peakMonths: [7, 8], action: 'Mancozeb 75 WP or Carbendazim protective spray' },
  ],
  insuranceCutoff: 'Regional State Cutoff Date',
}

export default function CropCalendarPanel({ result, location }) {
  const currentMonthIdx = new Date().getMonth() // 0 = Jan, 11 = Dec
  const [selectedMonth, setSelectedMonth] = useState(currentMonthIdx)

  const cropKey = result?.recommended_crop?.toLowerCase()?.trim() || ''
  const cal = CROP_CALENDARS[cropKey] || DEFAULT_CALENDAR

  // Determine active stage for selected month
  const activeStage = useMemo(() => {
    return cal.stages.find(s => s.months.includes(selectedMonth)) || null
  }, [cal, selectedMonth])

  // Determine active pests for selected month
  const activePests = useMemo(() => {
    return cal.pests.filter(p => p.peakMonths.includes(selectedMonth))
  }, [cal, selectedMonth])

  return (
    <div className="glass-card crop-calendar-card">
      <div className="card-header">
        <span className="card-icon" aria-hidden="true">📅</span>
        <div style={{ flex: 1 }}>
          <h2 className="card-title">Crop Agronomy Calendar &amp; Advisory</h2>
          <p className="card-subtitle">
            12-month cultivation timeline, pest forecast &amp; MSP advisory for{' '}
            <strong style={{ color: 'var(--accent-green)' }}>{cal.name}</strong>
          </p>
        </div>
        <div className="calendar-season-pill" style={{ borderColor: cal.seasonColor, color: cal.seasonColor }}>
          {cal.season} · {cal.durationDays}
        </div>
      </div>

      {/* 12-Month Interactive Bar */}
      <div className="calendar-months-nav">
        <div className="months-strip" role="tablist">
          {MONTHS.map((m, idx) => {
            const isCurrent = idx === currentMonthIdx
            const isSelected = idx === selectedMonth
            const hasStage = cal.stages.some(s => s.months.includes(idx))
            const hasPestAlert = cal.pests.some(p => p.peakMonths.includes(idx))

            return (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={isSelected}
                onClick={() => setSelectedMonth(idx)}
                className={`month-tab-btn ${isSelected ? 'selected' : ''} ${isCurrent ? 'current-now' : ''} ${hasStage ? 'has-activity' : ''}`}
              >
                <span className="month-name">{m}</span>
                {isCurrent && <span className="now-dot" title="Current Month">NOW</span>}
                {hasPestAlert && <span className="pest-alert-dot" title="Pest Alert Month">⚠️</span>}
              </button>
            )
          })}
        </div>
      </div>

      {/* Selected Month Deep-Dive */}
      <div className="calendar-month-detail">
        <div className="month-detail-header">
          <div className="month-detail-title">
            <span className="month-badge">{MONTHS[selectedMonth]}</span>
            <div>
              <h3 className="month-stage-heading">
                {activeStage ? activeStage.name : 'Off-Season / Field Fallow / Rotational Green Manure'}
              </h3>
              <p className="month-stage-sub">
                {activeStage ? activeStage.desc : 'No critical crop operations; maintain soil moisture or plant cover crop.'}
              </p>
            </div>
          </div>
          {activeStage && (
            <span className="status-chip active-stage">
              🌱 Active Cultivation Window
            </span>
          )}
        </div>

        {/* Pest & Disease Alerts for this month */}
        <div className="calendar-alerts-grid">
          <div className="calendar-alert-card pest-card">
            <div className="alert-card-title">
              <span>🐛 High-Risk Pest &amp; Disease Forecast ({MONTHS[selectedMonth]})</span>
            </div>
            {activePests.length > 0 ? (
              <div className="pest-list">
                {activePests.map((pest, pidx) => (
                  <div key={pidx} className="pest-item">
                    <div className="pest-name-row">
                      <span className="pest-tag">⚠️ High Alert</span>
                      <strong className="pest-title">{pest.name}</strong>
                    </div>
                    <div className="pest-action">
                      <strong>IPM Control:</strong> {pest.action}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="pest-empty">
                ✓ Low pest &amp; disease pressure expected during {MONTHS[selectedMonth]} under normal weather.
              </div>
            )}
          </div>

          {/* MSP & Government Schemes */}
          <div className="calendar-alert-card gov-card">
            <div className="alert-card-title">
              <span>🏛️ Market Support (MSP) &amp; Crop Insurance</span>
            </div>
            <div className="gov-info-list">
              <div className="gov-info-item">
                <span className="gov-label">Minimum Support Price (MSP):</span>
                <span className="gov-val">{cal.msp}</span>
              </div>
              <div className="gov-info-item">
                <span className="gov-label">PMFBY Insurance Cut-off:</span>
                <span className="gov-val">{cal.insuranceCutoff}</span>
              </div>
              <div className="gov-info-item">
                <span className="gov-label">Target Field Location:</span>
                <span className="gov-val">{location?.city ? `${location.city}, ${location.country}` : 'Selected Field Centroid'}</span>
              </div>
              <div className="gov-tip">
                💡 Register on the e-NAM portal before peak harvest to access online mandi bidding and fair realization.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Full Season Workflow Timeline */}
      <div className="full-timeline-strip">
        <h4 className="timeline-title">Complete Crop Phenology Journey</h4>
        <div className="stages-flow">
          {cal.stages.map((stage, sidx) => (
            <div key={sidx} className={`stage-step ${stage.months.includes(selectedMonth) ? 'highlighted' : ''}`}>
              <div className="stage-step-num">{sidx + 1}</div>
              <div className="stage-step-content">
                <div className="stage-step-name">{stage.name}</div>
                <div className="stage-step-months">
                  {stage.months.map(m => MONTHS[m]).join(', ')}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
