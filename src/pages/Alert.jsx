import { useEffect, useState } from "react"
import io from "socket.io-client"
import { AlertOctagon, Clock } from "lucide-react"

// Establish connection outside the component
const socket = io("http://localhost:5000")

export default function Alerts() {
  const [alerts, setAlerts] = useState([])

  useEffect(() => {
    // 1. Get existing alerts on page load
    socket.on('initial_data', (payload) => {
      setAlerts(payload.alertsData || [])
    })

    // 2. Listen for new real-time alerts
    socket.on('new_alerts', (newData) => {
      setAlerts(newData)
    })

    return () => {
      socket.off('initial_data')
      socket.off('new_alerts')
    }
  }, [])

  return (
    <div className="card" style={{ minHeight: '600px' }}>
      <h2 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
        <AlertOctagon color="var(--danger)" /> Active Alerts
      </h2>
      <p style={{ color: 'var(--text-muted)' }}>Real-time spike detection from Spark Streaming</p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '20px' }}>
        {alerts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
            All systems normal. No negative spikes detected.
          </div>
        ) : (
          alerts.map((alert, i) => (
            <div key={i} style={{
              borderLeft: '5px solid var(--danger)',
              backgroundColor: 'var(--danger-bg)',
              padding: '15px 20px',
              borderRadius: '8px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              {/* Left Side: Category and Timestamp (Merged cleanly) */}
              <div>
                <h4 style={{ margin: '0 0 5px 0', color: 'var(--danger)' }}>High Negative Sentiment Spike</h4>
                <p style={{ margin: 0, fontSize: '14px' }}>
                  Category: <strong>{alert.category}</strong>
                </p>
                <p style={{ margin: '5px 0 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
                  Triggered at: {alert.triggeredAt || new Date().toLocaleTimeString()}
                </p>
              </div>

              {/* Right Side: Count */}
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--danger)' }}>
                  {alert.count}
                </span>
                <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Clock size={12} /> mentions / window
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}