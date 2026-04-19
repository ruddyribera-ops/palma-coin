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
  const [feedback, setFeedback] = useState(null)
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

  const showFeedback = (studentName, type, amount) => {
    setFeedback({ studentName, type, amount, id: Date.now() })
    setTimeout(() => setFeedback(null), 2000)
  }

  const handleTokenToggle = (studentId, type, studentName) => {
    const key = `${studentId}-${type}`
    const newVal = (grid[key] || 0) + 1
    setGrid(prev => ({ ...prev, [key]: newVal }))
    showFeedback(studentName, type, newVal)
  }

  const handleTokenReset = (studentId, type) => {
    const key = `${studentId}-${type}`
    setGrid(prev => ({ ...prev, [key]: 0 }))
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
        await api.bulkTransactions({ transactions, date: selectedDate })
      }

      setGrid({})
      setFeedback({ saved: true, id: Date.now() })
      setTimeout(() => setFeedback(null), 3000)
    } catch (err) {
      alert('Error al guardar: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return (
    <div style={{ padding: '2rem' }}>
      <div className="skeleton-card" style={{ marginBottom: '1.5rem', height: '80px' }} />
      <div className="skeleton-card" style={{ height: '400px' }} />
    </div>
  )

  const totalLikes = Object.entries(grid).filter(([k]) => k.endsWith('-like')).reduce((s, [, v]) => s + v, 0)
  const totalHearts = Object.entries(grid).filter(([k]) => k.endsWith('-heart')).reduce((s, [, v]) => s + v, 0)

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

      {/* Floating Feedback Toast */}
      {feedback && (
        <div style={{
          position: 'fixed',
          top: '100px',
          right: '2rem',
          background: 'white',
          borderRadius: 'var(--radius-lg)',
          padding: '1rem 1.5rem',
          boxShadow: 'var(--shadow-lg)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          animation: 'slideIn 0.3s ease'
        }}>
          {feedback.saved ? (
            <>
              <span style={{ fontSize: '1.5rem' }}>✅</span>
              <span style={{ fontWeight: 700, color: 'var(--success)' }}>¡Registro guardado!</span>
            </>
          ) : (
            <>
              <span style={{ fontSize: '1.5rem' }}>{feedback.type === 'like' ? '👍' : '❤️'}</span>
              <span><strong>{feedback.studentName}</strong>: +{feedback.amount}</span>
            </>
          )}
        </div>
      )}

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
              className="btn btn-primary ripple"
              onClick={handleSave}
              disabled={saving || Object.keys(grid).length === 0}
              style={{ marginLeft: 'auto' }}
            >
              {saving ? <span className="inline-spinner" /> : '💾'} Guardar Registro
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
            <span className="badge badge-info">👍 Likes: {totalLikes}</span>
            <span className="badge badge-danger">❤️ Hearts: {totalHearts}</span>
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
                  <tr key={student.id} className="student-row">
                    <td>
                      <div className="student-name">
                        <div className="student-avatar">{student.name.charAt(0)}</div>
                        <span>{student.name}</span>
                      </div>
                    </td>
                    <td>
                      {isTeacher ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                          <button
                            className="token-btn like ripple"
                            onClick={() => handleTokenReset(student.id, 'like')}
                            disabled={likes === 0}
                          >
                            -
                          </button>
                          <span className={`counter-number ${likes > 0 ? 'bump' : ''}`} style={{
                            fontWeight: 800,
                            fontSize: '1.2rem',
                            minWidth: '36px',
                            color: likes > 0 ? 'var(--like-blue)' : 'var(--text-muted)',
                            transition: 'all 0.2s ease'
                          }}>
                            {likes}
                          </span>
                          <button
                            className="token-btn like ripple"
                            onClick={() => handleTokenToggle(student.id, 'like', student.name)}
                          >
                            +
                          </button>
                        </div>
                      ) : (
                        <span style={{ color: likes > 0 ? 'var(--like-blue)' : 'var(--text-muted)', fontWeight: likes > 0 ? 700 : 400 }}>
                          {likes > 0 ? `+${likes}` : '—'}
                        </span>
                      )}
                    </td>
                    <td>
                      {isTeacher ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                          <button
                            className="token-btn heart ripple"
                            onClick={() => handleTokenReset(student.id, 'heart')}
                            disabled={hearts === 0}
                          >
                            -
                          </button>
                          <span className={`counter-number ${hearts > 0 ? 'bump' : ''}`} style={{
                            fontWeight: 800,
                            fontSize: '1.2rem',
                            minWidth: '36px',
                            color: hearts > 0 ? 'var(--heart-red)' : 'var(--text-muted)',
                            transition: 'all 0.2s ease'
                          }}>
                            {hearts}
                          </span>
                          <button
                            className="token-btn heart ripple"
                            onClick={() => handleTokenToggle(student.id, 'heart', student.name)}
                          >
                            +
                          </button>
                        </div>
                      ) : (
                        <span style={{ color: hearts > 0 ? 'var(--heart-red)' : 'var(--text-muted)', fontWeight: hearts > 0 ? 700 : 400 }}>
                          {hearts > 0 ? `+${hearts}` : '—'}
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