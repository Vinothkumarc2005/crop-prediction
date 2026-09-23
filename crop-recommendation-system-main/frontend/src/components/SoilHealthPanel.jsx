import { useMemo } from 'react'

// Agronomic crop nutrient & pH profiles
const CROP_SOIL_PROFILES = {
  rice: {
    name: 'Rice (Paddy)',
    idealN: [80, 120], idealP: [35, 60], idealK: [35, 60],
    idealPH: [5.5, 6.8],
    npkRatio: '4:2:1',
    description: 'Requires balanced nitrogen in split doses; performs well in slightly acidic to neutral soils.',
  },
  wheat: {
    name: 'Wheat',
    idealN: [100, 140], idealP: [40, 60], idealK: [40, 60],
    idealPH: [6.0, 7.5],
    npkRatio: '4:2:1',
    description: 'Demands adequate phosphorus at crown root initiation; thrives in neutral loamy soils.',
  },
  maize: {
    name: 'Maize (Corn)',
    idealN: [100, 150], idealP: [45, 65], idealK: [40, 60],
    idealPH: [5.8, 7.2],
    npkRatio: '4:2:1',
    description: 'Heavy feeder crop; sensitive to zinc deficiency and waterlogged acidic soils.',
  },
  cotton: {
    name: 'Cotton',
    idealN: [90, 130], idealP: [35, 55], idealK: [45, 75],
    idealPH: [6.0, 7.8],
    npkRatio: '3:2:2',
    description: 'High potassium requirement for boll development and fiber quality; drought resilient.',
  },
  sugarcane: {
    name: 'Sugarcane',
    idealN: [120, 180], idealP: [50, 75], idealK: [60, 90],
    idealPH: [6.0, 7.5],
    npkRatio: '3:1:2',
    description: 'Massive biomass producer requiring heavy basal and top dressing of nutrients.',
  },
  chickpea: {
    name: 'Chickpea (Gram)',
    idealN: [20, 45], idealP: [40, 65], idealK: [25, 45],
    idealPH: [6.0, 7.5],
    npkRatio: '1:2:1',
    description: 'Leguminous crop; fixes atmospheric nitrogen via Rhizobium nodules; needs high phosphorus.',
  },
  lentil: {
    name: 'Lentil',
    idealN: [15, 35], idealP: [40, 60], idealK: [20, 40],
    idealPH: [6.0, 7.2],
    npkRatio: '1:2:1',
    description: 'Low nitrogen requirement; requires starter dose and good phosphorus availability.',
  },
  banana: {
    name: 'Banana',
    idealN: [110, 160], idealP: [45, 70], idealK: [100, 160],
    idealPH: [6.0, 7.5],
    npkRatio: '2:1:4',
    description: 'Extremely potassium-hungry fruit; potassium essential for bunch size and sweetness.',
  },
  mango: {
    name: 'Mango',
    idealN: [70, 110], idealP: [30, 50], idealK: [50, 80],
    idealPH: [5.5, 7.2],
    npkRatio: '2:1:2',
    description: 'Deep-rooted perennial; sensitive to salinity and high water tables.',
  },
  apple: {
    name: 'Apple',
    idealN: [60, 100], idealP: [30, 50], idealK: [50, 80],
    idealPH: [5.8, 6.8],
    npkRatio: '2:1:2',
    description: 'Requires rich organic matter and well-drained slightly acidic soil with good calcium.',
  },
  coffee: {
    name: 'Coffee',
    idealN: [90, 130], idealP: [35, 55], idealK: [80, 120],
    idealPH: [5.5, 6.5],
    npkRatio: '2:1:3',
    description: 'Shade-loving crop; favors slightly acidic volcanic/humus-rich soil.',
  },
}

// Fallback profile if crop not matched
const DEFAULT_PROFILE = {
  name: 'Standard Field Crop',
  idealN: [80, 120], idealP: [40, 60], idealK: [40, 60],
  idealPH: [6.0, 7.2],
  npkRatio: '4:2:1',
  description: 'Balanced general field requirements for optimal vegetative and reproductive development.',
}

function classifyStatus(val, [min, max]) {
  if (val < min * 0.7) return { text: 'Critical Deficit', color: '#ef4444', score: 30 }
  if (val < min)       return { text: 'Low / Deficient', color: '#f59e0b', score: 65 }
  if (val <= max)      return { text: 'Optimal',          color: '#4ade80', score: 100 }
  if (val <= max * 1.3) return { text: 'Slight Excess',   color: '#38bdf8', score: 75 }
  return { text: 'Excess / Imbalance', color: '#ec4899', score: 40 }
}

function classifyPH(ph, [min, max]) {
  let phType = 'Neutral'
  if (ph < 5.5) phType = 'Strongly Acidic'
  else if (ph < 6.5) phType = 'Slightly Acidic'
  else if (ph <= 7.3) phType = 'Neutral'
  else if (ph <= 8.2) phType = 'Moderately Alkaline'
  else phType = 'Strongly Alkaline (Sodic)'

  const inRange = ph >= min && ph <= max
  return {
    phType,
    inRange,
    color: inRange ? '#4ade80' : (ph < min ? '#f59e0b' : '#f97316'),
    diff: ph < min ? (min - ph).toFixed(1) : ph > max ? (ph - max).toFixed(1) : 0,
  }
}

export default function SoilHealthPanel({ soilValues, result }) {
  const cropKey = result?.recommended_crop?.toLowerCase()?.trim() || ''
  const profile = CROP_SOIL_PROFILES[cropKey] || DEFAULT_PROFILE

  const N = soilValues?.N ?? 90
  const P = soilValues?.P ?? 42
  const K = soilValues?.K ?? 43
  const ph = soilValues?.ph ?? 6.5

  // Calculations
  const analysis = useMemo(() => {
    const nStat = classifyStatus(N, profile.idealN)
    const pStat = classifyStatus(P, profile.idealP)
    const kStat = classifyStatus(K, profile.idealK)
    const phStat = classifyPH(ph, profile.idealPH)

    // Overall soil fertility health score (weighted)
    const healthScore = Math.round(
      nStat.score * 0.30 +
      pStat.score * 0.25 +
      kStat.score * 0.25 +
      (phStat.inRange ? 100 : Math.max(30, 100 - phStat.diff * 35)) * 0.20
    )

    let scoreRating = 'Optimal Fertility'
    let scoreColor = '#4ade80'
    if (healthScore < 55) { scoreRating = 'Requires Major Amendment'; scoreColor = '#ef4444' }
    else if (healthScore < 75) { scoreRating = 'Moderate Fertility'; scoreColor = '#f59e0b' }
    else if (healthScore < 90) { scoreRating = 'Good Soil Health'; scoreColor = '#22c55e' }

    // Fertilizer dosage calculations per acre (assuming 1 ha = 2.47 acres)
    // Targeted application based on deficit to reach mid-point of ideal range
    const targetN = (profile.idealN[0] + profile.idealN[1]) / 2
    const targetP = (profile.idealP[0] + profile.idealP[1]) / 2
    const targetK = (profile.idealK[0] + profile.idealK[1]) / 2

    const defN = Math.max(0, targetN - N) / 2.47
    const defP = Math.max(0, targetP - P) / 2.47
    const defK = Math.max(0, targetK - K) / 2.47

    // Fertilizer formulations:
    // DAP provides 18% N, 46% P2O5
    const dapKgPerAcre = Math.round(defP / 0.46)
    // N provided by DAP
    const nFromDAP = dapKgPerAcre * 0.18
    // Remaining N needed from Urea (46% N)
    const remN = Math.max(0, defN - nFromDAP)
    const ureaKgPerAcre = Math.round(remN / 0.46)
    // MOP (Muriate of Potash, 60% K2O)
    const mopKgPerAcre = Math.round(defK / 0.60)

    // Soil amendment prescription
    let amendment = null
    if (ph < 5.8) {
      amendment = {
        name: 'Agricultural Dolomitic Limestone',
        rate: '250 - 400 kg/acre',
        reason: 'Raise soil pH to neutral zone and replenish Calcium/Magnesium.',
      }
    } else if (ph > 7.8) {
      amendment = {
        name: 'Gypsum (Calcium Sulfate) / Organic Compost',
        rate: '200 - 350 kg/acre',
        reason: 'Displace sodium, reduce soil alkalinity, and improve soil aeration.',
      }
    }

    return {
      nStat, pStat, kStat, phStat,
      healthScore, scoreRating, scoreColor,
      ureaKgPerAcre, dapKgPerAcre, mopKgPerAcre,
      amendment,
    }
  }, [N, P, K, ph, profile])

  return (
    <div className="glass-card soil-health-card">
      <div className="card-header">
        <span className="card-icon" aria-hidden="true">🧪</span>
        <div style={{ flex: 1 }}>
          <h2 className="card-title">Soil Fertility &amp; Nutrition Intelligence</h2>
          <p className="card-subtitle">
            Agronomic evaluation &amp; precision fertilizer prescription for{' '}
            <strong style={{ color: 'var(--accent-green)' }}>{profile.name}</strong>
          </p>
        </div>
        <div className="soil-score-badge" style={{ borderColor: analysis.scoreColor, color: analysis.scoreColor }}>
          <span className="soil-score-num">{analysis.healthScore}</span>
          <span className="soil-score-label">/ 100 Fertility</span>
        </div>
      </div>

      {/* Overview Status Banner */}
      <div className="soil-overview-banner" style={{ borderLeftColor: analysis.scoreColor }}>
        <div>
          <span className="soil-rating-tag" style={{ background: `${analysis.scoreColor}22`, color: analysis.scoreColor }}>
            ● {analysis.scoreRating}
          </span>
          <p className="soil-overview-desc">
            {profile.description}
          </p>
        </div>
        <div className="soil-ideal-ratio">
          <span className="ratio-label">Ideal N:P:K Ratio</span>
          <span className="ratio-val">{profile.npkRatio}</span>
        </div>
      </div>

      {/* Grid: 3 Macronutrients + pH Meter */}
      <div className="soil-metrics-grid">
        {/* Nitrogen Card */}
        <div className="soil-metric-item">
          <div className="metric-header">
            <span className="metric-name">Nitrogen (N)</span>
            <span className="metric-badge" style={{ color: analysis.nStat.color, borderColor: analysis.nStat.color }}>
              {analysis.nStat.text}
            </span>
          </div>
          <div className="metric-value-row">
            <span className="metric-main-val">{N}</span>
            <span className="metric-unit">kg/ha</span>
          </div>
          <div className="metric-bar-track">
            <div
              className="metric-bar-fill"
              style={{
                width: `${Math.min(100, (N / 200) * 100)}%`,
                background: analysis.nStat.color,
              }}
            />
          </div>
          <div className="metric-target-info">
            <span>Optimal: {profile.idealN[0]}–{profile.idealN[1]} kg/ha</span>
          </div>
        </div>

        {/* Phosphorus Card */}
        <div className="soil-metric-item">
          <div className="metric-header">
            <span className="metric-name">Phosphorus (P)</span>
            <span className="metric-badge" style={{ color: analysis.pStat.color, borderColor: analysis.pStat.color }}>
              {analysis.pStat.text}
            </span>
          </div>
          <div className="metric-value-row">
            <span className="metric-main-val">{P}</span>
            <span className="metric-unit">kg/ha</span>
          </div>
          <div className="metric-bar-track">
            <div
              className="metric-bar-fill"
              style={{
                width: `${Math.min(100, (P / 120) * 100)}%`,
                background: analysis.pStat.color,
              }}
            />
          </div>
          <div className="metric-target-info">
            <span>Optimal: {profile.idealP[0]}–{profile.idealP[1]} kg/ha</span>
          </div>
        </div>

        {/* Potassium Card */}
        <div className="soil-metric-item">
          <div className="metric-header">
            <span className="metric-name">Potassium (K)</span>
            <span className="metric-badge" style={{ color: analysis.kStat.color, borderColor: analysis.kStat.color }}>
              {analysis.kStat.text}
            </span>
          </div>
          <div className="metric-value-row">
            <span className="metric-main-val">{K}</span>
            <span className="metric-unit">kg/ha</span>
          </div>
          <div className="metric-bar-track">
            <div
              className="metric-bar-fill"
              style={{
                width: `${Math.min(100, (K / 150) * 100)}%`,
                background: analysis.kStat.color,
              }}
            />
          </div>
          <div className="metric-target-info">
            <span>Optimal: {profile.idealK[0]}–{profile.idealK[1]} kg/ha</span>
          </div>
        </div>

        {/* Soil pH Card */}
        <div className="soil-metric-item">
          <div className="metric-header">
            <span className="metric-name">Soil Reaction (pH)</span>
            <span className="metric-badge" style={{ color: analysis.phStat.color, borderColor: analysis.phStat.color }}>
              {analysis.phStat.inRange ? '✓ Suitable' : `${analysis.phStat.phType}`}
            </span>
          </div>
          <div className="metric-value-row">
            <span className="metric-main-val">{ph.toFixed(2)}</span>
            <span className="metric-unit">pH · {analysis.phStat.phType}</span>
          </div>
          <div className="metric-bar-track ph-track">
            {/* Target indicator box */}
            <div
              className="ph-target-zone"
              style={{
                left: `${((profile.idealPH[0] - 3) / 7) * 100}%`,
                width: `${((profile.idealPH[1] - profile.idealPH[0]) / 7) * 100}%`,
              }}
              title={`Target window: ${profile.idealPH[0]} - ${profile.idealPH[1]}`}
            />
            {/* Needle */}
            <div
              className="ph-needle"
              style={{
                left: `${Math.max(0, Math.min(100, ((ph - 3) / 7) * 100))}%`,
              }}
            />
          </div>
          <div className="metric-target-info">
            <span>Target: {profile.idealPH[0]}–{profile.idealPH[1]} pH</span>
          </div>
        </div>
      </div>

      {/* Precision Fertilizer Prescription */}
      <div className="fertilizer-section">
        <div className="fert-header">
          <div>
            <h3 className="fert-title">🎯 Precision Fertilizer Recommendation</h3>
            <p className="fert-sub">Calculated dosage to reach optimal yield potential per acre</p>
          </div>
          <span className="fert-tag">Split Application Recommended</span>
        </div>

        <div className="fert-cards-grid">
          {/* Urea Card */}
          <div className="fert-card">
            <div className="fert-card-top">
              <span className="fert-icon">⚪</span>
              <span className="fert-nutrient-tag">Nitrogen (46% N)</span>
            </div>
            <div className="fert-dose-val">
              {analysis.ureaKgPerAcre > 0 ? `${analysis.ureaKgPerAcre} kg` : '0 kg'}
              <span className="fert-unit">/ acre</span>
            </div>
            <div className="fert-name">Urea</div>
            <div className="fert-instruction">
              {analysis.ureaKgPerAcre > 0
                ? 'Apply in 2–3 splits (Basal + Tillering/Vegetative + Panicle/Flowering)'
                : 'Nitrogen level is currently adequate; avoid surplus to prevent lodging'}
            </div>
          </div>

          {/* DAP Card */}
          <div className="fert-card">
            <div className="fert-card-top">
              <span className="fert-icon">🟤</span>
              <span className="fert-nutrient-tag">P &amp; N (18:46:0)</span>
            </div>
            <div className="fert-dose-val">
              {analysis.dapKgPerAcre > 0 ? `${analysis.dapKgPerAcre} kg` : '0 kg'}
              <span className="fert-unit">/ acre</span>
            </div>
            <div className="fert-name">DAP (Di-Ammonium Phosphate)</div>
            <div className="fert-instruction">
              {analysis.dapKgPerAcre > 0
                ? 'Apply 100% as basal dose during final land preparation / sowing'
                : 'Phosphorus reservoir is sufficient in soil root zone'}
            </div>
          </div>

          {/* MOP Card */}
          <div className="fert-card">
            <div className="fert-card-top">
              <span className="fert-icon">🔴</span>
              <span className="fert-nutrient-tag">Potash (60% K₂O)</span>
            </div>
            <div className="fert-dose-val">
              {analysis.mopKgPerAcre > 0 ? `${analysis.mopKgPerAcre} kg` : '0 kg'}
              <span className="fert-unit">/ acre</span>
            </div>
            <div className="fert-name">MOP (Muriate of Potash)</div>
            <div className="fert-instruction">
              {analysis.mopKgPerAcre > 0
                ? 'Apply 50% basal and 50% at flowering/grain-filling stage'
                : 'Potassium is well balanced; maintains disease resistance'}
            </div>
          </div>

          {/* Bio/Organic Card */}
          <div className="fert-card organic">
            <div className="fert-card-top">
              <span className="fert-icon">🌿</span>
              <span className="fert-nutrient-tag organic">Bio-Fertilizer</span>
            </div>
            <div className="fert-dose-val">
              2.5 tons
              <span className="fert-unit">/ acre</span>
            </div>
            <div className="fert-name">Enriched Farmyard Manure (FYM)</div>
            <div className="fert-instruction">
              Incorporate with Trichoderma &amp; PSB (Phosphate Solubilizing Bacteria) 15 days before sowing.
            </div>
          </div>
        </div>

        {/* Soil amendment alert if pH is off */}
        {analysis.amendment && (
          <div className="amendment-banner">
            <span className="amend-icon">⚠️</span>
            <div className="amend-body">
              <strong>Soil Reaction Correction Required:</strong> Apply {analysis.amendment.name} at{' '}
              <strong style={{ color: 'var(--accent-green)' }}>{analysis.amendment.rate}</strong>. {analysis.amendment.reason}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
