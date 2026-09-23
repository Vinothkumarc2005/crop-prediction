import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { Sprout, LayoutDashboard, MapPin, TrendingUp, History, LogOut, LogIn, Menu, X } from 'lucide-react'
import { useState } from 'react'

export default function Navbar() {
  const { token, user, logout } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  const isActive = (path: string) => location.pathname.startsWith(path)

  const navItems = token ? [
    { to: '/dashboard', icon: <LayoutDashboard size={16} />, label: 'Dashboard' },
    { to: '/fields/new', icon: <MapPin size={16} />, label: 'Add Field' },
    { to: '/market', icon: <TrendingUp size={16} />, label: 'Market' },
    { to: '/history', icon: <History size={16} />, label: 'History' },
  ] : [
    { to: '/market', icon: <TrendingUp size={16} />, label: 'Market Prices' },
  ]

  return (
    <nav className="navbar">
      <div className="container flex items-center justify-between">
        <Link to="/" className="nav-logo flex items-center gap-2">
          <Sprout size={22} style={{ color: 'var(--color-primary)' }} />
          AgriIQ
        </Link>

        {/* Desktop nav */}
        <ul className="nav-links" style={{ display: 'flex' }}>
          {navItems.map(item => (
            <li key={item.to}>
              <Link
                to={item.to}
                className={`nav-link flex items-center gap-2 ${isActive(item.to) ? 'active' : ''}`}
              >
                {item.icon}
                {item.label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-3">
          {token ? (
            <>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                {user?.fullName?.split(' ')[0]}
              </span>
              <button className="btn btn-ghost btn-sm" onClick={handleLogout}>
                <LogOut size={15} /> Logout
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="btn btn-ghost btn-sm">
                <LogIn size={15} /> Login
              </Link>
              <Link to="/register" className="btn btn-primary btn-sm">
                Get Started
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  )
}
