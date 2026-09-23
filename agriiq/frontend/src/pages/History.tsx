import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fieldsApi, feedbackApi } from '../api/client'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { ClipboardList, Plus, TrendingUp, CheckCircle } from 'lucide-react'
import toast from 'react-hot-toast'

const CROPS = ['Rice', 'Wheat', 'Maize', 'Soybean', 'Cotton', 'Groundnut', 'Sugarcane', 'Tur (Arhar)', 'Gram']
const SEASONS = ['Kharif', 'Rabi', 'Zaid']

export default function History() {
  const [selectedFieldId, setSelectedFieldId] = useState<string>('')
  const [showLogForm, setShowLogForm] = useState(false)
  const [logForm, setLogForm] = useState({ crop: 'Rice', season: 'Kharif', year: new Date().getFullYear(), actualYieldKgHa: '', actualRevenue: '', notes: '' })
  const queryClient = useQueryClient()

  const { data: fields = [] } = useQuery<any[]>({
    queryKey: ['fields'],
    queryFn: fieldsApi.list,
  })

  useEffect(() => {
    if (fields.length > 0 && !selectedFieldId) {
      setSelectedFieldId(fields[0].id)
    }
  }, [fields, selectedFieldId])

  const { data: feedbackList = [], isLoading: fbLoading } = useQuery({
    queryKey: ['feedback', selectedFieldId],
    queryFn: () => feedbackApi.byField(selectedFieldId),
    enabled: !!selectedFieldId,
  })

  const { data: summary } = useQuery({
    queryKey: ['feedback-summary', selectedFieldId],
    queryFn: () => feedbackApi.summary(selectedFieldId),
    enabled: !!selectedFieldId,
  })

  const logMutation = useMutation({
    mutationFn: (data: any) => feedbackApi.log(data),
    onSuccess: () => {
      toast.success('Harvest logged successfully!')
      queryClient.invalidateQueries({ queryKey: ['feedback', selectedFieldId] })
      queryClient.invalidateQueries({ queryKey: ['feedback-summary', selectedFieldId] })
      setShowLogForm(false)
      setLogForm({ crop: 'Rice', season: 'Kharif', year: new Date().getFullYear(), actualYieldKgHa: '', actualRevenue: '', notes: '' })
    },
    onError: () => toast.error('Failed to log harvest'),
  })

  const handleLog = () => {
    if (!selectedFieldId) return
    logMutation.mutate({
      fieldId: selectedFieldId,
      ...logForm,
      actualYieldKgHa: logForm.actualYieldKgHa ? parseFloat(logForm.actualYieldKgHa) : null,
      actualRevenue: logForm.actualRevenue ? parseFloat(logForm.actualRevenue) : null,
    })
  }

  // Predicted vs Actual chart data from feedback list
  const chartData = feedbackList
    .filter((fb: any) => fb.actualYieldKgHa && fb.predictedYieldP50)
    .map((fb: any) => ({
      label: `${fb.crop} ${fb.year || ''}`,
      predicted: fb.predictedYieldP50,
      actual: fb.actualYieldKgHa,
      error: fb.predictionError,
    }))

  return (
    <div className="container section-sm">
      <div className="page-header">
        <h1 className="page-title">History & Feedback</h1>
        <p className="page-subtitle">Log actual harvest results to track prediction accuracy over time</p>
      </div>

      {/* Field selector */}
      <div className="flex items-center justify-between" style={{ marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <select className="select" style={{ width: 'auto' }} value={selectedFieldId} onChange={e => setSelectedFieldId(e.target.value)}>
          {fields.map((f: any) => <option key={f.id} value={f.id}>{f.name} — {f.district}</option>)}
        </select>
        <button className="btn btn-primary btn-sm" onClick={() => setShowLogForm(!showLogForm)}>
          <Plus size={15} /> Log Harvest
        </button>
      </div>

      {/* Log form */}
      {showLogForm && (
        <div className="card fade-in" style={{ marginBottom: '1.5rem' }}>
          <h4 style={{ marginBottom: '1rem' }}>Log Actual Harvest</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
            <div className="grid-2" style={{ gap: '0.875rem' }}>
              <div className="form-group">
                <label className="label">Crop</label>
                <select className="select" value={logForm.crop} onChange={e => setLogForm({ ...logForm, crop: e.target.value })}>
                  {CROPS.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="label">Season</label>
                <select className="select" value={logForm.season} onChange={e => setLogForm({ ...logForm, season: e.target.value })}>
                  {SEASONS.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div className="grid-2" style={{ gap: '0.875rem' }}>
              <div className="form-group">
                <label className="label">Year</label>
                <input className="input" type="number" value={logForm.year} onChange={e => setLogForm({ ...logForm, year: parseInt(e.target.value) })} min="2018" max="2030" />
              </div>
              <div className="form-group">
                <label className="label">Actual Yield (kg/ha)</label>
                <input className="input" type="number" placeholder="e.g. 2400" value={logForm.actualYieldKgHa} onChange={e => setLogForm({ ...logForm, actualYieldKgHa: e.target.value })} />
              </div>
            </div>
            <div className="form-group">
              <label className="label">Actual Revenue (INR, optional)</label>
              <input className="input" type="number" placeholder="e.g. 72000" value={logForm.actualRevenue} onChange={e => setLogForm({ ...logForm, actualRevenue: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="label">Notes</label>
              <input className="input" placeholder="e.g. Reduced due to pest damage in Aug" value={logForm.notes} onChange={e => setLogForm({ ...logForm, notes: e.target.value })} />
            </div>
            <div className="flex gap-3">
              <button className="btn btn-ghost" onClick={() => setShowLogForm(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleLog} disabled={logMutation.isPending}>
                {logMutation.isPending ? <span className="spinner" style={{ width: 16, height: 16 }} /> : <CheckCircle size={15} />}
                Save Harvest
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Predicted vs Actual chart */}
      {chartData.length > 0 && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div className="flex items-center gap-2" style={{ marginBottom: '1rem' }}>
            <TrendingUp size={18} style={{ color: 'var(--color-primary)' }} />
            <h4>Predicted vs. Actual Yield</h4>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="label" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
              <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
              <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} formatter={(v: any) => [`${v?.toFixed(0)} kg/ha`]} />
              <Bar dataKey="predicted" name="Predicted (P50)" fill="rgba(34,197,94,0.4)" radius={[4,4,0,0]} />
              <Bar dataKey="actual" name="Actual" fill="var(--color-primary)" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
            ▪ Light green = model P50 prediction &nbsp; ▪ Solid green = actual harvest
          </p>
        </div>
      )}

      {/* Summary stats */}
      {summary && summary.cropAccuracies?.length > 0 && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h4 style={{ marginBottom: '1rem' }}>Accuracy Summary</h4>
          <div className="grid-3">
            {summary.cropAccuracies.map((ca: any) => (
              <div key={ca.crop} className="stat-card">
                <span className="stat-label">{ca.crop}</span>
                <span className="stat-value" style={{ fontSize: '1.2rem' }}>
                  {ca.avgActual?.toFixed(0)} <span style={{ fontSize: '0.75rem', fontWeight: 400, color: 'var(--text-muted)' }}>kg/ha avg</span>
                </span>
                <span className="stat-change">{ca.count} seasons logged</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* History table */}
      <div className="card">
        <h4 style={{ marginBottom: '1rem' }}>
          <ClipboardList size={16} style={{ display: 'inline', marginRight: '0.375rem', color: 'var(--color-primary)' }} />
          Harvest Log ({feedbackList.length} entries)
        </h4>
        {fbLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}><span className="spinner" /></div>
        ) : feedbackList.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📋</div>
            <p>No harvests logged yet.</p>
            <p style={{ fontSize: '0.82rem', marginTop: '0.375rem' }}>Click "Log Harvest" to record your first result.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Crop', 'Season', 'Year', 'Actual Yield', 'Revenue', 'Pred. Error', 'Notes'].map(h => (
                    <th key={h} style={{ padding: '0.625rem 0.75rem', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 500, fontSize: '0.78rem', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {feedbackList.map((fb: any, i: number) => (
                  <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                    <td style={{ padding: '0.625rem 0.75rem', fontWeight: 600 }}>{fb.crop}</td>
                    <td style={{ padding: '0.625rem 0.75rem' }}><span className="badge badge-sky" style={{ fontSize: '0.72rem' }}>{fb.season}</span></td>
                    <td style={{ padding: '0.625rem 0.75rem', color: 'var(--text-muted)' }}>{fb.year}</td>
                    <td style={{ padding: '0.625rem 0.75rem', color: 'var(--color-primary)', fontWeight: 600 }}>{fb.actualYieldKgHa?.toFixed(0)} kg/ha</td>
                    <td style={{ padding: '0.625rem 0.75rem' }}>{fb.actualRevenue ? `₹${(fb.actualRevenue/1000).toFixed(1)}k` : '—'}</td>
                    <td style={{ padding: '0.625rem 0.75rem', color: fb.predictionError > 0 ? 'var(--color-primary)' : 'var(--color-danger)' }}>
                      {fb.predictionError != null ? `${fb.predictionError > 0 ? '+' : ''}${fb.predictionError.toFixed(0)}` : '—'}
                    </td>
                    <td style={{ padding: '0.625rem 0.75rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>{fb.notes || '—'}</td>
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
