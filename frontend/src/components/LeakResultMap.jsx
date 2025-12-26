import { useEffect, useMemo } from 'react'
import { MapContainer, TileLayer, CircleMarker, Polyline, useMap } from 'react-leaflet'
import L from 'leaflet'

// Fix Leaflet default icon issue
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
})

// Calculate distance between two lat/lng points (Haversine formula)
function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000 // Earth's radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

// Find the nearest node to given coordinates
function findNearestNode(nodes, targetLat, targetLng) {
  if (!nodes || nodes.length === 0 || !targetLat || !targetLng) return null
  
  let nearestNode = null
  let minDistance = Infinity
  
  nodes.forEach(node => {
    const nodeLat = node.coordinates?.lat
    const nodeLng = node.coordinates?.lng
    if (nodeLat && nodeLng) {
      const distance = calculateDistance(targetLat, targetLng, nodeLat, nodeLng)
      if (distance < minDistance) {
        minDistance = distance
        nearestNode = { ...node, distance }
      }
    }
  })
  
  return nearestNode
}

// Calculate network bounds from nodes
function calculateNetworkBounds(nodes) {
  if (!nodes || nodes.length === 0) return null
  
  let minLat = Infinity, maxLat = -Infinity
  let minLng = Infinity, maxLng = -Infinity
  
  nodes.forEach(node => {
    const lat = node.coordinates?.lat
    const lng = node.coordinates?.lng
    if (lat && lng) {
      minLat = Math.min(minLat, lat)
      maxLat = Math.max(maxLat, lat)
      minLng = Math.min(minLng, lng)
      maxLng = Math.max(maxLng, lng)
    }
  })
  
  return { minLat, maxLat, minLng, maxLng }
}

// Custom Ellipse component since react-leaflet doesn't have built-in ellipse
function LeakEllipse({ center, radiusX, radiusY, color, fillOpacity }) {
  const map = useMap()
  
  useEffect(() => {
    if (!center || !map) return
    
    // Create ellipse using SVG overlay
    const ellipse = L.ellipse(center, [radiusY, radiusX], {
      color: color,
      fillColor: color,
      fillOpacity: fillOpacity,
      weight: 2,
      opacity: 0.8,
    })
    
    ellipse.addTo(map)
    
    return () => {
      map.removeLayer(ellipse)
    }
  }, [center, radiusX, radiusY, color, fillOpacity, map])
  
  return null
}

// Fallback: Create ellipse-like shape using CircleMarker with custom styling
// Constrained to stay within network bounds
function EllipticalLeakZone({ center, leakSize, networkBounds }) {
  const map = useMap()
  
  useEffect(() => {
    if (!center || !map) return
    
    // Calculate ellipse size based on leak size (larger leak = larger zone)
    const baseRadius = 80 // meters
    const scaleFactor = Math.min(1 + (leakSize / 30), 3) // Scale 1-3x based on leak size
    let radiusX = baseRadius * scaleFactor * 1.5 // Horizontal radius (wider)
    let radiusY = baseRadius * scaleFactor // Vertical radius
    
    // If we have network bounds, constrain the ellipse to not exceed them
    if (networkBounds) {
      const { minLat, maxLat, minLng, maxLng } = networkBounds
      
      // Calculate max allowed radius based on distance to bounds
      const latDegPerMeter = 1 / 111320
      const lngDegPerMeter = 1 / (111320 * Math.cos(center[0] * Math.PI / 180))
      
      const distToMinLat = (center[0] - minLat) / latDegPerMeter
      const distToMaxLat = (maxLat - center[0]) / latDegPerMeter
      const distToMinLng = (center[1] - minLng) / lngDegPerMeter
      const distToMaxLng = (maxLng - center[1]) / lngDegPerMeter
      
      // Constrain radius to stay within bounds (with some padding)
      const padding = 20 // meters padding from edge
      const maxRadiusY = Math.min(distToMinLat, distToMaxLat) - padding
      const maxRadiusX = Math.min(distToMinLng, distToMaxLng) - padding
      
      if (maxRadiusY > 0 && maxRadiusX > 0) {
        radiusY = Math.min(radiusY, maxRadiusY)
        radiusX = Math.min(radiusX, maxRadiusX)
      }
    }
    
    // Ensure minimum radius
    radiusX = Math.max(radiusX, 30)
    radiusY = Math.max(radiusY, 20)
    
    // Calculate opacity based on leak size - reduced for better map visibility
    const opacity = Math.min(0.15 + (leakSize / 200), 0.3)
    
    // Create multiple concentric ellipses for gradient effect
    const ellipses = []
    const layers = 5
    
    for (let i = 0; i < layers; i++) {
      const factor = 1 - (i / layers) * 0.7
      const currentRadiusX = radiusX * factor
      const currentRadiusY = radiusY * factor
      const currentOpacity = opacity * (1 - i / layers)
      
      // Use polygon to approximate ellipse
      const points = []
      const segments = 36
      for (let j = 0; j <= segments; j++) {
        const angle = (j / segments) * 2 * Math.PI
        const lat = center[0] + (currentRadiusY / 111320) * Math.sin(angle)
        const lng = center[1] + (currentRadiusX / (111320 * Math.cos(center[0] * Math.PI / 180))) * Math.cos(angle)
        points.push([lat, lng])
      }
      
      const ellipse = L.polygon(points, {
        color: 'transparent',
        fillColor: '#e53e3e',
        fillOpacity: currentOpacity,
        weight: i === 0 ? 2 : 0,
        stroke: i === 0,
        ...(i === 0 && { color: '#e53e3e' })
      })
      
      ellipse.addTo(map)
      ellipses.push(ellipse)
    }
    
    return () => {
      ellipses.forEach(e => map.removeLayer(e))
    }
  }, [center, leakSize, networkBounds, map])
  
  return null
}

// Component to center map on leak location
function CenterOnLeak({ leakLat, leakLng }) {
  const map = useMap()
  
  useEffect(() => {
    if (leakLat && leakLng) {
      map.setView([leakLat, leakLng], 16)
    }
  }, [leakLat, leakLng, map])
  
  return null
}

export default function LeakResultMap({ 
  nodes = [], 
  pipes = [], 
  leakLat,
  leakLng,
  leakSize = 0,
  affectedPipes = [],
  monitoredNode
}) {
  // Default center: Kathmandu Valley
  const defaultCenter = [27.7172, 85.3240]
  const defaultZoom = 14
  
  // Calculate network bounds to constrain leak zone
  const networkBounds = useMemo(() => calculateNetworkBounds(nodes), [nodes])
  
  // Find the nearest node to the predicted leak coordinates
  const nearestNode = useMemo(() => {
    if (!leakLat || !leakLng || nodes.length === 0) return null
    return findNearestNode(nodes, leakLat, leakLng)
  }, [nodes, leakLat, leakLng])
  
  // Use nearest node coordinates if found, otherwise use predicted coordinates
  // This snaps the leak marker to the nearest actual network node
  const actualLeakLat = nearestNode?.coordinates?.lat || leakLat
  const actualLeakLng = nearestNode?.coordinates?.lng || leakLng
  
  // Build node lookup for pipe rendering
  const nodeMap = {}
  nodes.forEach(node => {
    nodeMap[node.id] = node
  })
  
  // Create affected pipes set for quick lookup
  const affectedPipeSet = new Set(affectedPipes)
  
  // If we found a nearest node, also include pipes connected to it as potentially affected
  const enhancedAffectedPipes = useMemo(() => {
    const affected = new Set(affectedPipes)
    if (nearestNode) {
      pipes.forEach(pipe => {
        if (pipe.from_node === nearestNode.id || pipe.to_node === nearestNode.id) {
          affected.add(pipe.id)
        }
      })
    }
    return affected
  }, [affectedPipes, nearestNode, pipes])
  
  // Generate pipe coordinates with affected status
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
        isAffected: enhancedAffectedPipes.has(pipe.id),
        ...pipe
      }
    }
    return null
  }).filter(Boolean)

  return (
    <MapContainer
      center={defaultCenter}
      zoom={defaultZoom}
      style={{ height: '100%', width: '100%' }}
      scrollWheelZoom={true}
    >
      {/* OpenStreetMap 2D Tile Layer */}
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      
      {/* Center on actual leak location (snapped to nearest node) */}
      <CenterOnLeak leakLat={actualLeakLat} leakLng={actualLeakLng} />
      
      {/* Render pipes */}
      {pipeLines.map(pipe => (
        <Polyline
          key={pipe.id}
          positions={pipe.positions}
          pathOptions={{
            color: pipe.isAffected ? '#e53e3e' : '#4a90d9',
            weight: pipe.isAffected ? 4 : 2,
            opacity: pipe.isAffected ? 1 : 0.5
          }}
        />
      ))}
      
      {/* Elliptical Leak Zone - centered on nearest node, constrained to network bounds */}
      {actualLeakLat && actualLeakLng && (
        <EllipticalLeakZone 
          center={[actualLeakLat, actualLeakLng]} 
          leakSize={leakSize}
          networkBounds={networkBounds}
        />
      )}
      
      {/* Render nodes */}
      {nodes.map(node => {
        const isMonitored = monitoredNode?.id === node.id
        const isNearestToLeak = nearestNode?.id === node.id
        
        return (
          <CircleMarker
            key={node.id}
            center={[node.coordinates.lat, node.coordinates.lng]}
            radius={isMonitored ? 10 : isNearestToLeak ? 8 : 4}
            pathOptions={{
              color: isMonitored ? '#3182ce' : isNearestToLeak ? '#e53e3e' : '#38a169',
              fillColor: isMonitored ? '#3182ce' : isNearestToLeak ? '#e53e3e' : '#38a169',
              fillOpacity: isMonitored ? 0.9 : isNearestToLeak ? 0.9 : 0.4,
              weight: isMonitored ? 3 : isNearestToLeak ? 2 : 1
            }}
          />
        )
      })}
      
      {/* Leak center marker - at the snapped nearest node location */}
      {actualLeakLat && actualLeakLng && (
        <CircleMarker
          center={[actualLeakLat, actualLeakLng]}
          radius={10}
          pathOptions={{
            color: '#ffffff',
            fillColor: '#e53e3e',
            fillOpacity: 1,
            weight: 3
          }}
        />
      )}
    </MapContainer>
  )
}
