import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Layout({ children }) {
  const { user, logout, isTeacher } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  if (!user) return children

  const navItems = [
    { to: '/', icon: '📊', label: 'Dashboard' },
    { to: '/grid', icon: '📝', label: 'Registro Diario' },
    { to: '/rewards', icon: '🎁', label: 'Recompensas' },
    { to: '/government', icon: '🏛️', label: 'Gobierno' },
    { to: '/assemblies', icon: '🗳️', label: 'Asambleas' },
    { to: '/students', icon: '👥', label: 'Estudiantes' },
    ...(isTeacher ? [{ to: '/manage-students', icon: '⚙️', label: 'Gestionar' }] : [])
  ]

  return (
    <div className="app">
      <nav className="nav">
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
            <button className="btn btn-sm btn-secondary" onClick={handleLogout}>
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