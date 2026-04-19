import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Layout({ children }) {
  const { user, logout, isTeacher } = useAuth()
  const navigate = useNavigate()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  if (!user) return children

  const navItems = [
    { to: '/', icon: '📊', label: 'Dashboard' },
    { to: '/grid', icon: '📝', label: 'Registro' },
    { to: '/rewards', icon: '🎁', label: 'Recompensas' },
    { to: '/government', icon: '🏛️', label: 'Gobierno' },
    { to: '/assemblies', icon: '🗳️', label: 'Asambleas' },
    { to: '/students', icon: '👥', label: 'Estudiantes' },
    ...(isTeacher ? [{ to: '/manage-students', icon: '⚙️', label: 'Gestionar' }] : [])
  ]

  return (
    <div className="app">
      {/* Mobile Header */}
      <header className="mobile-header">
        <div className="mobile-header-inner">
          <NavLink to="/" className="nav-logo">
            <div className="nav-logo-icon">🌴</div>
            <span className="nav-logo-text">Palma<span>Coin</span></span>
          </NavLink>

          <div className="mobile-header-right">
            <div className="user-badge-mobile">
              {isTeacher ? '👨‍🏫' : '🎓'}
            </div>
            <button
              className="hamburger"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Menú"
            >
              <span className={`hamburger-line ${mobileMenuOpen ? 'open' : ''}`} />
              <span className={`hamburger-line ${mobileMenuOpen ? 'open' : ''}`} />
              <span className={`hamburger-line ${mobileMenuOpen ? 'open' : ''}`} />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Nav Drawer */}
      <div className={`mobile-nav-overlay ${mobileMenuOpen ? 'active' : ''}`} onClick={() => setMobileMenuOpen(false)} />
      <nav className={`mobile-nav-drawer ${mobileMenuOpen ? 'open' : ''}`}>
        <div className="mobile-nav-header">
          <span className="mobile-nav-title">Menú</span>
          <button className="mobile-nav-close" onClick={() => setMobileMenuOpen(false)}>×</button>
        </div>
        <div className="mobile-nav-items">
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `mobile-nav-item ${isActive ? 'active' : ''}`}
              onClick={() => setMobileMenuOpen(false)}
              end={item.to === '/'}
            >
              <span className="mobile-nav-icon">{item.icon}</span>
              <span className="mobile-nav-label">{item.label}</span>
            </NavLink>
          ))}
        </div>
        <div className="mobile-nav-footer">
          <button className="btn btn-secondary btn-block ripple" onClick={handleLogout}>
            🚪 Salir
          </button>
        </div>
      </nav>

      {/* Desktop Nav */}
      <nav className="nav desktop-nav">
        <div className="nav-inner">
          <NavLink to="/" className="nav-logo">
            <div className="nav-logo-icon">🌴</div>
            <span className="nav-logo-text">Palma<span>Coin</span></span>
          </NavLink>

          <div className="nav-links">
            {navItems.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                end={item.to === '/'}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </NavLink>
            ))}
          </div>

          <div className="nav-user">
            {isTeacher && (
              <div className="user-badge teacher">
                👨‍🏫 {user.name}
              </div>
            )}
            {!isTeacher && (
              <div className="user-badge">
                🎓 {user.name}
              </div>
            )}
            <button className="btn btn-sm btn-secondary ripple" onClick={handleLogout}>
              Salir
            </button>
          </div>
        </div>
      </nav>

      <main className="main">
        {children}
      </main>
    </div>
  )
}