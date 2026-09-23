import { useState, useMemo } from 'react'
import { CROP_INFO } from '../cropData'

export default function MarketProfitPanel({ result, initialAcres = 2.5 }) {
  const [acres, setAcres] = useState(initialAcres > 0 ? initialAcres : 2.5)

  if (!result || !result.recommended_crop) return null

  const mainCrop = result.recommended_crop
  const topCrops = result.all_probabilities
    ? Object.entries(result.all_probabilities)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([c]) => c)
    : [mainCrop]

  const [selectedCrop, setSelectedCrop] = useState(mainCrop)
  const info = CROP_INFO[selectedCrop] || CROP_INFO.rice
  const market = info.market || {}

  // Financial calculations
  const financials = useMemo(() => {
    const yieldPerAcre = market.avgYieldQtlPerAcre || 10
    const harvestPrice = market.forecastHarvestPrice || 3000
    const currentPrice = market.modalPricePerQtl || 2800
    const costPerAcre = market.costPerAcre?.total || 20000

    const totalYieldQtl = yieldPerAcre * acres
    const grossRevenue = totalYieldQtl * harvestPrice
    const totalCost = costPerAcre * acres
    const netProfit = grossRevenue - totalCost
    const netProfitPerAcre = netProfit / acres
    const roi = totalCost > 0 ? (netProfit / totalCost) * 100 : 0

    return {
      yieldPerAcre,
      harvestPrice,
      currentPrice,
      totalYieldQtl: Math.round(totalYieldQtl * 10) / 10,
      grossRevenue: Math.round(grossRevenue),
      costPerAcre,
      totalCost: Math.round(totalCost),
      netProfit: Math.round(netProfit),
      netProfitPerAcre: Math.round(netProfitPerAcre),
      roi: Math.round(roi),
      costBreakdown: market.costPerAcre || {},
    }
  }, [selectedCrop, acres, market])

  const isProfit = financials.netProfit >= 0

  return (
    <div className="glass-card market-profit-panel" aria-label="Market Trend & Profitability Predictor">
      {/* Header */}
      <div className="card-header">
        <span className="card-icon" aria-hidden="true">📈</span>
        <div style={{ flex: 1 }}>
          <h3 className="card-title">Market Trend &amp; Profit Prediction</h3>
          <p className="card-subtitle">
            APMC Mandi Price Forecasts &bull; Cultivation Economics &bull; Net Profit Analysis
          </p>
        </div>
        {/* Crop Switcher if top candidates exist */}
        {topCrops.length > 1 && (
          <div className="crop-profit-tabs">
            {topCrops.map((c) => {
              const cInfo = CROP_INFO[c] || {}
              return (
                <button
                  key={c}
                  className={`crop-profit-tab-btn ${selectedCrop === c ? 'active' : ''}`}
                  onClick={() => setSelectedCrop(c)}
                >
                  <span>{cInfo.emoji}</span> {c}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Land Area Slider / Input */}
      <div className="land-size-selector">
        <div className="land-size-header">
          <label htmlFor="acres-range" className="land-size-label">
            🚜 Land Area for Cultivation:
          </label>
          <div className="land-size-value-badge">
            <input
              id="acres-input"
              type="number"
              min="0.1"
              max="100"
              step="0.1"
              value={acres}
              onChange={(e) => setAcres(Math.max(0.1, parseFloat(e.target.value) || 0.1))}
              className="land-size-num-input"
            />
            <span>Acres</span>
            <span className="land-size-ha">({(acres * 0.404686).toFixed(2)} Hectares)</span>
          </div>
        </div>
        <input
          id="acres-range"
          type="range"
          min="0.5"
          max="20"
          step="0.5"
          value={acres <= 20 ? acres : 20}
          onChange={(e) => setAcres(parseFloat(e.target.value))}
          className="land-size-slider"
        />
      </div>

      {/* Grid: Left = Market Trend & Price Forecast, Right = Net Profit Card */}
      <div className="market-profit-grid">
        {/* Left: Mandi Market Trend Forecast */}
        <div className="market-trend-card">
          <div className="subcard-title">
            <span>🏷️ Mandi Price &amp; Trend Outlook</span>
            <span className={`trend-pill ${market.trend === 'bullish' ? 'bullish' : 'stable'}`}>
              {market.trend === 'bullish' ? '↗ Bullish (+ ' + market.trendDeltaPct + '%)' : '→ Stable'}
            </span>
          </div>

          <div className="mandi-price-row">
            <div className="price-item">
              <span className="price-lbl">Current Modal Mandi Price</span>
              <span className="price-val">₹{financials.currentPrice?.toLocaleString()} <small>/ qtl</small></span>
              <span className="price-sub">Wholesale benchmark</span>
            </div>
            <div className="price-arrow">➔</div>
            <div className="price-item highlight">
              <span className="price-lbl">Harvest Price Forecast (3–6 Mo)</span>
              <span className="price-val text-green">₹{financials.harvestPrice?.toLocaleString()} <small>/ qtl</small></span>
              <span className="price-sub">Expected at harvest</span>
            </div>
          </div>

          <div className="market-outlook-box">
            <p className="outlook-text">
              <strong>Demand Outlook:</strong> {market.demandOutlook || 'High market demand during harvest season.'}
            </p>
            {market.msp && (
              <p className="msp-badge">
                🛡️ <strong>Govt MSP Floor:</strong> ₹{market.msp.toLocaleString()}/qtl (Guaranteed price protection)
              </p>
            )}
          </div>

          {/* Expected Production */}
          <div className="production-strip">
            <div className="prod-col">
              <span className="prod-lbl">Expected Yield / Acre</span>
              <span className="prod-val">{financials.yieldPerAcre} quintals</span>
            </div>
            <div className="prod-col">
              <span className="prod-lbl">Total Plot Production</span>
              <span className="prod-val">{financials.totalYieldQtl} quintals</span>
            </div>
          </div>
        </div>

        {/* Right: Net Profit & Cultivation Economics */}
        <div className="profit-summary-card">
          <div className="subcard-title">
            <span>💰 Projected Profitability ({acres} Acres)</span>
            <span className={`roi-badge ${financials.roi > 50 ? 'roi-high' : 'roi-med'}`}>
              ROI: {financials.roi}%
            </span>
          </div>

          {/* Big Profit Display */}
          <div className={`profit-hero-box ${isProfit ? 'profit-pos' : 'profit-neg'}`}>
            <span className="profit-hero-lbl">ESTIMATED NET PROFIT</span>
            <span className="profit-hero-amount">
              ₹{financials.netProfit.toLocaleString('en-IN')}
            </span>
            <span className="profit-hero-sub">
              (₹{Math.round(financials.netProfitPerAcre).toLocaleString('en-IN')} net profit per acre)
            </span>
          </div>

          {/* Financial Breakdown Table */}
          <div className="financial-breakdown-list">
            <div className="fin-row">
              <span>Gross Estimated Revenue ({financials.totalYieldQtl} qtl × ₹{financials.harvestPrice})</span>
              <strong className="text-green">+ ₹{financials.grossRevenue.toLocaleString('en-IN')}</strong>
            </div>
            <div className="fin-row">
              <span>Total Cost of Cultivation (₹{financials.costPerAcre.toLocaleString()}/acre)</span>
              <strong className="text-red">- ₹{financials.totalCost.toLocaleString('en-IN')}</strong>
            </div>
          </div>

          {/* Cultivation Cost Breakdown Mini-bars */}
          <div className="cost-breakdown-section">
            <span className="cost-breakdown-title">Cultivation Cost Breakdown per Acre:</span>
            <div className="cost-tags-grid">
              <div className="cost-tag">
                <span>🌱 Seeds &amp; Prep:</span>
                <strong>₹{financials.costBreakdown.seeds?.toLocaleString()}</strong>
              </div>
              <div className="cost-tag">
                <span>🧪 Fertilizer &amp; Spray:</span>
                <strong>₹{financials.costBreakdown.fertilizers?.toLocaleString()}</strong>
              </div>
              <div className="cost-tag">
                <span>💧 Irrigation &amp; Power:</span>
                <strong>₹{financials.costBreakdown.irrigation?.toLocaleString()}</strong>
              </div>
              <div className="cost-tag">
                <span>👨‍🌾 Labor &amp; Harvest:</span>
                <strong>₹{financials.costBreakdown.labor?.toLocaleString()}</strong>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Multi-Crop Comparative Profitability Table */}
      {topCrops.length > 1 && (
        <div className="comparative-profit-wrap">
          <h4 className="comparative-title">📊 Profit Comparison Across Top Suitable Crops for Your Land ({acres} Acres):</h4>
          <div className="comparative-cards-grid">
            {topCrops.map((c) => {
              const cInfo = CROP_INFO[c] || {}
              const cMkt = cInfo.market || {}
              const cYield = (cMkt.avgYieldQtlPerAcre || 10) * acres
              const cRev = cYield * (cMkt.forecastHarvestPrice || 3000)
              const cCost = (cMkt.costPerAcre?.total || 20000) * acres
              const cProfit = cRev - cCost
              const cRoi = cCost > 0 ? Math.round((cProfit / cCost) * 100) : 0

              return (
                <div
                  key={c}
                  className={`compare-crop-card ${selectedCrop === c ? 'active-compare' : ''}`}
                  onClick={() => setSelectedCrop(c)}
                >
                  <div className="compare-crop-header">
                    <span className="compare-emoji">{cInfo.emoji}</span>
                    <div>
                      <strong className="compare-name">{c}</strong>
                      <span className="compare-season">{cInfo.season}</span>
                    </div>
                  </div>
                  <div className="compare-profit-val">
                    ₹{Math.round(cProfit).toLocaleString('en-IN')}
                  </div>
                  <div className="compare-profit-sub">
                    ROI: <strong>{cRoi}%</strong> &bull; ₹{Math.round(cProfit / acres).toLocaleString('en-IN')}/ac
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
