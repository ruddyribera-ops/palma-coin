import { useEffect, useState } from 'react'
import { api } from '../api'
import { useAuth } from '../context/AuthContext'

const roles = [
  {
    id: 'president',
    name: 'Presidente',
    icon: '👑',
    description: 'Lleva control de asistencia, media conflictos, representa al curso'
  },
  {
    id: 'secretary',
    name: 'Secretario',
    icon: '📋',
    description: 'Gestiona el registro de likes, lleva inventario de materiales'
  },
  {
    id: 'treasurer',
    name: 'Tesorero',
    icon: '💰',
    description: 'Lleva el conteo semanal, entrega y recibe Palma Coins'
  }
]

export default function Government() {
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(true)
  const { isTeacher } = useAuth()

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const data = await api.getStudents()
      setStudents(data)
    } catch (err) {
      console.error('Failed to load:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleRoleChange = async (studentId, newRole) => {
    // First, remove this role from any student who has it
    const currentHolder = students.find(s => s.role === newRole)
    if (currentHolder && currentHolder.id !== studentId) {
      await api.updateStudent(currentHolder.id, { role: null })
    }

    // Then assign the role to the new student
    await api.updateStudent(studentId, { role: newRole })
    loadData()
  }

  const getStudentByRole = (role) => {
    return students.find(s => s.role === role)
  }

  if (loading) return <div className="empty-state">Cargando...</div>

  return (
    <div>
      <div className="page-header">
        <div className="page-title">
          <div className="page-title-icon">🏛️</div>
          <div>
            <h1>Gobierno Estudiantil</h1>
            <p className="page-subtitle">Roles y responsabilidades del curso</p>
          </div>
        </div>
      </div>

      {/* Role Cards */}
      <div className="role-cards">
        {roles.map(role => {
          const holder = getStudentByRole(role.id)

          return (
            <div key={role.id} className="role-card">
              <div className="role-icon">{role.icon}</div>
              <h3>{role.name}</h3>
              <p style={{ color: 'var(--text-secondary)' }}>{role.description}</p>

              {holder ? (
                <div className="student-name" style={{ marginTop: '1rem' }}>
                  {holder.name}
                </div>
              ) : (
                <p style={{ color: 'var(--text-muted)', marginTop: '1rem', fontStyle: 'italic' }}>
                  Sin asignar
                </p>
              )}

              {isTeacher && (
                <div style={{ marginTop: '1rem' }}>
                  <select
                    className="form-select"
                    value={holder?.id || ''}
                    onChange={(e) => handleRoleChange(e.target.value, role.id)}
                    style={{ maxWidth: '200px', margin: '0 auto' }}
                  >
                    <option value="">Seleccionar estudiante...</option>
                    {students
                      .filter(s => s.role !== role.id)
                      .map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))
                    }
                  </select>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* All Students */}
      <div className="card" style={{ marginTop: '2rem' }}>
        <div className="card-header">
          <h3 className="card-title">
            <span>👥</span> Todos los Estudiantes
          </h3>
        </div>
        <div className="card-body" style={{ padding: '0.5rem' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left' }}>
                <th style={{ padding: '1rem' }}>Estudiante</th>
                <th style={{ padding: '1rem' }}>Rol Actual</th>
                <th style={{ padding: '1rem' }}>Balance Likes</th>
                <th style={{ padding: '1rem' }}>Balance Hearts</th>
              </tr>
            </thead>
            <tbody>
              {students.map(student => (
                <tr key={student.id} style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                  <td style={{ padding: '1rem' }}>
                    <div className="student-name">
                      <div className="student-avatar">{student.name.charAt(0)}</div>
                      {student.name}
                    </div>
                  </td>
                  <td style={{ padding: '1rem' }}>
                    {student.role ? (
                      <span className="badge badge-success">
                        {roles.find(r => r.id === student.role)?.icon} {roles.find(r => r.id === student.role)?.name}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text-muted)' }}>Estudiante</span>
                    )}
                  </td>
                  <td style={{ padding: '1rem' }}>
                    <span className="balance-item likes">👍 {student.likes_balance}</span>
                  </td>
                  <td style={{ padding: '1rem' }}>
                    <span className="balance-item hearts">❤️ {student.hearts_balance}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}