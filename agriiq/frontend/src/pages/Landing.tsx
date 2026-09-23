import { Link } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { Sprout, TrendingUp, Shield, Zap, Globe, ChevronRight, Check } from 'lucide-react'

const FEATURES = [
  {
    icon: <TrendingUp size={22} />,
    title: 'Confidence Intervals',
    desc: 'Every yield and profit estimate shown as P10/P50/P90 range — never a bare number.',
  },
  {
    icon: <Zap size={22} />,
    title: 'SHAP Explainability',
    desc: 'See exactly why a crop is recommended — NDVI trend, soil N, pH, crop rotation.',
  },
  {
    icon: <Shield size={22} />,
    title: 'Profitability First',
    desc: 'Ranking by profit range after deducting input costs, not just agronomic yield.',
  },
  {
    icon: <Globe size={22} />,
    title: 'Live Mandi Prices',
    desc: 'Recommendations tied to current Agmarknet market prices for your district.',
  },
]

const CROPS = [
  { name: 'Rice', icon: '🌾', season: 'Kharif' },
  { name: 'Wheat', icon: '🌿', season: 'Rabi' },
  { name: 'Cotton', icon: '🌸', season: 'Kharif' },
  { name: 'Soybean', icon: '🫘', season: 'Kharif' },
  { name: 'Groundnut', icon: '🥜', season: 'Kharif' },
  { name: 'Gram', icon: '🟤', season: 'Rabi' },
]

export default function Landing() {
  const token = useAuthStore(s => s.token)

  return (
    <div>
      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <section style={{
        minHeight: '90vh',
        display: 'flex',
        alignItems: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Background gradient orbs */}
        <div style={{
          position: 'absolute', top: '-20%', left: '-10%',
          width: '600px', height: '600px', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(34,197,94,0.12) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', bottom: '-20%', right: '-10%',
          width: '500px', height: '500px', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(245,158,11,0.08) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        <div className="container" style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ maxWidth: '760px' }}>
            <div className="flex items-center gap-2" style={{ marginBottom: '1.5rem' }}>
              <span className="badge badge-green">
                <Sprout size={12} /> AI-Powered Crop Advisory
              </span>
              <span className="badge badge-amber">India 🇮🇳</span>
            </div>

            <h1 style={{ marginBottom: '1.25rem', lineHeight: 1.1 }}>
              Know What to Plant.<br />
              <span style={{
                background: 'linear-gradient(135deg, var(--color-primary-light), var(--color-accent))',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}>Know How Much You'll Earn.</span>
            </h1>

            <p style={{ fontSize: '1.15rem', color: 'var(--text-secondary)', marginBottom: '2rem', maxWidth: '560px', lineHeight: 1.7 }}>
              AgriIQ fuses satellite vegetation data (NDVI), soil properties, and district mandi
              prices to recommend the most <strong>profitable crop</strong> for your field —
              with confidence intervals, not guesses.
            </p>

            <div className="flex items-center gap-4" style={{ flexWrap: 'wrap' }}>
              {token ? (
                <Link to="/dashboard" className="btn btn-primary btn-lg pulse-glow">
                  Go to Dashboard <ChevronRight size={18} />
                </Link>
              ) : (
                <>
                  <Link to="/register" className="btn btn-primary btn-lg pulse-glow">
                    Get Started Free <ChevronRight size={18} />
                  </Link>
                  <Link to="/market" className="btn btn-outline btn-lg">
                    View Market Prices
                  </Link>
                </>
              )}
            </div>

            {/* Confidence preview */}
            <div className="card-glass" style={{ marginTop: '2.5rem', maxWidth: '480px' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                Sample recommendation preview
              </div>
              <div className="flex items-center gap-3" style={{ marginBottom: '0.75rem' }}>
                <span style={{ fontSize: '1.5rem' }}>🌾</span>
                <div>
                  <div style={{ fontWeight: 700 }}>Soybean — Kharif</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--color-primary)' }}>Rank #1 by profitability</div>
                </div>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.375rem' }}>Profit range / hectare</div>
              {/* Mini range bar */}
              <div style={{ height: '8px', background: 'rgba(255,255,255,0.07)', borderRadius: '999px', position: 'relative', marginBottom: '0.5rem' }}>
                <div style={{ position: 'absolute', left: 0, right: 0, height: '100%', background: 'linear-gradient(90deg, var(--color-accent), var(--color-primary))', borderRadius: '999px' }} />
                <div style={{ position: 'absolute', left: '58%', top: '-3px', width: '14px', height: '14px', borderRadius: '50%', background: 'white', border: '2px solid var(--color-primary)', transform: 'translateX(-50%)' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 600 }}>
                <span style={{ color: 'var(--color-danger)' }}>₹18.2k</span>
                <span>₹32.5k <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: '0.7rem' }}>median</span></span>
                <span style={{ color: 'var(--color-primary)' }}>₹48.1k</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Features ───────────────────────────────────────────────────── */}
      <section className="section" style={{ borderTop: '1px solid var(--border)' }}>
        <div className="container">
          <div className="text-center" style={{ marginBottom: '3rem' }}>
            <h2>Built for Indian Farmers</h2>
            <p style={{ color: 'var(--text-secondary)', marginTop: '0.75rem', fontSize: '1rem' }}>
              Every recommendation is backed by data, explained in plain language, and tied to your local mandi.
            </p>
          </div>
          <div className="grid-2" style={{ gap: '1.5rem' }}>
            {FEATURES.map((f, i) => (
              <div key={i} className="card fade-in" style={{ display: 'flex', gap: '1rem' }}>
                <div style={{
                  flexShrink: 0,
                  width: '48px', height: '48px',
                  background: 'rgba(34,197,94,0.1)',
                  borderRadius: 'var(--radius)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--color-primary)',
                }}>
                  {f.icon}
                </div>
                <div>
                  <h4 style={{ marginBottom: '0.375rem' }}>{f.title}</h4>
                  <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Supported crops ─────────────────────────────────────────────── */}
      <section className="section-sm" style={{ borderTop: '1px solid var(--border)' }}>
        <div className="container">
          <h3 style={{ marginBottom: '1.25rem', textAlign: 'center' }}>9 Major Crops Covered</h3>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
            {CROPS.map(c => (
              <div key={c.name} className="card" style={{ padding: '1rem 1.5rem', textAlign: 'center', minWidth: '110px' }}>
                <div style={{ fontSize: '1.8rem', marginBottom: '0.25rem' }}>{c.icon}</div>
                <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{c.name}</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{c.season}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA footer ──────────────────────────────────────────────────── */}
      <section className="section" style={{ borderTop: '1px solid var(--border)', textAlign: 'center' }}>
        <div className="container">
          <h2 style={{ marginBottom: '1rem' }}>Ready to grow smarter?</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
            Draw your field on the map and get your first recommendation in minutes.
          </p>
          {!token && (
            <Link to="/register" className="btn btn-primary btn-lg">
              Start for free — no API keys needed
            </Link>
          )}
          {token && (
            <Link to="/fields/new" className="btn btn-primary btn-lg">
              <Sprout size={18} /> Add Your First Field
            </Link>
          )}
        </div>
      </section>
    </div>
  )
}
