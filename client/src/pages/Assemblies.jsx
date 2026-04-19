import { useEffect, useState } from 'react'
import { api } from '../api'
import { useAuth } from '../context/AuthContext'

export default function Assemblies() {
  const [assemblies, setAssemblies] = useState([])
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ title: '', description: '', date: new Date().toISOString().split('T')[0] })
  const [votedId, setVotedId] = useState(null)
  const { isTeacher, user } = useAuth()

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [assembliesData, studentsData] = await Promise.all([
        api.getAssemblies(),
        api.getStudents()
      ])
      setAssemblies(assembliesData)
      setStudents(studentsData)
    } catch (err) {
      console.error('Failed to load:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      await api.addAssembly(form)
      setShowModal(false)
      setForm({ title: '', description: '', date: new Date().toISOString().split('T')[0] })
      loadData()
    } catch (err) {
      alert('Error: ' + err.message)
    }
  }

  const handleVote = async (assemblyId, vote) => {
    const student = students.find(s => s.name === user.name)
    if (!student) {
      alert('No se encontró tu perfil de estudiante')
      return
    }

    try {
      await api.voteAssembly(assemblyId, { student_id: student.id, vote })
      setVotedId(assemblyId)
      setTimeout(() => setVotedId(null), 3000)
      loadData()
    } catch (err) {
      alert(err.message)
    }
  }

  const handleCloseAssembly = async (assemblyId) => {
    if (!confirm('¿Estás seguro de que deseas cerrar esta asamblea? Ya no se podrán emitir más votos.')) {
      return
    }
    try {
      await api.closeAssembly(assemblyId)
      loadData()
    } catch (err) {
      alert(err.message)
    }
  }

  if (loading) return (
    <div style={{ padding: '2rem' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {[...Array(3)].map((_, i) => (
          <div key={i} className="skeleton-card" style={{ height: '200px' }} />
        ))}
      </div>
    </div>
  )

  return (
    <div>
      <div className="page-header">
        <div className="page-title">
          <div className="page-title-icon">🗳️</div>
          <div>
            <h1>Asambleas</h1>
            <p className="page-subtitle">Votaciones y decisiones del gobierno estudiantil</p>
          </div>
        </div>
      </div>

      {isTeacher && (
        <div style={{ marginBottom: '1.5rem' }}>
          <button className="btn btn-primary ripple" onClick={() => setShowModal(true)}>
            ➕ Crear Asamblea
          </button>
        </div>
      )}

      {/* Assemblies List */}
      {assemblies.length === 0 ? (
        <div className="card">
          <div className="empty-state-container">
            <div className="empty-state-icon-animated">🗳️</div>
            <h3>No hay asambleas</h3>
            <p>Las asambleas son creadas por el docente para votar decisiones importantes del curso.</p>
            {isTeacher && (
              <button className="btn btn-primary ripple" onClick={() => setShowModal(true)}>
                ➕ Crear primera asamblea
              </button>
            )}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {assemblies.map(assembly => (
            <div key={assembly.id} className="card">
              <div className="card-header">
                <div>
                  <h3 className="card-title">
                    <span>📋</span> {assembly.title}
                  </h3>
                  <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                    {new Date(assembly.date).toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                  </p>
                </div>
                <div className={`assembly-status ${assembly.status}`}>
                  {assembly.status === 'active' ? (
                    <>
                      <span>🟢</span> Activa
                    </>
                  ) : (
                    <>
                      <span>🔴</span> Cerrada
                    </>
                  )}
                </div>
              </div>
              <div className="card-body">
                {assembly.description && (
                  <p style={{ marginBottom: '1.25rem', color: 'var(--text-secondary)' }}>{assembly.description}</p>
                )}

                {/* Vote Tally */}
                {assembly.vote_count > 0 && (
                  <div style={{
                    display: 'flex',
                    gap: '2rem',
                    padding: '1.25rem',
                    background: 'var(--bg-primary)',
                    borderRadius: 'var(--radius-lg)',
                    marginBottom: '1rem',
                    flexWrap: 'wrap'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <span style={{ fontSize: '1.5rem' }}>✅</span>
                      <div>
                        <div style={{ fontWeight: 800, color: 'var(--palm-green)', fontSize: '1.3rem' }}>{assembly.yes_votes || 0}</div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>A favor</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <span style={{ fontSize: '1.5rem' }}>❌</span>
                      <div>
                        <div style={{ fontWeight: 800, color: 'var(--ig-red)', fontSize: '1.3rem' }}>{assembly.no_votes || 0}</div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>En contra</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <span style={{ fontSize: '1.5rem' }}>⬜</span>
                      <div>
                        <div style={{ fontWeight: 800, color: 'var(--text-secondary)', fontSize: '1.3rem' }}>{assembly.abstain_votes || 0}</div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Abstención</div>
                      </div>
                    </div>
                    <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontWeight: 800, fontSize: '1.1rem' }}>{assembly.vote_count}</span>
                      <span style={{ color: 'var(--text-muted)' }}>votos totales</span>
                    </div>
                  </div>
                )}

                {/* Vote animation overlay */}
                {votedId === assembly.id && (
                  <div className="vote-confirmed" style={{ marginBottom: '1rem' }}>
                    <div className="vote-confirmed-icon">✅</div>
                    <span>¡Tu voto ha sido registrado!</span>
                  </div>
                )}

                {/* Voting buttons */}
                {assembly.status === 'active' && !assembly.user_vote && (
                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button
                      className="btn btn-primary ripple"
                      onClick={() => handleVote(assembly.id, 'yes')}
                      style={{ flex: 1 }}
                    >
                      ✅ A favor
                    </button>
                    <button
                      className="btn btn-secondary ripple"
                      onClick={() => handleVote(assembly.id, 'no')}
                      style={{ flex: 1 }}
                    >
                      ❌ En contra
                    </button>
                    <button
                      className="btn btn-secondary ripple"
                      onClick={() => handleVote(assembly.id, 'abstain')}
                      style={{ flex: 1 }}
                    >
                      ⬜ Abstención
                    </button>
                  </div>
                )}

                {/* User already voted */}
                {assembly.user_vote && assembly.status === 'active' && (
                  <div style={{
                    padding: '1rem',
                    background: 'rgba(24, 119, 242, 0.08)',
                    borderRadius: 'var(--radius-md)',
                    textAlign: 'center',
                    color: 'var(--ig-blue)',
                    fontWeight: 600
                  }}>
                    ✓ Ya emitiste tu voto en esta asamblea
                  </div>
                )}

                {/* Teacher: close button */}
                {isTeacher && assembly.status === 'active' && (
                  <div style={{ marginTop: '1rem', textAlign: 'right' }}>
                    <button
                      className="btn btn-sm ripple"
                      onClick={() => handleCloseAssembly(assembly.id)}
                      style={{ background: 'var(--gradient-red)', color: 'white' }}
                    >
                      🔒 Cerrar Asamblea
                    </button>
                  </div>
                )}

                {/* Closed message */}
                {assembly.status === 'closed' && (
                  <div style={{
                    padding: '1rem',
                    background: 'rgba(100, 100, 100, 0.08)',
                    borderRadius: 'var(--radius-md)',
                    textAlign: 'center',
                    color: 'var(--text-muted)'
                  }}>
                    <span style={{ fontSize: '1.2rem', marginRight: '0.5rem' }}>🔒</span>
                    Esta asamblea ha sido cerrada
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Assembly Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Crear Asamblea</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Título</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Ej: Votación para picnic de fin de mes"
                    value={form.title}
                    onChange={e => setForm({ ...form, title: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Descripción</label>
                  <textarea
                    className="form-textarea"
                    placeholder="Describe el tema a votar..."
                    value={form.description}
                    onChange={e => setForm({ ...form, description: e.target.value })}
                    rows={4}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Fecha</label>
                  <input
                    type="date"
                    className="form-input"
                    value={form.date}
                    onChange={e => setForm({ ...form, date: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Crear</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}