import { useState } from 'react'

export default function SimulationModal({ node, onSubmit, onClose }) {
  const [emitterCoefficient, setEmitterCoefficient] = useState(0.5)
  const [duration, setDuration] = useState(4)
  const [startTime, setStartTime] = useState(6) // Default 6 AM (user sees 1-24)

  const handleSubmit = (e) => {
    e.preventDefault()
    onSubmit({
      emitterCoefficient: parseFloat(emitterCoefficient),
      duration: parseInt(duration),
      startTime: parseInt(startTime)
    })
  }

  // Prevent click propagation to avoid closing modal when clicking inside
  const handleModalClick = (e) => {
    e.stopPropagation()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={handleModalClick}>
        <div className="modal-header">
          <h2 className="modal-title">Simulate Leak Monitoring</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        
        {/* Node Information */}
        <div style={{ marginBottom: '1.5rem' }}>
          <div className="info-row">
            <span className="info-label">Node ID</span>
            <span className="info-value">{node.id}</span>
          </div>
          <div className="info-row">
            <span className="info-label">Coordinates</span>
            <span className="info-value">
              {node.coordinates.lat.toFixed(5)}, {node.coordinates.lng.toFixed(5)}
            </span>
          </div>
          <div className="info-row">
            <span className="info-label">Elevation</span>
            <span className="info-value">{node.elevation?.toFixed(2)} m</span>
          </div>
        </div>
        
        {/* Simulation Parameters Form */}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="emitterCoeff">
              Emitter Coefficient
            </label>
            <input
              type="number"
              id="emitterCoeff"
              className="form-input"
              value={emitterCoefficient}
              onChange={(e) => setEmitterCoefficient(e.target.value)}
              min="0.1"
              max="5"
              step="0.1"
              required
            />
            <p className="form-hint">
              Controls leak intensity. Higher values = larger leak (0.1 - 5.0)
            </p>
          </div>
          
          <div className="form-group">
            <label className="form-label" htmlFor="duration">
              Leak Duration: <strong>{duration} hour{duration > 1 ? 's' : ''}</strong>
            </label>
            <input
              type="range"
              id="duration"
              className="form-slider"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              min="1"
              max="12"
              step="1"
              required
            />
            <div className="slider-labels">
              <span>1 hr</span>
              <span>12 hrs</span>
            </div>
          </div>
          
          <div className="form-group">
            <label className="form-label" htmlFor="startTime">
              Start Time: <strong>{startTime.toString().padStart(2, '0')}:00</strong>
            </label>
            <input
              type="range"
              id="startTime"
              className="form-slider"
              value={startTime}
              onChange={(e) => setStartTime(parseInt(e.target.value))}
              min="1"
              max="24"
              step="1"
              required
            />
            <div className="slider-labels">
              <span>01:00</span>
              <span>24:00</span>
            </div>
          </div>
          
          <button type="submit" className="btn btn-primary btn-block">
            🔍 Run Monitoring Simulation
          </button>
        </form>
      </div>
    </div>
  )
}
