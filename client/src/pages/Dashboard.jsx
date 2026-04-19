import { useEffect, useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../context/AuthContext'

// Animated counter hook
function useAnimatedCounter(end, duration = 1000, delay = 0) {
  const [count, setCount] = useState(0)
  const [started, setStarted] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started) {
          setStarted(true)
        }
      },
      { threshold: 0.5 }
    )

    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [started])

  useEffect(() => {
    if (!started) return
    const timeout = setTimeout(() => {
      const startTime = performance.now()
      const step = (timestamp) => {
        const elapsed = timestamp - startTime
        const progress = Math.min(elapsed / duration, 1)
        const eased = 1 - Math.pow(1 - progress, 3)
        setCount(Math.floor(eased * end))
        if (progress < 1) requestAnimationFrame(step)
      }
      requestAnimationFrame(step)
    }, delay)
    return () => clearTimeout(timeout)
  }, [started, end, duration, delay])

  return { count, ref }
}

// Progress bar component
function ProgressBar({ value, max, type }) {
  const [width, setWidth] = useState(0)
  const ref = useRef(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setTimeout(() => setWidth((value / max) * 100), 100)
        }
      },
      { threshold: 0.5 }
    )
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [value, max])

  return (
    <div className="progress-bar-container" ref={ref}>
      <div className="progress-bar-track">
        <div
          className={`progress-bar-fill ${type}`}
          style={{ width: `${width}%` }}
          data-empty={value === 0 ? 'true' : undefined}
        />
      </div>
      <span style={{ fontWeight: 700, fontSize: '0.85rem', minWidth: '40px' }}>{value}</span>
    </div>
  )
}

export default function Dashboard() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const { isTeacher, user } = useAuth()

  const likesCounter = useAnimatedCounter(stats?.totalLikes || 0, 1200, 0)
  const heartsCounter = useAnimatedCounter(stats?.totalHearts || 0, 1200, 200)
  const studentsCounter = useAnimatedCounter(stats?.students?.length || 0, 800, 400)
  const todayCounter = useAnimatedCounter(stats?.todayCount || 0, 800, 600)

  const loadStats = async () => {
    try {
      const data = await api.getStats()
      setStats(data)
    } catch (err) {
      console.error('Failed to load stats:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadStats()
    const handleRefresh = () => loadStats()
    window.addEventListener('palma_refresh', handleRefresh)
    return () => window.removeEventListener('palma_refresh', handleRefresh)
  }, [])

  const getRoleIcon = (role) => {
    switch (role) {
      case 'president': return '👑'
      case 'secretary': return '📋'
      case 'treasurer': return '💰'
      default: return '🎓'
    }
  }

  if (loading) return (
    <div style={{ padding: '2rem' }}>
      <div className="skeleton-card" style={{ marginBottom: '1.5rem' }}>
        <div className="skeleton skeleton-line" style={{ width: '60%' }} />
        <div className="skeleton skeleton-line" style={{ width: '40%' }} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
        {[...Array(4)].map((_, i) => (
          <div key={i} className="skeleton-card" style={{ height: '120px' }} />
        ))}
      </div>
    </div>
  )

  if (!stats) return (
    <div className="empty-state-container">
      <div className="empty-state-icon-animated">😕</div>
      <h3>Error al cargar datos</h3>
      <p>No pudimos obtener la información del servidor.</p>
      <button className="btn btn-primary" onClick={loadStats}>Reintentar</button>
    </div>
  )

  return (
    <div>
      <div className="page-header">
        <div className="page-title">
          <div className="page-title-icon">📊</div>
          <div>
            <h1>Dashboard</h1>
            <p className="page-subtitle">Resumen del sistema Palma Coin</p>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="stats-grid" style={{ marginBottom: '2rem' }}>
        <div className="stat-card">
          <div className="stat-icon likes">👍</div>
          <div className="stat-info">
            <h4 ref={likesCounter.ref} className="counter-number animate-count">{likesCounter.count.toLocaleString()}</h4>
            <p>Total Likes</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon hearts">❤️</div>
          <div className="stat-info">
            <h4 ref={heartsCounter.ref} className="counter-number animate-count">{heartsCounter.count.toLocaleString()}</h4>
            <p>Total Corazones</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon students">👥</div>
          <div className="stat-info">
            <h4 ref={studentsCounter.ref} className="counter-number animate-count">{studentsCounter.count}</h4>
            <p>Estudiantes</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon transactions">📝</div>
          <div className="stat-info">
            <h4 ref={todayCounter.ref} className="counter-number animate-count">{todayCounter.count}</h4>
            <p>Hoy</p>
          </div>
        </div>
      </div>

      <div className="dashboard-grid">
        {/* Top Students */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">
              <span>🏆</span> Top Estudiantes
            </h3>
            <Link to="/students" className="btn btn-sm btn-secondary">Ver todos</Link>
          </div>
          <div className="card-body" style={{ padding: '0.75rem' }}>
            {stats.topStudents.map((student, index) => (
              <div key={student.id} className="student-card" style={{ marginBottom: '0.5rem' }}>
                <div className={`student-rank ${index === 0 ? 'gold' : index === 1 ? 'silver' : index === 2 ? 'bronze' : ''}`}>
                  {index + 1}
                </div>
                <div className="student-info">
                  <h4>{student.name}</h4>
                  <p>{getRoleIcon(student.role)} {student.role || 'Estudiante'}</p>
                </div>
                <div className="student-balances" style={{ flexDirection: 'column', gap: '0.25rem' }}>
                  <ProgressBar value={student.likes_balance} max={Math.max(...stats.students.map(s => s.likes_balance), 1)} type="likes" />
                  <ProgressBar value={student.hearts_balance} max={Math.max(...stats.students.map(s => s.hearts_balance), 1)} type="hearts" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">
              <span>⚡</span> Actividad Reciente
            </h3>
          </div>
          <div className="card-body">
            {stats.recentTransactions.length === 0 ? (
              <div className="empty-state-container">
                <div className="empty-state-icon-animated" style={{ fontSize: '3rem' }}>📝</div>
                <p>Sin actividad reciente</p>
              </div>
            ) : (
              stats.recentTransactions.slice(0, 8).map(tx => (
                <div key={tx.id} style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.75rem 0',
                  borderBottom: '1px solid rgba(0,0,0,0.05)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ fontSize: '1.2rem' }}>
                      {tx.type === 'like' ? '👍' : '❤️'}
                    </span>
                    <div>
                      <p style={{ fontWeight: 600 }}>{tx.student_name}</p>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {tx.reason || tx.subject_name || tx.type}
                      </p>
                    </div>
                  </div>
                  <span style={{
                    fontWeight: 800,
                    color: tx.type === 'like' ? 'var(--like-blue)' : 'var(--heart-red)'
                  }}>
                    +{tx.amount}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      {isTeacher && (
        <div style={{ marginTop: '2rem' }}>
          <h3 style={{ marginBottom: '1rem' }}>Acciones Rápidas</h3>
          <div className="quick-actions" style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap' }}>
            <Link to="/grid" className="btn btn-primary ripple">
              📝 Registrar Hoy
            </Link>
            <Link to="/rewards" className="btn btn-gold ripple">
              🎁 Gestionar Recompensas
            </Link>
            <Link to="/assemblies" className="btn btn-secondary ripple">
              🗳️ Crear Asamblea
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}