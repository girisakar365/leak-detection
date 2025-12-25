import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, CircleMarker, Polyline, Circle, useMap } from 'react-leaflet';
import { PlayCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import 'leaflet/dist/leaflet.css';
import { apiService } from '../services/api';
import { transformToGPS, getNetworkBounds } from '../utils/coordinateTransform';
import './ResultsPage.css';

// Component to fit map bounds when network data loads
const FitBounds = ({ bounds }) => {
  const map = useMap();
  
  useEffect(() => {
    if (bounds) {
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [bounds, map]);
  
  return null;
};

const ResultsPage = () => {
  const navigate = useNavigate();
  const [networkData, setNetworkData] = useState(null);
  const [leakPredictions, setLeakPredictions] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [network, predictions] = await Promise.all([
        apiService.getNetworkData(),
        apiService.getLeakPredictions()
      ]);
      setNetworkData(network);
      setLeakPredictions(predictions);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="results-page loading">
        <div className="loading-spinner"></div>
        <p>Loading leak predictions...</p>
      </div>
    );
  }

  if (!networkData || !leakPredictions) {
    return (
      <div className="results-page error">
        <p>Failed to load prediction data</p>
      </div>
    );
  }

  const bounds = getNetworkBounds(networkData.nodes);

  // Transform node coordinates to GPS
  const transformedNodes = networkData.nodes.map(node => ({
    ...node,
    gps: transformToGPS(node.coordinates.x, node.coordinates.y)
  }));

  // Transform pipe coordinates
  const transformedPipes = networkData.pipes.map(pipe => {
    const fromNode = transformedNodes.find(n => n.id === pipe.from_node);
    const toNode = transformedNodes.find(n => n.id === pipe.to_node);
    
    return {
      ...pipe,
      positions: fromNode && toNode ? [
        [fromNode.gps.lat, fromNode.gps.lng],
        [toNode.gps.lat, toNode.gps.lng]
      ] : null
    };
  }).filter(pipe => pipe.positions);

  // Transform leak predictions to GPS coordinates
  const leakLocations = leakPredictions.leak_x.map((x, index) => {
    const y = leakPredictions.leak_y[index];
    const size = leakPredictions.leak_size_lps[index];
    const gps = transformToGPS(x, y);
    
    return {
      id: index,
      x,
      y,
      gps,
      size,
      // Calculate radius based on leak size (in meters)
      // Smaller radius for better localization
      radius: 20 + (size * 10) // Base 20m + proportional to size
    };
  });

  // Find nodes and pipes affected by leak (within radius)
  const getAffectedElements = (leakLocation) => {
    const affectedNodes = transformedNodes.filter(node => {
      const distance = calculateDistance(
        leakLocation.gps.lat, leakLocation.gps.lng,
        node.gps.lat, node.gps.lng
      );
      return distance <= leakLocation.radius;
    });

    const affectedPipes = transformedPipes.filter(pipe => {
      const fromNode = transformedNodes.find(n => n.id === pipe.from_node);
      const toNode = transformedNodes.find(n => n.id === pipe.to_node);
      
      if (!fromNode || !toNode) return false;
      
      const distanceFrom = calculateDistance(
        leakLocation.gps.lat, leakLocation.gps.lng,
        fromNode.gps.lat, fromNode.gps.lng
      );
      const distanceTo = calculateDistance(
        leakLocation.gps.lat, leakLocation.gps.lng,
        toNode.gps.lat, toNode.gps.lng
      );
      
      return distanceFrom <= leakLocation.radius || distanceTo <= leakLocation.radius;
    });

    return { affectedNodes, affectedPipes };
  };

  // Calculate distance in meters between two GPS coordinates
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371000; // Earth's radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  };

  // Get color based on leak intensity
  const getLeakColor = (size, maxSize) => {
    const intensity = size / maxSize;
    if (intensity > 0.7) return '#ef4444'; // Red - High
    if (intensity > 0.4) return '#f59e0b'; // Orange - Medium
    return '#eab308'; // Yellow - Low
  };

  const maxLeakSize = Math.max(...leakPredictions.leak_size_lps);

  return (
    <div className="results-page">
      <div className="page-header">
        <div>
          <h1>Leak Detection Results</h1>
          <p>Predicted leak locations with affected infrastructure</p>
        </div>
        <button className="nav-button" onClick={() => navigate('/simulation')}>
          <PlayCircle size={20} />
          New Simulation
        </button>
      </div>

      <div className="info-panel">
        <div className="info-card">
          <span className="info-label">Detected Leaks:</span>
          <span className="info-value">{leakLocations.length}</span>
        </div>
        <div className="info-card">
          <span className="info-label">Total Nodes:</span>
          <span className="info-value">{networkData.total_nodes}</span>
        </div>
        <div className="info-card">
          <span className="info-label">Total Pipes:</span>
          <span className="info-value">{networkData.total_pipes}</span>
        </div>
      </div>

      <div className="map-container">
        <MapContainer
          center={[27.7172, 85.3240]}
          zoom={14}
          style={{ height: '100%', width: '100%' }}
        >
          <FitBounds bounds={bounds} />
          
          {/* 2D Street Map */}
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />
          
          {/* All pipes (dimmed) */}
          {transformedPipes.map(pipe => {
            const isAffected = leakLocations.some(leak => {
              const { affectedPipes } = getAffectedElements(leak);
              return affectedPipes.some(p => p.id === pipe.id);
            });
            
            return (
              <Polyline
                key={pipe.id}
                positions={pipe.positions}
                pathOptions={{
                  color: isAffected ? '#f59e0b' : '#475569',
                  weight: isAffected ? 4 : 2,
                  opacity: isAffected ? 0.9 : 0.4
                }}
              />
            );
          })}
          
          {/* All nodes */}
          {transformedNodes.map(node => {
            const isAffected = leakLocations.some(leak => {
              const { affectedNodes } = getAffectedElements(leak);
              return affectedNodes.some(n => n.id === node.id);
            });
            
            return (
              <CircleMarker
                key={node.id}
                center={[node.gps.lat, node.gps.lng]}
                radius={isAffected ? 6 : 4}
                pathOptions={{
                  fillColor: isAffected ? '#ef4444' : '#6a94cfff',
                  color: isAffected ? '#dc2626' : '#375580ff',
                  weight: 1,
                  opacity: 1,
                  fillOpacity: isAffected ? 0.9 : 0.5
                }}
              />
            );
          })}
          
          {/* Leak location heatmap circles */}
          {leakLocations.map(leak => (
            <React.Fragment key={leak.id}>
              {/* Outer glow effect */}
              <Circle
                center={[leak.gps.lat, leak.gps.lng]}
                radius={leak.radius * 1.5}
                pathOptions={{
                  fillColor: getLeakColor(leak.size, maxLeakSize),
                  color: 'transparent',
                  fillOpacity: 0.1
                }}
              />
              
              {/* Middle ring */}
              <Circle
                center={[leak.gps.lat, leak.gps.lng]}
                radius={leak.radius}
                pathOptions={{
                  fillColor: getLeakColor(leak.size, maxLeakSize),
                  color: getLeakColor(leak.size, maxLeakSize),
                  weight: 2,
                  fillOpacity: 0.3,
                  opacity: 0.6
                }}
              />
              
              {/* Center point */}
              <CircleMarker
                center={[leak.gps.lat, leak.gps.lng]}
                radius={5}
                pathOptions={{
                  fillColor: getLeakColor(leak.size, maxLeakSize),
                  color: '#ffffff',
                  weight: 1,
                  fillOpacity: 1
                }}
              />
            </React.Fragment>
          ))}
        </MapContainer>
      </div>

      {/* Legend */}
      <div className="legend">
        <h3>Legend</h3>
        <div className="legend-item">
          <div className="legend-color" style={{ background: '#ef4444' }}></div>
          <span>High Leak Intensity</span>
        </div>
        <div className="legend-item">
          <div className="legend-color" style={{ background: '#f59e0b' }}></div>
          <span>Medium Leak Intensity</span>
        </div>
        <div className="legend-item">
          <div className="legend-color" style={{ background: '#eab308' }}></div>
          <span>Low Leak Intensity</span>
        </div>
        <div className="legend-item">
          <div className="legend-color" style={{ background: '#64748b' }}></div>
          <span>Unaffected Infrastructure</span>
        </div>
      </div>
    </div>
  );
};

export default ResultsPage;
