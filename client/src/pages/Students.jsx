import { useEffect, useState } from 'react'
import { api } from '../api'
import { useAuth } from '../context/AuthContext'

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

  if (loading) return <div className="empty-state">Cargando...</div>

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

      {isTeacher && (
        <div style={{ marginBottom: '1.5rem' }}>
          <button className="btn btn-primary" onClick={() => { setEditingStudent(null); setForm({ name: '' }); setShowModal(true) }}>
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
                <tr key={student.id}>
                  <td>
                    <div className={`student-rank ${index === 0 ? 'gold' : index === 1 ? 'silver' : index === 2 ? 'bronze' : ''}`}>
                      {index + 1}
                    </div>
                  </td>
                  <td>
                    <div className="student-name">
                      <div className="student-avatar">{student.name.charAt(0)}</div>
                      {student.name}
                    </div>
                  </td>
                  <td>
                    {student.role ? (
                      <span className="badge badge-success">{student.role}</span>
                    ) : (
                      <span style={{ color: 'var(--text-muted)' }}>-</span>
                    )}
                  </td>
                  <td>
                    <span className="balance-item likes" style={{ justifyContent: 'center' }}>
                      {student.likes_balance}
                    </span>
                  </td>
                  <td>
                    <span className="balance-item hearts" style={{ justifyContent: 'center' }}>
                      {student.hearts_balance}
                    </span>
                  </td>
                  {isTeacher && (
                    <td>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button className="btn btn-sm btn-secondary" onClick={() => openEdit(student)}>
                          ✏️
                        </button>
                        <button className="btn btn-sm btn-secondary" onClick={() => handleDelete(student.id)} style={{ color: 'var(--danger)' }}>
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