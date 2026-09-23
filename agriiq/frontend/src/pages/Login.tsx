import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { authApi } from '../api/client'
import toast from 'react-hot-toast'
import { LogIn, Mail, Lock } from 'lucide-react'

export default function Login() {
  const [form, setForm] = useState({ email: '', password: '' })
  const [loading, setLoading] = useState(false)
  const { setAuth } = useAuthStore()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const data = await authApi.login(form)
      setAuth(data.token, { email: data.email, fullName: data.fullName, role: data.role, language: data.language, userId: data.userId })
      toast.success(`Welcome back, ${data.fullName.split(' ')[0]}!`)
      navigate('/dashboard')
    } catch (err: any) {
      const detail = err.response?.data?.detail
      let msg = 'Invalid email or password'
      if (typeof detail === 'string') msg = detail
      else if (Array.isArray(detail) && detail.length > 0) msg = detail.map((d: any) => d.msg).join(', ')
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
      <div className="card" style={{ width: '100%', maxWidth: '440px' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🌾</div>
          <h2>Welcome back</h2>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.375rem', fontSize: '0.9rem' }}>
            Sign in to your AgriIQ account
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="form-group">
            <label className="label"><Mail size={13} style={{ display: 'inline' }} /> Email</label>
            <input
              className="input"
              type="email"
              placeholder="you@example.com"
              value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
              required
            />
          </div>
          <div className="form-group">
            <label className="label"><Lock size={13} style={{ display: 'inline' }} /> Password</label>
            <input
              className="input"
              type="password"
              placeholder="••••••••"
              value={form.password}
              onChange={e => setForm({ ...form, password: e.target.value })}
              required
            />
          </div>

          <button type="submit" className="btn btn-primary" disabled={loading} style={{ marginTop: '0.5rem' }}>
            {loading ? <span className="spinner" style={{ width: 18, height: 18 }} /> : <LogIn size={16} />}
            Sign In
          </button>
        </form>

        {/* Demo credentials */}
        <div style={{
          marginTop: '1rem',
          padding: '0.75rem',
          background: 'rgba(34,197,94,0.06)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          fontSize: '0.8rem',
          color: 'var(--text-muted)',
        }}>
          <strong style={{ color: 'var(--text-secondary)' }}>Demo:</strong>{' '}
          farmer@agriiq.in / Farmer@123
        </div>

        <p style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.88rem', color: 'var(--text-muted)' }}>
          New to AgriIQ? <Link to="/register">Create an account</Link>
        </p>
      </div>
    </div>
  )
}
