import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import { useWebSocket } from './hooks/useWebSocket'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Grid from './pages/Grid'
import Rewards from './pages/Rewards'
import Government from './pages/Government'
import Students from './pages/Students'
import Assemblies from './pages/Assemblies'
import ManageStudents from './pages/ManageStudents'
import { useState } from 'react'

function ProtectedRoute({ children }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  return children
}

export default function App() {
  const [toasts, setToasts] = useState([])

  const addToast = (message, type = 'info') => {
    const id = Date.now()
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 4000)
  }

  const handleWSMessage = (data) => {
    switch (data.type) {
      case 'STUDENT_ADDED':
        addToast(`Nuevo estudiante: ${data.data.name}`, 'success')
        break
      case 'STUDENT_UPDATED':
        addToast(`Estudiante actualizado: ${data.data.name}`, 'success')
        break
      case 'TRANSACTION_ADDED':
        addToast(`+${data.data.transaction.amount} ${data.data.transaction.type === 'like' ? '👍' : '❤️'} para ${data.data.student.name}`, 'success')
        break
      case 'BULK_TRANSACTIONS':
        addToast('Transacciones guardadas', 'success')
        break
      case 'PURCHASE_MADE':
        addToast(`${data.data.student.name} canjeó una recompensa`, 'info')
        break
      case 'REWARD_ADDED':
        addToast('Nueva recompensa agregada', 'success')
        break
      case 'ASSEMBLY_ADDED':
        addToast('Nueva asamblea creada', 'success')
        break
      default:
        break
    }
    // Trigger refresh event
    window.dispatchEvent(new CustomEvent('palma_refresh'))
  }

  useWebSocket(handleWSMessage)

  return (
    <>
      <Layout>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/grid" element={<ProtectedRoute><Grid /></ProtectedRoute>} />
          <Route path="/rewards" element={<ProtectedRoute><Rewards /></ProtectedRoute>} />
          <Route path="/government" element={<ProtectedRoute><Government /></ProtectedRoute>} />
          <Route path="/students" element={<ProtectedRoute><Students /></ProtectedRoute>} />
          <Route path="/assemblies" element={<ProtectedRoute><Assemblies /></ProtectedRoute>} />
          <Route path="/manage-students" element={<ProtectedRoute><ManageStudents /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>

      {/* Toast notifications */}
      <div className="toast-container">
        {toasts.map(toast => (
          <div key={toast.id} className={`toast ${toast.type}`}>
            <span>{toast.message}</span>
          </div>
        ))}
      </div>
    </>
  )
}