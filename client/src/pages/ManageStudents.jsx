import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { api } from '../api'

export default function ManageStudents() {
  const { isTeacher } = useAuth()
  const [students, setStudents] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [editingStudent, setEditingStudent] = useState(null)
  const [editingUser, setEditingUser] = useState(null)
  const [editForm, setEditForm] = useState({ email: '', password: '', likes: '', hearts: '', reason: '' })
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [visiblePasswords, setVisiblePasswords] = useState({})

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [studentsData, usersData] = await Promise.all([
        api.getStudents(),
        api.getUsers().catch(() => [])  // fallback if endpoint fails
      ])
      setStudents(studentsData)
      setUsers(usersData)
    } catch (err) {
      console.error('Error fetching data:', err)
    } finally {
      setLoading(false)
    }
  }

  const togglePassword = (userId) => {
    setVisiblePasswords(prev => ({
      ...prev,
      [userId]: !prev[userId]
    }))
  }

  const openEdit = (student) => {
    const user = users.find(u => u.student_id === student.id)
    setEditingStudent(student)
    setEditingUser(user)
    setEditForm({
      email: user?.email || '',
      password: '',
      likes: student.likes_balance || 0,
      hearts: student.hearts_balance || 0,
      reason: ''
    })
    setMessage('')
  }

  const closeEdit = () => {
    setEditingStudent(null)
    setEditingUser(null)
    setEditForm({ email: '', password: '', likes: '', hearts: '', reason: '' })
    setMessage('')
  }

  const saveChanges = async () => {
    if (!editingStudent) return
    setSaving(true)
    setMessage('')

    try {
      const user = editingUser

      // Update user credentials if changed
      if (user && (editForm.email || editForm.password)) {
        await fetch(`/api/users/${user.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            email: editForm.email || undefined,
            password: editForm.password || undefined
          })
        })
      }

      // Update balance if changed
      const newLikes = parseInt(editForm.likes) || 0
      const newHearts = parseInt(editForm.hearts) || 0
      if (newLikes !== editingStudent.likes_balance || newHearts !== editingStudent.hearts_balance) {
        if (!editForm.reason.trim()) {
          setMessage('⚠️ Necesitas escribir una razón para el ajuste de saldo')
          setSaving(false)
          return
        }
        await fetch(`/api/students/${editingStudent.id}/balance`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            likes: newLikes,
            hearts: newHearts,
            reason: editForm.reason
          })
        })
      }

      setMessage('✅ Cambios guardados correctamente')
      setTimeout(() => {
        closeEdit()
        fetchData()
      }, 1500)
    } catch (err) {
      setMessage('❌ Error al guardar cambios')
    } finally {
      setSaving(false)
    }
  }

  if (!isTeacher) {
    return (
      <div className="page">
        <h1>Acceso Denegado</h1>
        <p>Solo los docentes pueden acceder a esta página.</p>
      </div>
    )
  }

  if (loading) {
    return <div className="page">Cargando...</div>
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Gestionar Estudiantes</h1>
        <p className="subtitle">Editar credenciales de acceso y ajustar saldo de Palma Coins</p>
      </div>

      <div className="card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Estudiante</th>
              <th>Email</th>
              <th>Contraseña</th>
              <th>❤️ Loves</th>
              <th>⭐ Likes</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {students.map(student => {
              const user = users.find(u => u.student_id === student.id)
              return (
                <tr key={student.id}>
                  <td><strong>{student.name}</strong></td>
                  <td>{user?.email || '—'}</td>
                  <td>
                    {user ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <code style={{
                          background: '#f1f5f9',
                          padding: '0.25rem 0.5rem',
                          borderRadius: '4px',
                          fontSize: '0.85rem',
                          color: visiblePasswords[user.id] ? '#1e40af' : '#64748b'
                        }}>
                          {visiblePasswords[user.id] ? '••••••••' : '••••••••'}
                        </code>
                        <button
                          className="btn btn-xs btn-ghost"
                          onClick={() => togglePassword(user.id)}
                          title={visiblePasswords[user.id] ? 'Ocultar' : 'Mostrar'}
                          style={{ padding: '0.25rem' }}
                        >
                          {visiblePasswords[user.id] ? '👁️‍🗨️' : '👁️'}
                        </button>
                      </div>
                    ) : '—'}
                  </td>
                  <td>
                    <span className="balance hearts">{student.hearts_balance || 0}</span>
                  </td>
                  <td>
                    <span className="balance likes">{student.likes_balance || 0}</span>
                  </td>
                  <td>
                    <button className="btn btn-sm btn-secondary" onClick={() => openEdit(student)}>
                      Editar
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Edit Modal */}
      {editingStudent && (
        <div className="modal-overlay" onClick={closeEdit}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Editar: {editingStudent.name}</h2>
              <button className="modal-close" onClick={closeEdit}>×</button>
            </div>

            <div className="modal-body">
              {message && (
                <div className={`message ${message.includes('✅') ? 'success' : message.includes('⚠️') ? 'warning' : 'error'}`}>
                  {message}
                </div>
              )}

              <div className="edit-section">
                <h3>🔐 Credenciales de Acceso</h3>
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input
                    type="email"
                    className="form-input"
                    value={editForm.email}
                    onChange={e => setEditForm({ ...editForm, email: e.target.value })}
                    placeholder="email@laspalmas.edu.bo"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Nueva Contraseña</label>
                  <input
                    type="text"
                    className="form-input"
                    value={editForm.password}
                    onChange={e => setEditForm({ ...editForm, password: e.target.value })}
                    placeholder="Ingresa nueva contraseña para cambiar"
                  />
                  <small style={{ color: '#666', fontSize: '0.75rem' }}>
                    Dejar vacío para mantener la contraseña actual
                  </small>
                </div>
              </div>

              <div className="edit-section">
                <h3>💰 Ajustar Saldo Palma Coins</h3>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">❤️ Loves (Corazones)</label>
                    <input
                      type="number"
                      className="form-input"
                      value={editForm.hearts}
                      onChange={e => setEditForm({ ...editForm, hearts: e.target.value })}
                      min="0"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">⭐ Likes</label>
                    <input
                      type="number"
                      className="form-input"
                      value={editForm.likes}
                      onChange={e => setEditForm({ ...editForm, likes: e.target.value })}
                      min="0"
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">📝 Razón del ajuste</label>
                  <input
                    type="text"
                    className="form-input"
                    value={editForm.reason}
                    onChange={e => setEditForm({ ...editForm, reason: e.target.value })}
                    placeholder="Ej: Error al registrar, corrección manual..."
                  />
                  <small style={{ color: '#dc2626', fontSize: '0.75rem' }}>
                    Requerido si cambias el saldo
                  </small>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={closeEdit}>Cancelar</button>
              <button className="btn btn-primary" onClick={saveChanges} disabled={saving}>
                {saving ? 'Guardando...' : 'Guardar Cambios'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}