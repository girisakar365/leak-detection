import { useState, useEffect, useMemo } from 'react'
import NetworkMap from '../components/NetworkMap'
import SimulationModal from '../components/SimulationModal'
import { fetchNetwork, fetchObservationNodes, runMonitoring } from '../services/api'

export default function MonitoringSetup({ networkData, setNetworkData, onMonitoringComplete }) {
  const [observationNodes, setObservationNodes] = useState([])
  const [selectedNode, setSelectedNode] = useState(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [loadingMessage, setLoadingMessage] = useState('')
  const [error, setError] = useState(null)

  // Load network data on mount
  useEffect(() => {
    async function loadData() {
      try {
        setIsLoading(true)
        setLoadingMessage('Loading network data...')
        
        const [network, obsNodes] = await Promise.all([
          fetchNetwork(),
          fetchObservationNodes()
        ])
        
        setNetworkData(network)
        setObservationNodes(obsNodes.observation_nodes || [])
        setError(null)
      } catch (err) {
        console.error('Failed to load network:', err)
        setError('Failed to load network data. Please ensure the backend is running.')
      } finally {
        setIsLoading(false)
        setLoadingMessage('')
      }
    }
    
    if (!networkData) {
      loadData()
    } else {
      // Still fetch observation nodes if we have network data
      fetchObservationNodes()
        .then(data => setObservationNodes(data.observation_nodes || []))
        .catch(console.error)
    }
  }, [networkData, setNetworkData])

  // Handle node click on map
  const handleNodeClick = (node) => {
    setSelectedNode(node)
    setIsModalOpen(true)
  }

  // Handle simulation submission
  const handleSimulationSubmit = async (params) => {
    try {
      setIsLoading(true)
      setLoadingMessage('Running monitoring simulation... This may take a minute.')
      setIsModalOpen(false)
      
      const result = await runMonitoring({
        node_id: selectedNode.id,
        emitter_coefficient: params.emitterCoefficient,
        duration_hours: params.duration,
        start_time: params.startTime
      })
      
      if (result.success) {
        // Pass the result along with the selected node info
        onMonitoringComplete({
          ...result,
          monitoredNode: selectedNode
        })
      } else {
        setError(result.message || 'Monitoring failed')
      }
    } catch (err) {
      console.error('Monitoring failed:', err)
      setError(err.message || 'Failed to run monitoring. Please try again.')
    } finally {
      setIsLoading(false)
      setLoadingMessage('')
    }
  }

  // Handle modal close
  const handleModalClose = () => {
    setIsModalOpen(false)
    setSelectedNode(null)
  }

  return (
    <div className="map-container">
      {/* Loading Overlay */}
      {isLoading && (
        <div className="loading-overlay">
          <div className="loading-spinner"></div>
          <p>{loadingMessage}</p>
        </div>
      )}
      
      {/* Error Message */}
      {error && !isLoading && (
        <div style={{ 
          position: 'absolute', 
          top: '50%',
          left: '50%', 
          transform: 'translate(-50%, -50%)',
          zIndex: 1000,
          textAlign: 'center'
        }}>
          <div className="error-message" style={{ marginBottom: '1rem' }}>
            {error}
          </div>
          <button 
            className="btn btn-primary"
            onClick={() => window.location.reload()}
          >
            Retry Connection
          </button>
        </div>
      )}
      
      {/* Network Map - always render but may be empty */}
      <NetworkMap
        nodes={networkData?.nodes || []}
        pipes={networkData?.pipes || []}
        observationNodes={observationNodes}
        onNodeClick={handleNodeClick}
        selectedNode={selectedNode}
        showPopup={true}
      />
      
      {/* Map Legend with counts */}
      {(() => {
        // Calculate counts for each node type
        const nodes = networkData?.nodes || []
        const sensorCount = observationNodes.length
        const reservoirCount = nodes.filter(n => n.type === 'reservoir').length
        const tankCount = nodes.filter(n => n.type === 'tank').length
        const junctionCount = nodes.filter(n => n.type === 'junction').length
        const pipeCount = networkData?.pipes?.length || 0
        
        return (
          <div className="map-legend">
            <div className="legend-title">Legend</div>
            <div className="legend-item">
              <div className="legend-dot" style={{ backgroundColor: '#000000' }}></div>
              <span>Sensor Node ({sensorCount})</span>
            </div>
            <div className="legend-item">
              <div className="legend-dot" style={{ backgroundColor: '#1e7b34' }}></div>
              <span>Reservoir ({reservoirCount})</span>
            </div>
            <div className="legend-item">
              <div className="legend-dot" style={{ backgroundColor: '#b8860b' }}></div>
              <span>Tank ({tankCount})</span>
            </div>
            <div className="legend-item">
              <div className="legend-dot" style={{ backgroundColor: '#00bcd4' }}></div>
              <span>Junction ({junctionCount})</span>
            </div>
            <div className="legend-item">
              <div className="legend-line" style={{ backgroundColor: '#4a90d9' }}></div>
              <span>Pipe ({pipeCount})</span>
            </div>
          </div>
        )
      })()}
      
      {/* Simulation Modal */}
      {isModalOpen && selectedNode && (
        <SimulationModal
          node={selectedNode}
          onSubmit={handleSimulationSubmit}
          onClose={handleModalClose}
        />
      )}
    </div>
  )
}
