import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { mandiApi } from '../api/client'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Search, TrendingUp } from 'lucide-react'

const INDIAN_STATES = ['Maharashtra', 'Punjab', 'Andhra Pradesh', 'Uttar Pradesh', 'Karnataka']
const DISTRICTS: Record<string, string[]> = {
  'Maharashtra':    ['Nashik', 'Pune', 'Aurangabad', 'Nagpur', 'Solapur'],
  'Punjab':         ['Amritsar', 'Ludhiana', 'Patiala', 'Jalandhar'],
  'Andhra Pradesh': ['Guntur', 'Krishna', 'Prakasam', 'Kurnool'],
  'Uttar Pradesh':  ['Varanasi', 'Agra', 'Meerut', 'Lucknow'],
  'Karnataka':      ['Dharwad', 'Belgaum', 'Mysuru', 'Hassan'],
}

export default function MarketPrices() {
  const [filters, setFilters] = useState({ commodity: '', state: 'Maharashtra', district: 'Nashik' })
  const [trendCrop, setTrendCrop] = useState('Rice')

  const { data: rawCommodities = [] } = useQuery({
    queryKey: ['commodities'],
    queryFn: mandiApi.commodities,
  })
  const commodities: string[] = Array.isArray(rawCommodities)
    ? rawCommodities
    : ((rawCommodities as any)?.value || [])

  const { data: rawPrices = [], isLoading } = useQuery({
    queryKey: ['mandi', filters],
    queryFn: () => mandiApi.search({ commodity: filters.commodity, district: filters.district, state: filters.state }),
  })
  const prices: any[] = Array.isArray(rawPrices)
    ? rawPrices
    : ((rawPrices as any)?.prices || [])

  const { data: rawTrend = [] } = useQuery({
    queryKey: ['trend', trendCrop, filters.district],
    queryFn: () => mandiApi.trend(trendCrop, filters.district),
  })
  const trendSeries: any[] = Array.isArray(rawTrend)
    ? rawTrend
    : ((rawTrend as any)?.series || [])

  const chartData = [...trendSeries].reverse().map((p: any) => ({
    date: p.date ? String(p.date).substring(5) : '',
    modal: Number(p.modalPrice || 0),
    min: Number(p.minPrice || 0),
    max: Number(p.maxPrice || 0),
  }))

  const districts = DISTRICTS[filters.state] || ['District']

  return (
    <div className="container section-sm">
      <div className="page-header">
        <h1 className="page-title">Market Prices</h1>
        <p className="page-subtitle">Live mandi commodity prices from Agmarknet (mock in dev mode)</p>
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="form-group" style={{ flex: '1', minWidth: '160px' }}>
            <label className="label">Commodity</label>
            <select className="select" value={filters.commodity} onChange={e => setFilters({ ...filters, commodity: e.target.value })}>
              <option value="">All Commodities</option>
              {commodities.map((c: string) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ flex: '1', minWidth: '140px' }}>
            <label className="label">State</label>
            <select className="select" value={filters.state} onChange={e => setFilters({ ...filters, state: e.target.value, district: DISTRICTS[e.target.value]?.[0] || '' })}>
              {INDIAN_STATES.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ flex: '1', minWidth: '140px' }}>
            <label className="label">District</label>
            <select className="select" value={filters.district} onChange={e => setFilters({ ...filters, district: e.target.value })}>
              {districts.map(d => <option key={d}>{d}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Price trend chart */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="flex items-center justify-between" style={{ marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div className="flex items-center gap-2">
            <TrendingUp size={18} style={{ color: 'var(--color-accent)' }} />
            <h4>Price Trend</h4>
          </div>
          <select className="select" style={{ width: 'auto' }} value={trendCrop} onChange={e => setTrendCrop(e.target.value)}>
            {(commodities.length > 0 ? commodities : ['Rice', 'Wheat', 'Cotton', 'Soybean']).map((c: string) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="date" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
              <YAxis tickFormatter={v => `₹${v}`} tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
              <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} formatter={(v: any) => [`₹${v}/qtl`]} />
              <Line type="monotone" dataKey="max" stroke="rgba(34,197,94,0.3)" strokeDasharray="4 2" dot={false} />
              <Line type="monotone" dataKey="modal" stroke="var(--color-accent)" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="min" stroke="rgba(248,113,113,0.4)" strokeDasharray="4 2" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>No trend data for {trendCrop} in {filters.district}</p>
        )}
        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
          ▬ Modal price &nbsp; ╌ Max price &nbsp; ╌ Min price · INR/quintal
        </p>
      </div>

      {/* Prices table */}
      <div className="card">
        <h4 style={{ marginBottom: '1rem' }}>
          {isLoading ? 'Loading…' : `${prices.length} price records`}
          {filters.commodity && ` · ${filters.commodity}`}
          {` · ${filters.district}`}
        </h4>

        {isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}><span className="spinner" /></div>
        ) : prices.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>No prices found for this combination</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Commodity', 'Market', 'Date', 'Min ₹/qtl', 'Modal ₹/qtl', 'Max ₹/qtl'].map(h => (
                    <th key={h} style={{ padding: '0.625rem 0.75rem', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 500, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {prices.slice(0, 50).map((p: any, i: number) => (
                  <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                    <td style={{ padding: '0.625rem 0.75rem', fontWeight: 600 }}>{p.commodity}</td>
                    <td style={{ padding: '0.625rem 0.75rem', color: 'var(--text-secondary)' }}>{p.market}</td>
                    <td style={{ padding: '0.625rem 0.75rem', color: 'var(--text-muted)' }}>{p.priceDate}</td>
                    <td style={{ padding: '0.625rem 0.75rem', color: 'var(--color-danger)' }}>₹{p.minPrice}</td>
                    <td style={{ padding: '0.625rem 0.75rem', color: 'var(--color-accent)', fontWeight: 700 }}>₹{p.modalPrice}</td>
                    <td style={{ padding: '0.625rem 0.75rem', color: 'var(--color-primary)' }}>₹{p.maxPrice}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
