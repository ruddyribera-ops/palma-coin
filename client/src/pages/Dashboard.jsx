import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../context/AuthContext'

export default function Dashboard() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const { isTeacher, user } = useAuth()

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

  if (loading) return <div className="empty-state">Cargando...</div>
  if (!stats) return <div className="empty-state">Error al cargar datos</div>

  const getRoleIcon = (role) => {
    switch (role) {
      case 'president': return '👑'
      case 'secretary': return '📋'
      case 'treasurer': return '💰'
      default: return '🎓'
    }
  }

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
            <h4>{stats.totalLikes.toLocaleString()}</h4>
            <p>Total Likes</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon hearts">❤️</div>
          <div className="stat-info">
            <h4>{stats.totalHearts.toLocaleString()}</h4>
            <p>Total Corazones</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon students">👥</div>
          <div className="stat-info">
            <h4>{stats.students.length}</h4>
            <p>Estudiantes</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon transactions">📝</div>
          <div className="stat-info">
            <h4>{stats.todayCount}</h4>
            <p>Hoy</p>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
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
                <div className="student-balances">
                  <span className="balance-item likes">👍 {student.likes_balance}</span>
                  <span className="balance-item hearts">❤️ {student.hearts_balance}</span>
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
              <div className="empty-state" style={{ padding: '2rem' }}>
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
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <Link to="/grid" className="btn btn-primary">
              📝 Registrar Hoy
            </Link>
            <Link to="/rewards" className="btn btn-gold">
              🎁 Gestionar Recompensas
            </Link>
            <Link to="/assemblies" className="btn btn-secondary">
              🗳️ Crear Asamblea
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}