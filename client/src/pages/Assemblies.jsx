import { useEffect, useState } from 'react'
import { api } from '../api'
import { useAuth } from '../context/AuthContext'

export default function Assemblies() {
  const [assemblies, setAssemblies] = useState([])
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ title: '', description: '', date: new Date().toISOString().split('T')[0] })
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
      loadData()
    } catch (err) {
      alert(err.message)
    }
  }

  if (loading) return <div className="empty-state">Cargando...</div>

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
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            ➕ Crear Asamblea
          </button>
        </div>
      )}

      {/* Assemblies List */}
      {assemblies.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">🗳️</div>
            <h3>No hay asambleas</h3>
            <p>Aún no se ha creado ninguna asamblea</p>
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
                    {new Date(assembly.date).toLocaleDateString()}
                  </p>
                </div>
                <span className={`badge ${assembly.status === 'active' ? 'badge-success' : 'badge-warning'}`}>
                  {assembly.status === 'active' ? '🟢 Activa' : '🔴 Cerrada'}
                </span>
              </div>
              <div className="card-body">
                {assembly.description && (
                  <p style={{ marginBottom: '1.5rem' }}>{assembly.description}</p>
                )}

                {assembly.status === 'active' ? (
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <button
                      className="btn btn-primary"
                      onClick={() => handleVote(assembly.id, 'yes')}
                      style={{ flex: 1 }}
                    >
                      ✅ A favor
                    </button>
                    <button
                      className="btn btn-secondary"
                      onClick={() => handleVote(assembly.id, 'no')}
                      style={{ flex: 1 }}
                    >
                      ❌ En contra
                    </button>
                    <button
                      className="btn btn-secondary"
                      onClick={() => handleVote(assembly.id, 'absent')}
                      style={{ flex: 1 }}
                    >
                      ⬜ Abstención
                    </button>
                  </div>
                ) : (
                  <p style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
                    Esta asamblea ha sido cerrada
                  </p>
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