import { useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import LeakResultMap from '../components/LeakResultMap'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'

export default function LeakDetection({ networkData, predictionResult, onBack }) {
  const navigate = useNavigate()

  // Redirect to home if no prediction result
  useEffect(() => {
    if (!predictionResult) {
      navigate('/')
    }
  }, [predictionResult, navigate])

  // Calculate leak intensity percentage for visualization (max assumed 50 LPS)
  const leakIntensityPercent = useMemo(() => {
    if (!predictionResult?.leak_size_lps) return 0
    return Math.min((predictionResult.leak_size_lps / 50) * 100, 100)
  }, [predictionResult])

  // Determine intensity label
  const getIntensityLabel = (lps) => {
    if (lps > 30) return 'Severe'
    if (lps > 15) return 'High'
    if (lps > 5) return 'Moderate'
    return 'Low'
  }

  // Transform pressure history data for charts
  const pressureChartData = useMemo(() => {
    if (!predictionResult?.simulation_data?.pressure_history) return []
    const data = predictionResult.simulation_data.pressure_history
    return Object.entries(data)
      .map(([time, pressure]) => ({
        time: parseFloat(time) / 3600, // Convert seconds to hours
        pressure: parseFloat(pressure)
      }))
      .sort((a, b) => a.time - b.time)
  }, [predictionResult])

  // Calculate base demand vs actual demand for comparison chart
  const demandComparisonData = useMemo(() => {
    if (!predictionResult?.simulation_data?.demand_history) return []
    const data = predictionResult.simulation_data.demand_history
    const entries = Object.entries(data)
      .map(([time, demand]) => ({
        time: parseFloat(time),
        demand: parseFloat(demand)
      }))
      .sort((a, b) => a.time - b.time)
    
    if (entries.length === 0) return []
    
    // Find the index where demand starts changing (non-zero or significantly different from initial)
    const threshold = 0.001 // Small threshold to detect change from 0
    let startIndex = 0
    const initialDemand = entries[0]?.demand || 0
    
    // Find where the demand first changes from the initial constant value
    for (let i = 1; i < entries.length; i++) {
      if (Math.abs(entries[i].demand - initialDemand) > threshold) {
        // Start one point before the change if possible
        startIndex = Math.max(0, i - 1)
        break
      }
    }
    
    // Get entries from the point where demand starts changing
    const relevantEntries = entries.slice(startIndex)
    
    if (relevantEntries.length === 0) return []
    
    // Calculate base demand as the first non-constant value (the stable demand before leak effect)
    // Look for a stable period after the initial zeros
    const nonZeroEntries = relevantEntries.filter(e => Math.abs(e.demand) > threshold)
    const baseDemand = nonZeroEntries.length > 0 ? nonZeroEntries[0].demand : relevantEntries[0].demand
    
    // Create data with both base demand (constant line) and actual demand over time
    // Normalize time to start from 0
    const timeOffset = relevantEntries[0].time
    return relevantEntries.map(entry => ({
      time: (entry.time - timeOffset) / 3600, // Convert to hours, starting from 0
      baseDemand: Math.abs(baseDemand),
      actualDemand: Math.abs(entry.demand)
    }))
  }, [predictionResult])

  // Find nearest node to the predicted leak location
  const nearestNode = useMemo(() => {
    if (!predictionResult?.leak_lat || !predictionResult?.leak_lng || !networkData?.nodes) return null
    
    let nearest = null
    let minDistance = Infinity
    
    networkData.nodes.forEach(node => {
      const nodeLat = node.coordinates?.lat
      const nodeLng = node.coordinates?.lng
      if (nodeLat && nodeLng) {
        // Simple Euclidean distance approximation
        const dLat = predictionResult.leak_lat - nodeLat
        const dLng = predictionResult.leak_lng - nodeLng
        const distance = Math.sqrt(dLat * dLat + dLng * dLng) * 111320 // Convert to meters approx
        if (distance < minDistance) {
          minDistance = distance
          nearest = { ...node, distance: Math.round(distance) }
        }
      }
    })
    
    return nearest
  }, [predictionResult, networkData])

  if (!predictionResult || !networkData) {
    return (
      <div className="results-page">
        <div className="loading-container">
          <p>Loading results...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="results-page">
      {/* Header */}
      <div className="results-header">
        <button className="back-button-inline" onClick={onBack}>
          ← Back to Setup
        </button>
        <h1 className="results-title">Leak Detection Results</h1>
      </div>

      {/* Map Section */}
      <div className="map-section">
        <div className="map-wrapper">
          <LeakResultMap
            nodes={networkData.nodes}
            pipes={networkData.pipes}
            leakLat={predictionResult.leak_lat}
            leakLng={predictionResult.leak_lng}
            leakSize={predictionResult.leak_size_lps}
            affectedPipes={predictionResult.affected_pipes || []}
            monitoredNode={predictionResult.monitoredNode}
          />
          
          {/* Legend - inside map */}
          <div className="map-legend">
            <div className="legend-title">Legend</div>
            <div className="legend-item">
              <div className="legend-dot" style={{ backgroundColor: '#e53e3e' }}></div>
              <span>Predicted Leak Zone</span>
            </div>
            <div className="legend-item">
              <div className="legend-dot" style={{ backgroundColor: '#3182ce' }}></div>
              <span>Monitored Node</span>
            </div>
            <div className="legend-item">
              <div className="legend-line" style={{ backgroundColor: '#e53e3e' }}></div>
              <span>Affected Pipe</span>
            </div>
            <div className="legend-item">
              <div className="legend-dot" style={{ backgroundColor: '#38a169' }}></div>
              <span>Normal Node</span>
            </div>
          </div>
        </div>

        {/* Results Panel - beside map */}
        <div className="result-panel-inline">
          <div className="result-header">
            <div className="result-icon leak">⚠️</div>
            <div>
              <div className="result-title">Leak Detected</div>
              <small style={{ color: 'var(--text-muted)' }}>ML Prediction Result</small>
            </div>
          </div>

          {/* Network Statistics */}
          <div className="stats-section">
            <div className="stats-title">Network Statistics</div>
            <div className="stats-grid">
              <div className="stat-item">
                <span className="stat-value">{networkData.total_nodes}</span>
                <span className="stat-label">Total Nodes</span>
              </div>
              <div className="stat-item">
                <span className="stat-value">{networkData.total_pipes}</span>
                <span className="stat-label">Total Pipes</span>
              </div>
              <div className="stat-item">
                <span className="stat-value status-operational">{networkData.system_status || 'Operational'}</span>
                <span className="stat-label">System Status</span>
              </div>
              <div className="stat-item">
                <span className="stat-value">{predictionResult.simulation_data?.average_pressure?.toFixed(2) || 'N/A'}</span>
                <span className="stat-label">Avg Pressure (m)</span>
              </div>
            </div>
          </div>

          {/* Prediction Details */}
          <div className="info-row">
            <span className="info-label">Monitored Node</span>
            <span className="info-value">{predictionResult.monitoredNode?.id || 'N/A'}</span>
          </div>
          <div className="info-row">
            <span className="info-label">Nearest Node</span>
            <span className="info-value" style={{ color: 'var(--danger)' }}>
              {nearestNode?.id || 'N/A'}
            </span>
          </div>
          {nearestNode && (
            <div className="info-row">
              <span className="info-label">Distance from Prediction</span>
              <span className="info-value">{nearestNode.distance} m</span>
            </div>
          )}
          <div className="info-row">
            <span className="info-label">Predicted Location</span>
            <span className="info-value">
              {predictionResult.leak_lat?.toFixed(5)}, {predictionResult.leak_lng?.toFixed(5)}
            </span>
          </div>
          <div className="info-row">
            <span className="info-label">Snapped Location</span>
            <span className="info-value" style={{ color: 'var(--danger)' }}>
              {nearestNode?.coordinates?.lat?.toFixed(5) || 'N/A'}, {nearestNode?.coordinates?.lng?.toFixed(5) || 'N/A'}
            </span>
          </div>
          <div className="info-row">
            <span className="info-label">UTM Coordinates</span>
            <span className="info-value">
              X: {predictionResult.leak_x?.toFixed(1)}, Y: {predictionResult.leak_y?.toFixed(1)}
            </span>
          </div>
          <div className="info-row">
            <span className="info-label">Leak Size</span>
            <span className="info-value" style={{ color: 'var(--danger)' }}>
              {predictionResult.leak_size_lps?.toFixed(2)} LPS
            </span>
          </div>
          <div className="info-row">
            <span className="info-label">Affected Pipes</span>
            <span className="info-value">{predictionResult.affected_pipes?.length || 0}</span>
          </div>

          {/* Leak Intensity Bar */}
          <div className="leak-size-indicator">
            <span style={{ fontSize: '0.875rem', color: 'var(--danger)' }}>
              {getIntensityLabel(predictionResult.leak_size_lps)}
            </span>
            <div className="leak-size-bar">
              <div 
                className="leak-size-fill" 
                style={{ width: `${leakIntensityPercent}%` }}
              />
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {leakIntensityPercent.toFixed(0)}%
            </span>
          </div>

          {/* Simulation Info */}
          {predictionResult.simulation_data && (
            <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                Simulation Parameters
              </div>
              <div className="info-row">
                <span className="info-label">Emitter Coeff</span>
                <span className="info-value">{predictionResult.simulation_data.emitter_coeff}</span>
              </div>
              <div className="info-row">
                <span className="info-label">Duration</span>
                <span className="info-value">{predictionResult.simulation_data.leak_duration_hr} hrs</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Graphs Section - Below Map */}
      <div className="graphs-section">
        <h2 className="section-title">Analysis Charts</h2>
        <div className="graphs-grid">
          {/* Pressure Over Time Graph */}
          {pressureChartData.length > 0 && (
            <div className="graph-card">
              <h3 className="graph-title">Pressure Over Time</h3>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={pressureChartData} margin={{ top: 10, right: 30, left: 10, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                  <XAxis 
                    dataKey="time" 
                    stroke="#888" 
                    tick={{ fill: '#ccc', fontSize: 11 }}
                    label={{ value: 'Time (hrs)', position: 'insideBottom', offset: -10, fill: '#888' }}
                  />
                  <YAxis 
                    stroke="#888" 
                    tick={{ fill: '#ccc', fontSize: 11 }}
                    label={{ value: 'Pressure (m)', angle: -90, position: 'insideLeft', fill: '#888' }}
                  />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1a1a2e', border: '1px solid #333', borderRadius: '8px' }}
                    labelStyle={{ color: '#ccc' }}
                    formatter={(value) => [`${value.toFixed(2)} m`, 'Pressure']}
                    labelFormatter={(label) => `Time: ${label.toFixed(2)} hrs`}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="pressure" 
                    stroke="#00bcd4" 
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, fill: '#00bcd4' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Base Demand vs Actual Demand Line Chart */}
          {demandComparisonData.length > 0 && (
            <div className="graph-card">
              <h3 className="graph-title">Base Demand vs Actual Demand Over Time</h3>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={demandComparisonData} margin={{ top: 10, right: 30, left: 10, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                  <XAxis 
                    dataKey="time" 
                    stroke="#888" 
                    tick={{ fill: '#ccc', fontSize: 11 }}
                    label={{ value: 'Time (hrs)', position: 'insideBottom', offset: -10, fill: '#888' }}
                  />
                  <YAxis 
                    stroke="#888" 
                    tick={{ fill: '#ccc', fontSize: 11 }}
                    label={{ value: 'Demand (LPS)', angle: -90, position: 'insideLeft', fill: '#888' }}
                  />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1a1a2e', border: '1px solid #333', borderRadius: '8px' }}
                    labelStyle={{ color: '#ccc' }}
                    formatter={(value, name) => [
                      `${value.toFixed(2)} LPS`, 
                      name === 'baseDemand' ? 'Base Demand' : 'Actual Demand'
                    ]}
                    labelFormatter={(label) => `Time: ${label.toFixed(2)} hrs`}
                  />
                  <Legend 
                    wrapperStyle={{ paddingTop: '10px' }}
                    formatter={(value) => value === 'baseDemand' ? 'Base Demand' : 'Actual Demand'}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="baseDemand" 
                    stroke="#00bcd4" 
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={false}
                    activeDot={{ r: 4, fill: '#00bcd4' }}
                    name="baseDemand"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="actualDemand" 
                    stroke="#e53e3e" 
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, fill: '#e53e3e' }}
                    name="actualDemand"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
