import { useEffect } from 'react'
import { MapContainer, TileLayer, CircleMarker, Polyline, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'

// Fix Leaflet default icon issue
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
})

// Component to fit map bounds to network
function FitBounds({ nodes }) {
  const map = useMap()
  
  useEffect(() => {
    if (nodes && nodes.length > 0) {
      const bounds = nodes.map(node => [node.coordinates.lat, node.coordinates.lng])
      if (bounds.length > 0) {
        map.fitBounds(bounds, { padding: [50, 50] })
      }
    }
  }, [nodes, map])
  
  return null
}

// Node colors based on type
const getNodeColor = (type, isObservation = false) => {
  if (isObservation) return '#000000' // Black for observation nodes
  switch (type) {
    case 'reservoir': return '#1e7b34' // Dark green
    case 'tank': return '#b8860b' // Dark goldenrod/mustard
    default: return '#00bcd4' // Cyan/Teal for junctions - brighter and visible
  }
}

// Node radius based on type
const getNodeRadius = (type, isObservation = false) => {
  if (isObservation) return 8
  switch (type) {
    case 'reservoir': return 10
    case 'tank': return 9
    default: return 5
  }
}

export default function NetworkMap({ 
  nodes = [], 
  pipes = [], 
  observationNodes = [],
  onNodeClick,
  selectedNode,
  showPopup = true
}) {
  // Default center: Kathmandu Valley
  const defaultCenter = [27.7172, 85.3240]
  const defaultZoom = 14
  
  // Create a Set of observation node IDs for quick lookup
  const obsNodeIds = new Set(observationNodes.map(n => n.id))
  
  // Build node lookup for pipe rendering
  const nodeMap = {}
  nodes.forEach(node => {
    nodeMap[node.id] = node
  })
  
  // Generate pipe coordinates
  const pipeLines = pipes.map(pipe => {
    const fromNode = nodeMap[pipe.from_node]
    const toNode = nodeMap[pipe.to_node]
    
    if (fromNode && toNode) {
      return {
        id: pipe.id,
        positions: [
          [fromNode.coordinates.lat, fromNode.coordinates.lng],
          [toNode.coordinates.lat, toNode.coordinates.lng]
        ],
        ...pipe
      }
    }
    return null
  }).filter(Boolean)
  
  return (
    <MapContainer
      center={defaultCenter}
      zoom={defaultZoom}
      style={{ height: 'calc(100vh - 70px)', width: '100%', position: 'absolute', top: 0, left: 0 }}
      scrollWheelZoom={true}
    >
      {/* OpenStreetMap 2D Tile Layer */}
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      
      {/* Fit bounds to network */}
      <FitBounds nodes={nodes} />
      
      {/* Render pipes as polylines */}
      {pipeLines.map(pipe => (
        <Polyline
          key={pipe.id}
          positions={pipe.positions}
          pathOptions={{
            color: '#4a90d9',
            weight: 2,
            opacity: 0.7
          }}
        />
      ))}
      
      {/* Render all nodes */}
      {nodes.map(node => {
        const isObs = obsNodeIds.has(node.id)
        const isSelected = selectedNode?.id === node.id
        const isJunction = node.type === 'junction'
        const isClickable = isObs || isJunction // Both sensor nodes and junctions are clickable
        
        // Determine the display type label
        const getTypeLabel = () => {
          if (isObs) return 'Sensor Node'
          switch (node.type) {
            case 'reservoir': return 'Reservoir'
            case 'tank': return 'Tank'
            default: return 'Junction'
          }
        }
        
        return (
          <CircleMarker
            key={node.id}
            center={[node.coordinates.lat, node.coordinates.lng]}
            radius={isSelected ? getNodeRadius(node.type, isObs) + 3 : getNodeRadius(node.type, isObs)}
            pathOptions={{
              color: isSelected ? '#e53e3e' : getNodeColor(node.type, isObs),
              fillColor: isSelected ? '#e53e3e' : getNodeColor(node.type, isObs),
              fillOpacity: isObs ? 0.8 : 0.5,
              weight: isObs ? 2 : 1
            }}
            eventHandlers={{
              click: () => {
                if (isClickable && onNodeClick) {
                  onNodeClick(node)
                }
              }
            }}
          >
            {showPopup && isClickable && (
              <Popup>
                <div style={{ minWidth: '150px' }}>
                  <strong>{node.id}</strong>
                  <br />
                  <small>Type: {getTypeLabel()}</small>
                  <br />
                  <small>Elevation: {node.elevation?.toFixed(2)}m</small>
                  <br />
                  <small style={{ color: '#3182ce', cursor: 'pointer' }}>Click to simulate leak</small>
                </div>
              </Popup>
            )}
          </CircleMarker>
        )
      })}
    </MapContainer>
  )
}
