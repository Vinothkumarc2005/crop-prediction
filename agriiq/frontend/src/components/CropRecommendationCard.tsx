import { useNavigate } from 'react-router-dom'
import RangeBar from './RangeBar'
import ConfidenceIndicator from './ConfidenceIndicator'
import { TrendingUp, AlertTriangle, Info, ChevronRight } from 'lucide-react'

interface CropCardProps {
  crop: any
  fieldId: string
}

const CROP_ICONS: Record<string, string> = {
  'Rice': '🌾', 'Wheat': '🌿', 'Maize': '🌽', 'Soybean': '🫘',
  'Cotton': '🌸', 'Groundnut': '🥜', 'Sugarcane': '🎋',
  'Tur (Arhar)': '🫛', 'Gram': '🟤',
}

const RISK_COLOR: Record<string, string> = {
  LOW: 'var(--color-primary)',
  MEDIUM: 'var(--color-accent)',
  HIGH: 'var(--color-danger)',
}

export default function CropRecommendationCard({ crop, fieldId }: CropCardProps) {
  const navigate = useNavigate()
  const yr = crop.yieldRange
  const pr = crop.profitRange
  const icon = CROP_ICONS[crop.crop] || '🌱'

  const fmtINR = (v: number) => {
    if (Math.abs(v) >= 100000) return `₹${(v/100000).toFixed(1)}L`
    if (Math.abs(v) >= 1000) return `₹${(v/1000).toFixed(1)}k`
    return `₹${v.toFixed(0)}`
  }

  return (
    <div className="card fade-in" style={{ position: 'relative', overflow: 'hidden' }}>
      {/* Rank badge */}
      <div style={{
        position: 'absolute', top: '1rem', right: '1rem',
        background: crop.rank === 1 ? 'rgba(245,158,11,0.2)' : 'rgba(255,255,255,0.05)',
        border: `1px solid ${crop.rank === 1 ? 'var(--color-accent)' : 'var(--border)'}`,
        borderRadius: '999px', padding: '0.15rem 0.625rem',
        fontSize: '0.75rem', fontWeight: 700,
        color: crop.rank === 1 ? 'var(--color-accent)' : 'var(--text-muted)',
      }}>
        #{crop.rank}
      </div>

      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <span style={{ fontSize: '2rem' }}>{icon}</span>
        <div>
          <h3 style={{ marginBottom: '0.125rem' }}>{crop.crop}</h3>
          <div className="flex items-center gap-2">
            <span className="badge badge-sky" style={{ fontSize: '0.72rem' }}>{crop.season || 'Kharif'}</span>
            <span
              className="badge"
              style={{
                background: `${RISK_COLOR[crop.riskLevel]}22`,
                color: RISK_COLOR[crop.riskLevel],
                fontSize: '0.72rem',
              }}
            >
              {crop.riskLevel === 'HIGH' && <AlertTriangle size={10} />}
              {crop.riskLevel} risk
            </span>
          </div>
        </div>
      </div>

      {/* Profit range — the hero metric */}
      {pr && (
        <div style={{ marginBottom: '1rem' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <TrendingUp size={12} /> Expected profit / hectare
          </div>
          <RangeBar
            min={pr.minProfit}
            median={pr.medProfit}
            max={pr.maxProfit}
            format={fmtINR}
            label="Profit Range"
          />
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.375rem' }}>
            Input cost: {fmtINR(pr.inputCost)} / ha · Mandi: ₹{crop.modalMandiPrice || '—'}/quintal
          </div>
        </div>
      )}

      {/* Yield range */}
      {yr && (
        <div style={{ marginBottom: '1rem' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
            Yield estimate (P10 / P50 / P90)
          </div>
          <RangeBar
            min={yr.p10}
            median={yr.p50}
            max={yr.p90}
            unit=" kg/ha"
            format={v => v.toFixed(0)}
          />
        </div>
      )}

      {/* Confidence */}
      <div className="flex items-center justify-between" style={{ marginBottom: '0.75rem' }}>
        <ConfidenceIndicator score={crop.confidenceScore || 0.7} />
      </div>

      {/* SHAP explanations */}
      {crop.explanations?.length > 0 && (
        <div style={{
          background: 'rgba(34,197,94,0.05)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          padding: '0.75rem',
          marginBottom: '0.75rem',
        }}>
          <div className="flex items-center gap-1" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.375rem' }}>
            <Info size={11} /> Why this crop?
          </div>
          {crop.explanations.slice(0, 2).map((ex: any, i: number) => (
            <div key={i} style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.2rem' }}>
              <span style={{ color: ex.direction === 'POSITIVE' ? 'var(--color-primary)' : 'var(--color-danger)' }}>
                {ex.direction === 'POSITIVE' ? '↑' : '↓'}
              </span>{' '}
              {ex.description}
            </div>
          ))}
        </div>
      )}

      {/* Risk reason */}
      {crop.riskReason && (
        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
          ⚠ {crop.riskReason}
        </div>
      )}

      {/* CTA */}
      <button
        className="btn btn-outline w-full"
        style={{ justifyContent: 'center' }}
        onClick={() => navigate(`/yield/${fieldId}/${encodeURIComponent(crop.crop)}`)}
      >
        Full Yield Analysis <ChevronRight size={15} />
      </button>
    </div>
  )
}
