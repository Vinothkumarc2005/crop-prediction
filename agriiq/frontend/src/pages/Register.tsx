import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { authApi } from '../api/client'
import toast from 'react-hot-toast'
import { UserPlus } from 'lucide-react'

const INDIAN_STATES = ['Maharashtra', 'Punjab', 'Andhra Pradesh', 'Uttar Pradesh',
  'Madhya Pradesh', 'Rajasthan', 'Karnataka', 'Tamil Nadu', 'Gujarat', 'Haryana',
  'Bihar', 'West Bengal', 'Odisha', 'Telangana', 'Kerala', 'Chhattisgarh', 'Other']

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिंदी (Hindi)' },
  { code: 'mr', label: 'मराठी (Marathi)' },
  { code: 'te', label: 'తెలుగు (Telugu)' },
  { code: 'ta', label: 'தமிழ் (Tamil)' },
]

export default function Register() {
  const [form, setForm] = useState({
    fullName: '', email: '', password: '', phone: '',
    state: 'Maharashtra', district: '', language: 'en', role: 'FARMER',
  })
  const [loading, setLoading] = useState(false)
  const { setAuth } = useAuthStore()
  const navigate = useNavigate()

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm({ ...form, [k]: e.target.value })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const data = await authApi.register(form)
      setAuth(data.token, { email: data.email, fullName: data.fullName, role: data.role, language: data.language, userId: data.userId })
      toast.success('Account created! Welcome to AgriIQ 🌾')
      navigate('/fields/new')
    } catch (err: any) {
      const detail = err.response?.data?.detail
      let msg = 'Registration failed'
      if (typeof detail === 'string') msg = detail
      else if (Array.isArray(detail) && detail.length > 0) msg = detail.map((d: any) => d.msg).join(', ')
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
      <div className="card" style={{ width: '100%', maxWidth: '500px' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🌿</div>
          <h2>Create Your Account</h2>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.375rem', fontSize: '0.9rem' }}>
            Start getting AI crop recommendations for your fields
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
          <div className="grid-2" style={{ gap: '0.875rem' }}>
            <div className="form-group">
              <label className="label">Full Name</label>
              <input className="input" placeholder="Ramesh Patil" value={form.fullName} onChange={set('fullName')} required />
            </div>
            <div className="form-group">
              <label className="label">Phone</label>
              <input className="input" placeholder="+91 9876543210" value={form.phone} onChange={set('phone')} />
            </div>
          </div>
          <div className="form-group">
            <label className="label">Email</label>
            <input className="input" type="email" placeholder="you@example.com" value={form.email} onChange={set('email')} required />
          </div>
          <div className="form-group">
            <label className="label">Password</label>
            <input className="input" type="password" placeholder="Min 8 characters" value={form.password} onChange={set('password')} required minLength={8} />
            {form.password.length > 0 && form.password.length < 8 && (
              <span style={{ fontSize: '0.78rem', color: 'var(--color-danger)', marginTop: '0.25rem', display: 'block' }}>
                Password must be at least 8 characters ({8 - form.password.length} more needed)
              </span>
            )}
          </div>
          <div className="grid-2" style={{ gap: '0.875rem' }}>
            <div className="form-group">
              <label className="label">State</label>
              <select className="select" value={form.state} onChange={set('state')}>
                {INDIAN_STATES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="label">District</label>
              <input className="input" placeholder="e.g. Nashik" value={form.district} onChange={set('district')} />
            </div>
          </div>
          <div className="grid-2" style={{ gap: '0.875rem' }}>
            <div className="form-group">
              <label className="label">Language</label>
              <select className="select" value={form.language} onChange={set('language')}>
                {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="label">Role</label>
              <select className="select" value={form.role} onChange={set('role')}>
                <option value="FARMER">👨‍🌾 Farmer</option>
                <option value="AGRONOMIST">🔬 Agronomist</option>
              </select>
            </div>
          </div>

          <button type="submit" className="btn btn-primary" disabled={loading} style={{ marginTop: '0.5rem' }}>
            {loading ? <span className="spinner" style={{ width: 18, height: 18 }} /> : <UserPlus size={16} />}
            Create Account
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.88rem', color: 'var(--text-muted)' }}>
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  )
}
