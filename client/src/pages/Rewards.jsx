import { useEffect, useState } from 'react'
import { api } from '../api'
import { useAuth } from '../context/AuthContext'

export default function Rewards() {
  const [rewards, setRewards] = useState([])
  const [students, setStudents] = useState([])
  const [purchases, setPurchases] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [showPurchaseModal, setShowPurchaseModal] = useState(false)
  const [selectedReward, setSelectedReward] = useState(null)
  const [loading, setLoading] = useState(true)
  const { isTeacher, user } = useAuth()

  const [form, setForm] = useState({
    name: '',
    description: '',
    cost_likes: '',
    cost_hearts: '',
    max_uses: ''
  })

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [rewardsData, studentsData, purchasesData] = await Promise.all([
        api.getRewards(),
        api.getStudents(),
        api.getPurchases()
      ])
      setRewards(rewardsData)
      setStudents(studentsData)
      setPurchases(purchasesData)
    } catch (err) {
      console.error('Failed to load data:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      await api.addReward({
        name: form.name,
        description: form.description,
        cost_likes: form.cost_likes ? parseInt(form.cost_likes) : null,
        cost_hearts: form.cost_hearts ? parseInt(form.cost_hearts) : null,
        max_uses: form.max_uses ? parseInt(form.max_uses) : null
      })
      setShowModal(false)
      setForm({ name: '', description: '', cost_likes: '', cost_hearts: '', max_uses: '' })
      loadData()
    } catch (err) {
      alert('Error: ' + err.message)
    }
  }

  const handlePurchase = async (studentId) => {
    if (!selectedReward) return

    try {
      const costField = selectedReward.cost_likes ? 'likes' : 'hearts'
      const costValue = selectedReward.cost_likes ? `l${selectedReward.cost_likes}` : `h${selectedReward.cost_hearts}`

      await api.makePurchase({
        student_id: studentId,
        reward_id: selectedReward.id,
        cost_paid: costValue,
        approved_by: isTeacher ? user.name : 'pending'
      })

      setShowPurchaseModal(false)
      setSelectedReward(null)
      loadData()
    } catch (err) {
      alert('Error: ' + err.message)
    }
  }

  if (loading) return <div className="empty-state">Cargando...</div>

  return (
    <div>
      <div className="page-header">
        <div className="page-title">
          <div className="page-title-icon">🎁</div>
          <div>
            <h1>Recompensas</h1>
            <p className="page-subtitle">Catálogo de premios y canjes</p>
          </div>
        </div>
      </div>

      {isTeacher && (
        <div style={{ marginBottom: '1.5rem' }}>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            ➕ Agregar Recompensa
          </button>
        </div>
      )}

      {/* Rewards Grid */}
      <div className="rewards-grid">
        {rewards.map(reward => {
          const isMaxed = reward.max_uses && reward.current_uses >= reward.max_uses

          return (
            <div
              key={reward.id}
              className={`reward-card ${isMaxed ? 'claimed' : ''}`}
              onClick={() => !isMaxed && isTeacher && (setSelectedReward(reward), setShowPurchaseModal(true))}
            >
              <div className="reward-icon">🎁</div>
              <h4>{reward.name}</h4>
              <p>{reward.description}</p>
              <div className="reward-cost">
                {reward.cost_likes ? (
                  <>
                    👍 <span className="likes">{reward.cost_likes} Likes</span>
                  </>
                ) : (
                  <>
                    ❤️ <span className="hearts">{reward.cost_hearts} Hearts</span>
                  </>
                )}
              </div>
              {reward.max_uses && (
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                  {reward.current_uses}/{reward.max_uses} canjeados
                </p>
              )}
            </div>
          )
        })}
      </div>

      {/* Recent Purchases */}
      {purchases.length > 0 && (
        <div className="card" style={{ marginTop: '2rem' }}>
          <div className="card-header">
            <h3 className="card-title">
              <span>🛒</span> Canjes Recientes
            </h3>
          </div>
          <div className="card-body">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ textAlign: 'left' }}>
                  <th style={{ padding: '0.75rem', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>Estudiante</th>
                  <th style={{ padding: '0.75rem', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>Recompensa</th>
                  <th style={{ padding: '0.75rem', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>Costo</th>
                  <th style={{ padding: '0.75rem', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>Fecha</th>
                </tr>
              </thead>
              <tbody>
                {purchases.slice(0, 10).map(purchase => (
                  <tr key={purchase.id}>
                    <td style={{ padding: '0.75rem', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>{purchase.student_name}</td>
                    <td style={{ padding: '0.75rem', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>{purchase.reward_name}</td>
                    <td style={{ padding: '0.75rem', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                      <span style={{ color: purchase.cost_paid.startsWith('h') ? 'var(--heart-red)' : 'var(--like-blue)', fontWeight: 700 }}>
                        {purchase.cost_paid}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem', borderBottom: '1px solid rgba(0,0,0,0.05)', color: 'var(--text-muted)' }}>
                      {new Date(purchase.purchased_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Reward Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Agregar Recompensa</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Nombre</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Ej: Salida anticipada"
                    value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Descripción</label>
                  <textarea
                    className="form-textarea"
                    placeholder="Descripción del premio..."
                    value={form.description}
                    onChange={e => setForm({ ...form, description: e.target.value })}
                    rows={3}
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">Costo en Likes</label>
                    <input
                      type="number"
                      className="form-input"
                      placeholder="Ej: 15"
                      value={form.cost_likes}
                      onChange={e => setForm({ ...form, cost_likes: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Costo en Hearts</label>
                    <input
                      type="number"
                      className="form-input"
                      placeholder="Ej: 500"
                      value={form.cost_hearts}
                      onChange={e => setForm({ ...form, cost_hearts: e.target.value })}
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Usos máximos (opcional)</label>
                  <input
                    type="number"
                    className="form-input"
                    placeholder="Ej: 10"
                    value={form.max_uses}
                    onChange={e => setForm({ ...form, max_uses: e.target.value })}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Purchase Modal */}
      {showPurchaseModal && selectedReward && (
        <div className="modal-overlay" onClick={() => setShowPurchaseModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Canje: {selectedReward.name}</h3>
              <button className="modal-close" onClick={() => setShowPurchaseModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <p style={{ marginBottom: '1rem' }}>Selecciona el estudiante que will canjear esta recompensa:</p>
              <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                {students.map(student => {
                  const balance = selectedReward.cost_likes ? student.likes_balance : student.hearts_balance
                  const cost = selectedReward.cost_likes || selectedReward.cost_hearts
                  const canAfford = balance >= cost

                  return (
                    <div
                      key={student.id}
                      onClick={() => canAfford && handlePurchase(student.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.75rem',
                        marginBottom: '0.5rem',
                        background: canAfford ? 'rgba(45, 139, 78, 0.05)' : 'rgba(0,0,0,0.02)',
                        borderRadius: 'var(--radius-md)',
                        cursor: canAfford ? 'pointer' : 'not-allowed',
                        opacity: canAfford ? 1 : 0.5
                      }}
                    >
                      <span style={{ fontWeight: 600 }}>{student.name}</span>
                      <span style={{
                        color: selectedReward.cost_likes ? 'var(--like-blue)' : 'var(--heart-red)',
                        fontWeight: 700
                      }}>
                        {balance} / {cost}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}