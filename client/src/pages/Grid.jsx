import { useEffect, useState } from 'react'
import { api } from '../api'
import { useAuth } from '../context/AuthContext'

export default function Grid() {
  const [students, setStudents] = useState([])
  const [subjects, setSubjects] = useState([])
  const [selectedSubject, setSelectedSubject] = useState('')
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [grid, setGrid] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const { isTeacher } = useAuth()

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [studentsData, subjectsData] = await Promise.all([
        api.getStudents(),
        api.getSubjects()
      ])
      setStudents(studentsData)
      setSubjects(subjectsData)
      if (subjectsData.length > 0) {
        setSelectedSubject(subjectsData[0].id.toString())
      }
    } catch (err) {
      console.error('Failed to load data:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleTokenToggle = (studentId, type) => {
    const key = `${studentId}-${type}`
    setGrid(prev => ({
      ...prev,
      [key]: (prev[key] || 0) + 1
    }))
  }

  const handleTokenReset = (studentId, type) => {
    const key = `${studentId}-${type}`
    setGrid(prev => ({
      ...prev,
      [key]: 0
    }))
  }

  const handleSave = async () => {
    if (!selectedDate || !selectedSubject) return

    setSaving(true)
    try {
      const transactions = []

      students.forEach(student => {
        const likeKey = `${student.id}-like`
        const heartKey = `${student.id}-heart`

        if (grid[likeKey] > 0) {
          transactions.push({
            student_id: student.id,
            type: 'like',
            amount: grid[likeKey],
            subject_id: parseInt(selectedSubject)
          })
        }

        if (grid[heartKey] > 0) {
          transactions.push({
            student_id: student.id,
            type: 'heart',
            amount: grid[heartKey],
            subject_id: parseInt(selectedSubject)
          })
        }
      })

      if (transactions.length > 0) {
        await api.bulkTransactions({
          transactions,
          date: selectedDate
        })
      }

      // Reset grid
      setGrid({})
      alert('¡Registro guardado exitosamente!')
    } catch (err) {
      alert('Error al guardar: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="empty-state">Cargando...</div>

  return (
    <div>
      <div className="page-header">
        <div className="page-title">
          <div className="page-title-icon">📝</div>
          <div>
            <h1>Registro Diario</h1>
            <p className="page-subtitle">Registra likes y corazones por materia</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="card-body" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Fecha</label>
            <input
              type="date"
              className="form-input"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Materia</label>
            <select
              className="form-select"
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
            >
              {subjects.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          {isTeacher && (
            <button
              className="btn btn-primary"
              onClick={handleSave}
              disabled={saving || Object.keys(grid).length === 0}
              style={{ marginLeft: 'auto' }}
            >
              {saving ? 'Guardando...' : '💾 Guardar Registro'}
            </button>
          )}
        </div>
      </div>

      {/* Grid */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">
            <span>👥</span> Registro de Estudiantes
          </h3>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <span className="badge badge-info">👍 Likes: {Object.entries(grid).filter(([k]) => k.endsWith('-like')).reduce((s, [, v]) => s + v, 0)}</span>
            <span className="badge badge-danger">❤️ Hearts: {Object.entries(grid).filter(([k]) => k.endsWith('-heart')).reduce((s, [, v]) => s + v, 0)}</span>
          </div>
        </div>
        <div className="grid-container">
          <table className="grid-table">
            <thead>
              <tr>
                <th>Estudiante</th>
                <th>👍 Like</th>
                <th>❤️ Heart</th>
              </tr>
            </thead>
            <tbody>
              {students.map(student => {
                const likeKey = `${student.id}-like`
                const heartKey = `${student.id}-heart`
                const likes = grid[likeKey] || 0
                const hearts = grid[heartKey] || 0

                return (
                  <tr key={student.id}>
                    <td>
                      <div className="student-name">
                        <div className="student-avatar">
                          {student.name.charAt(0)}
                        </div>
                        <span>{student.name}</span>
                      </div>
                    </td>
                    <td>
                      {isTeacher ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                          <button
                            className="token-btn like"
                            onClick={() => handleTokenReset(student.id, 'like')}
                            disabled={likes === 0}
                          >
                            -
                          </button>
                          <span style={{
                            fontWeight: 800,
                            fontSize: '1.1rem',
                            minWidth: '30px',
                            color: likes > 0 ? 'var(--like-blue)' : 'var(--text-muted)'
                          }}>
                            {likes}
                          </span>
                          <button
                            className="token-btn like"
                            onClick={() => handleTokenToggle(student.id, 'like')}
                          >
                            +
                          </button>
                        </div>
                      ) : (
                        <span style={{ color: likes > 0 ? 'var(--like-blue)' : 'var(--text-muted)' }}>
                          {likes > 0 ? `+${likes}` : '-'}
                        </span>
                      )}
                    </td>
                    <td>
                      {isTeacher ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                          <button
                            className="token-btn heart"
                            onClick={() => handleTokenReset(student.id, 'heart')}
                            disabled={hearts === 0}
                          >
                            -
                          </button>
                          <span style={{
                            fontWeight: 800,
                            fontSize: '1.1rem',
                            minWidth: '30px',
                            color: hearts > 0 ? 'var(--heart-red)' : 'var(--text-muted)'
                          }}>
                            {hearts}
                          </span>
                          <button
                            className="token-btn heart"
                            onClick={() => handleTokenToggle(student.id, 'heart')}
                          >
                            +
                          </button>
                        </div>
                      ) : (
                        <span style={{ color: hearts > 0 ? 'var(--heart-red)' : 'var(--text-muted)' }}>
                          {hearts > 0 ? `+${hearts}` : '-'}
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}