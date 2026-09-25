import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import {
  Sprout, LayoutDashboard, MapPin, Leaf, TrendingUp,
  ClipboardList, FlaskConical, BarChart3, FileText,
  LogOut, LogIn, ChevronRight, Menu, X, Brain, User,
} from 'lucide-react'

interface NavItem {
  to: string
  icon: JSX.Element
  label: string
  badge?: string
}

const AUTH_NAV: NavItem[] = [
  { to: '/dashboard',    icon: <LayoutDashboard size={18} />, label: 'Dashboard' },
  { to: '/fields/new',   icon: <MapPin size={18} />,          label: 'Farm Map',         badge: 'Map' },
  { to: '/ndvi',         icon: <Leaf size={18} />,            label: 'NDVI Monitor' },
  { to: '/crop',         icon: <Brain size={18} />,           label: 'Crop Intelligence' },
  { to: '/weather-intel',icon: <TrendingUp size={18} />,      label: 'Weather Intel' },
  { to: '/market',       icon: <BarChart3 size={18} />,       label: 'Market Prices' },
  { to: '/fertilizer',   icon: <FlaskConical size={18} />,    label: 'Fertilizer Advisor' },
  { to: '/profitability',icon: <TrendingUp size={18} />,      label: 'Profitability' },
  { to: '/history',      icon: <ClipboardList size={18} />,   label: 'Farm History' },
]

const PUBLIC_NAV: NavItem[] = [
  { to: '/market', icon: <BarChart3 size={18} />, label: 'Market Prices' },
]

export default function Sidebar() {
  const { token, user, logout } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)

  const isActive = (path: string) =>
    path === '/dashboard'
      ? location.pathname === '/dashboard' || location.pathname.startsWith('/dashboard/')
      : location.pathname.startsWith(path)

  const navItems = token ? AUTH_NAV : PUBLIC_NAV

  const handleLogout = () => {
    logout()
    navigate('/')
    setMobileOpen(false)
  }

  // ── Public pages: use simple top navbar ───────────────────────────────────
  const isPublicPage = !token || ['/', '/login', '/register'].includes(location.pathname)
  if (isPublicPage) {
    return (
      <nav className="navbar">
        <div className="container flex items-center justify-between">
          <Link to="/" className="nav-logo flex items-center gap-2" onClick={() => setMobileOpen(false)}>
            <Sprout size={22} style={{ color: 'var(--color-primary)' }} />
            <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700 }}>AgriIQ</span>
          </Link>
          <div className="flex items-center gap-3">
            {token ? (
              <button className="btn btn-ghost btn-sm" onClick={handleLogout}>
                <LogOut size={15} /> Logout
              </button>
            ) : (
              <>
                <Link to="/login" className="btn btn-ghost btn-sm"><LogIn size={15} /> Login</Link>
                <Link to="/register" className="btn btn-primary btn-sm">Get Started</Link>
              </>
            )}
          </div>
        </div>
      </nav>
    )
  }

  // ── Authenticated app: sidebar layout ─────────────────────────────────────
  return (
    <>
      {/* Mobile header bar */}
      <header className="sidebar-mobile-header">
        <Link to="/dashboard" className="nav-logo flex items-center gap-2">
          <Sprout size={20} style={{ color: 'var(--color-primary)' }} />
          <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700 }}>AgriIQ</span>
        </Link>
        <button
          className="btn btn-ghost btn-sm sidebar-toggle"
          onClick={() => setMobileOpen(v => !v)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </header>

      {/* Backdrop for mobile */}
      {mobileOpen && (
        <div
          className="sidebar-backdrop"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`sidebar ${mobileOpen ? 'sidebar-open' : ''}`}>
        {/* Logo */}
        <div className="sidebar-logo">
          <Link to="/dashboard" className="flex items-center gap-2" onClick={() => setMobileOpen(false)}>
            <div className="sidebar-logo-icon">
              <Sprout size={20} />
            </div>
            <div>
              <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: '1.1rem', color: 'var(--text-primary)' }}>
                AgriIQ
              </div>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', letterSpacing: '0.06em' }}>
                AGRICULTURAL INTELLIGENCE
              </div>
            </div>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="sidebar-nav">
          <div className="sidebar-nav-label">Platform</div>
          {navItems.map(item => (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => setMobileOpen(false)}
              className={`sidebar-nav-item ${isActive(item.to) ? 'active' : ''}`}
            >
              <span className="sidebar-nav-icon">{item.icon}</span>
              <span className="sidebar-nav-text">{item.label}</span>
              {item.badge && (
                <span className="sidebar-nav-badge">{item.badge}</span>
              )}
              {isActive(item.to) && (
                <ChevronRight size={14} style={{ marginLeft: 'auto', opacity: 0.5 }} />
              )}
            </Link>
          ))}
        </nav>

        {/* User section at bottom */}
        <div className="sidebar-user">
          <div className="flex items-center gap-2" style={{ flex: 1, minWidth: 0 }}>
            <div className="sidebar-user-avatar">
              <User size={14} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user?.fullName || user?.email?.split('@')[0] || 'Farmer'}
              </div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user?.email || ''}
              </div>
            </div>
          </div>
          <button
            className="btn btn-ghost btn-sm"
            onClick={handleLogout}
            title="Logout"
            style={{ flexShrink: 0, padding: '0.35rem' }}
          >
            <LogOut size={15} />
          </button>
        </div>
      </aside>
    </>
  )
}
