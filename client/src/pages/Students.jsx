import { useEffect, useState } from 'react'
import { api } from '../api'
import { useAuth } from '../context/AuthContext'

// Progress bar component
function ProgressBar({ value, max, type }) {
  const [width, setWidth] = useState(0)

  useEffect(() => {
    setTimeout(() => setWidth((value / max) * 100), 100)
  }, [value, max])

  return (
    <div className="progress-bar-container" style={{ marginTop: '0.5rem' }}>
      <div className="progress-bar-track" style={{ maxWidth: '80px' }}>
        <div className={`progress-bar-fill ${type}`} style={{ width: `${width}%` }} />
      </div>
      <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>{value}</span>
    </div>
  )
}

export default function Students() {
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingStudent, setEditingStudent] = useState(null)
  const [form, setForm] = useState({ name: '' })
  const { isTeacher } = useAuth()

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const data = await api.getStudents()
      setStudents(data.sort((a, b) => b.likes_balance - a.likes_balance))
    } catch (err) {
      console.error('Failed to load:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      if (editingStudent) {
        await api.updateStudent(editingStudent.id, { name: form.name })
      } else {
        await api.addStudent({ name: form.name })
      }
      setShowModal(false)
      setEditingStudent(null)
      setForm({ name: '' })
      loadData()
    } catch (err) {
      alert('Error: ' + err.message)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('¿Estás seguro de eliminar este estudiante? Se perderán todos sus registros.')) return
    try {
      await api.deleteStudent(id)
      loadData()
    } catch (err) {
      alert('Error: ' + err.message)
    }
  }

  const openEdit = (student) => {
    setEditingStudent(student)
    setForm({ name: student.name })
    setShowModal(true)
  }

  if (loading) return (
    <div style={{ padding: '2rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem', marginBottom: '2rem' }}>
        {[...Array(3)].map((_, i) => (
          <div key={i} className="skeleton-card" style={{ height: '180px', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: '1rem' }}>
            <div className="skeleton skeleton-circle" style={{ marginBottom: '0.5rem' }} />
            <div className="skeleton skeleton-line" style={{ width: '60%' }} />
          </div>
        ))}
      </div>
      <div className="skeleton-card" style={{ height: '400px' }} />
    </div>
  )

  const maxLikes = Math.max(...students.map(s => s.likes_balance), 1)
  const maxHearts = Math.max(...students.map(s => s.hearts_balance), 1)
  const top3 = students.slice(0, 3)

  return (
    <div>
      <div className="page-header">
        <div className="page-title">
          <div className="page-title-icon">👥</div>
          <div>
            <h1>Estudiantes</h1>
            <p className="page-subtitle">Gestión de estudiantes del curso</p>
          </div>
        </div>
      </div>

      {/* Podium - Top 3 */}
      {students.length > 0 && (
        <div className="card" style={{ marginBottom: '2rem', overflow: 'hidden' }}>
          <div className="card-header">
            <h3 className="card-title"><span>🏆</span> Podio de Honor</h3>
          </div>
          <div className="podium-container" style={{ padding: '1.5rem' }}>
            {/* 2nd place */}
            {top3[1] && (
              <div className="podium-item" style={{ order: 2 }}>
                <div className="podium-avatar silver">
                  <span className="podium-medal">🥈</span>
                  {top3[1].name.charAt(0)}
                </div>
                <div className="podium-name">{top3[1].name.split(' ')[0]}</div>
                <div className="podium-stat">👍 {top3[1].likes_balance}</div>
                <div className="podium-bar silver">{top3[1].likes_balance}</div>
              </div>
            )}
            {/* 1st place */}
            {top3[0] && (
              <div className="podium-item" style={{ order: 1 }}>
                <div className="podium-avatar gold">
                  <span className="podium-medal">🥇</span>
                  {top3[0].name.charAt(0)}
                </div>
                <div className="podium-name">{top3[0].name.split(' ')[0]}</div>
                <div className="podium-stat">👍 {top3[0].likes_balance}</div>
                <div className="podium-bar gold">{top3[0].likes_balance}</div>
              </div>
            )}
            {/* 3rd place */}
            {top3[2] && (
              <div className="podium-item" style={{ order: 3 }}>
                <div className="podium-avatar bronze">
                  <span className="podium-medal">🥉</span>
                  {top3[2].name.charAt(0)}
                </div>
                <div className="podium-name">{top3[2].name.split(' ')[0]}</div>
                <div className="podium-stat">👍 {top3[2].likes_balance}</div>
                <div className="podium-bar bronze">{top3[2].likes_balance}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {isTeacher && (
        <div style={{ marginBottom: '1.5rem' }}>
          <button className="btn btn-primary ripple" onClick={() => { setEditingStudent(null); setForm({ name: '' }); setShowModal(true) }}>
            ➕ Agregar Estudiante
          </button>
        </div>
      )}

      <div className="card">
        <div className="grid-container">
          <table className="grid-table">
            <thead>
              <tr>
                <th>Rango</th>
                <th>Estudiante</th>
                <th>Rol</th>
                <th>👍 Likes</th>
                <th>❤️ Hearts</th>
                {isTeacher && <th>Acciones</th>}
              </tr>
            </thead>
            <tbody>
              {students.map((student, index) => (
                <tr key={student.id} className="student-row">
                  <td>
                    <div className={`student-rank ${index === 0 ? 'gold' : index === 1 ? 'silver' : index === 2 ? 'bronze' : ''}`}>
                      {index + 1}
                    </div>
                  </td>
                  <td>
                    <div className="student-name">
                      <div className="student-avatar">{student.name.charAt(0)}</div>
                      <span>{student.name}</span>
                    </div>
                  </td>
                  <td>
                    {student.role ? (
                      <span className="badge badge-success">{student.role}</span>
                    ) : (
                      <span style={{ color: 'var(--text-muted)' }}>—</span>
                    )}
                  </td>
                  <td>
                    <ProgressBar value={student.likes_balance} max={maxLikes} type="likes" />
                  </td>
                  <td>
                    <ProgressBar value={student.hearts_balance} max={maxHearts} type="hearts" />
                  </td>
                  {isTeacher && (
                    <td>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button className="btn btn-sm btn-secondary ripple" onClick={() => openEdit(student)}>
                          ✏️
                        </button>
                        <button className="btn btn-sm btn-secondary ripple" onClick={() => handleDelete(student.id)} style={{ color: 'var(--danger)' }}>
                          🗑️
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h3>{editingStudent ? 'Editar Estudiante' : 'Agregar Estudiante'}</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Nombre Completo</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Ej: Juan Pérez"
                    value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">
                  {editingStudent ? 'Guardar' : 'Agregar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}