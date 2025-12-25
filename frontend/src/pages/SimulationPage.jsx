import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, CircleMarker, Polyline, Popup, useMap } from 'react-leaflet';
import { X, BarChart3 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import 'leaflet/dist/leaflet.css';
import { apiService } from '../services/api';
import { transformToGPS, getNetworkBounds } from '../utils/coordinateTransform';
import './SimulationPage.css';

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

const SimulationPage = () => {
  const navigate = useNavigate();
  const [networkData, setNetworkData] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [loading, setLoading] = useState(true);
  const [simulating, setSimulating] = useState(false);
  const [showInputForm, setShowInputForm] = useState(false);
  
  // Form inputs
  const [emitterCof, setEmitterCof] = useState(0.5);
  const [duration, setDuration] = useState(4);
  const [startTime, setStartTime] = useState(0);

  useEffect(() => {
    loadNetworkData();
  }, []);

  const loadNetworkData = async () => {
    try {
      setLoading(true);
      const data = await apiService.getNetworkData();
      setNetworkData(data);
    } catch (error) {
      console.error('Failed to load network data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleNodeClick = (node) => {
    setSelectedNode(node);
    setShowInputForm(true);
  };

  const handleCloseForm = () => {
    setShowInputForm(false);
    setSelectedNode(null);
  };

  const handleSimulate = async () => {
    if (!selectedNode) return;

    try {
      setSimulating(true);
      const result = await apiService.generateData({
        nodeId: selectedNode.id,
        emitterCof: emitterCof,
        collectionStartHour: 0,
        leakStartMin: startTime*60,
        leakDurationHours: duration
      });
      
      console.log('Simulation completed:', result);
      alert(`Simulation completed for node ${selectedNode.id}`);
      handleCloseForm();
    } catch (error) {
      console.error('Simulation failed:', error);
      alert('Simulation failed. Please try again.');
    } finally {
      setSimulating(false);
    }
  };

  if (loading) {
    return (
      <div className="simulation-page loading">
        <div className="loading-spinner"></div>
        <p>Loading network data...</p>
      </div>
    );
  }

  if (!networkData) {
    return (
      <div className="simulation-page error">
        <p>Failed to load network data</p>
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
  return (
    <div className="simulation-page">
      <div className="page-header">
        <div>
          <h1>Water Supply Network - Leak Simulation</h1>
          <p>Click on any node to simulate leak detection</p>
        </div>
        <button className="nav-button" onClick={() => navigate('/results')}>
          <BarChart3 size={20} />
          View Results
        </button>
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
          
          {/* Pipes as lines */}
          {transformedPipes.map(pipe => (
            <Polyline
              key={pipe.id}
              positions={pipe.positions}
              pathOptions={{
                color: '#1663c2ff',
                weight: 3,
                opacity: 0.8
              }}
            />
          ))}
          
          {/* Nodes as circles */}
          {transformedNodes.map(node => (
            <CircleMarker
              key={node.id}
              center={[node.gps.lat, node.gps.lng]}
              radius={4}
              pathOptions={{
                fillColor: '#3b82f6',
                color: '#1e40af',
                weight: 1,
                opacity: 1,
                fillOpacity: 0.8
              }}
              eventHandlers={{
                click: () => handleNodeClick(node)
              }}
            >
              <Popup>
                <div className="node-popup">
                  <strong>{node.id}</strong>
                  <p>Type: {node.type}</p>
                  <p>Elevation: {node.elevation?.toFixed(2) || 'N/A'} m</p>
                </div>
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>
      </div>

      {/* Input Form Modal */}
      {showInputForm && selectedNode && (
        <div className="modal-overlay">
          <div className="input-form-modal">
            <div className="modal-header">
              <h2>Simulate Leak at Node {selectedNode.id}</h2>
              <button className="close-btn" onClick={handleCloseForm}>
                <X size={24} />
              </button>
            </div>
            
            <div className="modal-body">
              <div className="form-group">
                <label htmlFor="emitter-cof">
                  Emitter Coefficient
                  <span className="range-hint">(0.01389 - 0.5556)</span>
                </label>
                <input
                  id="emitter-cof"
                  type="number"
                  min="0.01389"
                  max="0.5556"
                  step="0.01"
                  value={emitterCof}
                  onChange={(e) => setEmitterCof(parseFloat(e.target.value))}
                />
              </div>

              <div className="form-group">
                <label htmlFor="start-time">
                  Start Time (hour)
                  <span className="range-hint">(0 - 23)</span>
                </label>
                <input
                  id="start-time"
                  type="number"
                  min="0"
                  max="23"
                  step="1"
                  value={startTime}
                  onChange={(e) => setStartTime(parseInt(e.target.value))}
                />
              </div>

              <div className="form-group">
                <label htmlFor="duration">
                  Monitoring Duration (hours)
                  <span className="range-hint">(1 - 24)</span>
                </label>
                <input
                  id="duration"
                  type="number"
                  min="1"
                  max="24"
                  step="1"
                  value={duration}
                  onChange={(e) => setDuration(parseInt(e.target.value))}
                />
              </div>
            </div>

            <div className="modal-footer">
              <button 
                className="btn btn-secondary" 
                onClick={handleCloseForm}
                disabled={simulating}
              >
                Cancel
              </button>
              <button 
                className="btn btn-primary" 
                onClick={handleSimulate}
                disabled={simulating}
              >
                {simulating ? 'Running Simulation...' : 'Run Simulation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SimulationPage;
