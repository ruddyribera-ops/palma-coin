import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!email.trim() || !password.trim()) return

    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password: password.trim() })
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Error al iniciar sesión')
        setLoading(false)
        return
      }

      login(data)
      navigate('/')
    } catch (err) {
      setError('No se pudo conectar al servidor')
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-header">
          <div className="login-logo">🌴</div>
          <h1 className="login-title">Palma Coin</h1>
          <p className="login-subtitle">Sistema de Economía Conductual</p>
        </div>

        {error && (
          <div className="error-message" style={{
            background: '#fee2e2',
            color: '#dc2626',
            padding: '0.75rem',
            borderRadius: '8px',
            marginBottom: '1rem',
            textAlign: 'center',
            fontSize: '0.875rem'
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Correo Electrónico</label>
            <input
              type="email"
              className="form-input"
              placeholder="Ej: ruddy@laspalmas.edu.bo"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Contraseña</label>
            <input
              type="password"
              className="form-input"
              placeholder="Tu contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '0.5rem' }}
            disabled={loading}
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <div style={{
          marginTop: '1.5rem',
          padding: '1rem',
          background: 'rgba(59, 130, 246, 0.1)',
          borderRadius: '8px',
          fontSize: '0.8rem',
          color: 'var(--text-secondary)'
        }}>
          <strong style={{ color: 'var(--text-primary)' }}>Credenciales:</strong><br/>
          <strong>Docente:</strong> ruddy@laspalmas.edu.bo / palma2026<br/>
          <strong>Estudiantes:</strong> nombre.apellido@laspalmas.edu.bo / estudiante123
        </div>
      </div>
    </div>
  )
}