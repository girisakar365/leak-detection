import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, CircleMarker, Circle, Polyline, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar } from 'recharts';
import { apiService } from '../services/api';
import { transformToGPS, getNetworkBounds } from '../utils/coordinateTransform';
import './ResultsPage.css';

// Helper: haversine distance (meters)
function toRad(x) { return x * Math.PI / 180; }
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000; // m
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

const ResultsPage = () => {
  const [loading, setLoading] = useState(true);
  const [network, setNetwork] = useState({ nodes: [], pipes: [], total_nodes: 0, total_pipes: 0, system_status: 'unknown' });
  const [pred, setPred] = useState(null);
  const [nearestNode, setNearestNode] = useState(null);
  const [simData, setSimData] = useState(null);
  const [pressureSeries, setPressureSeries] = useState([]);
  const [demandSeries, setDemandSeries] = useState([]);
  const mapRef = useRef(null);

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    setLoading(true);
    try {
      const [net, predictions] = await Promise.all([
        apiService.getNetworkData(),
        apiService.getLeakPredictions()
      ]);
      setNetwork(net || { nodes: [], pipes: [], total_nodes: 0, total_pipes: 0, system_status: 'unknown' });
      setPred(predictions || { leak_x: [], leak_y: [], leak_size_lps: [] });

      // Map nodes to GPS
      const nodesWithGps = (net.nodes || []).map(n => ({ ...n, gps: transformToGPS(n.coordinates.x, n.coordinates.y) }));

      // find predicted coordinate
      let predGps = null;
      if (predictions) {
        if (Array.isArray(predictions.leak_x) && predictions.leak_x.length && Array.isArray(predictions.leak_y) && predictions.leak_y.length) {
          predGps = transformToGPS(predictions.leak_x[0], predictions.leak_y[0]);
        } else if (predictions.node_id) {
          const node = nodesWithGps.find(n => n.id === predictions.node_id);
          if (node) predGps = node.gps;
        }
      }

      // nearest node
      if (predGps && nodesWithGps.length) {
        let min = Infinity; let nearest = null;
        for (const n of nodesWithGps) {
          const d = haversine(predGps.lat, predGps.lng, n.gps.lat, n.gps.lng);
          if (d < min) { min = d; nearest = n; }
        }
        setNearestNode(nearest);

        // fetch simulation for nearest node (best-effort)
        try {
          const gen = await apiService.generateData({ nodeId: nearest.id });
          setSimData(gen || {});
        } catch (e) {
          console.warn('generateData failed', e?.message || e);
        }
      }
    } catch (err) {
      console.error('ResultsPage loadAll error', err);
    } finally {
      setLoading(false);
    }
  }

  // parse simData into chart series
  useEffect(() => {
    if (!simData) { setPressureSeries([]); setDemandSeries([]); return; }

    const ph = simData.pressure_history || [];
    const ps = [];
    if (ph && ph.length) {
      const firstEntry = ph[0] || {};
      const keys = Object.keys(firstEntry);
      let column = keys[0];
      if (nearestNode) {
        const found = keys.find(k => k.includes(nearestNode.id));
        if (found) column = found;
      }
      if (column) {
        for (let i = 0; i < ph.length; i++) {
          const entry = ph[i] || {};
          const val = entry[column];
          if (Array.isArray(val)) {
            const nums = val.filter(v => typeof v === 'number');
            ps.push({ time: i, pressure: nums.length ? nums.reduce((a,b)=>a+b,0)/nums.length : null });
          } else if (typeof val === 'number') ps.push({ time: i, pressure: val });
          else ps.push({ time: i, pressure: null });
        }
      }
    }
    setPressureSeries(ps);

    const dh = simData.demand_history || simData.leak_demand_time || null;
    const ds = [];
    if (dh) {
      if (Array.isArray(dh)) {
        for (let i=0;i<dh.length;i++) ds.push({ time: i, demand: typeof dh[i] === 'number' ? dh[i] : (Object.values(dh[i] || {})[0] ?? null) });
      } else if (typeof dh === 'object') {
        const keys = Object.keys(dh);
        for (let i=0;i<keys.length;i++) {
          const k = keys[i]; const v = dh[k];
          if (typeof v === 'number') ds.push({ time: k, demand: v });
          else if (Array.isArray(v)) ds.push({ time: k, demand: v.length ? v.reduce((a,b)=>a+b,0)/v.length : null });
        }
      }
    }
    setDemandSeries(ds);
  }, [simData, nearestNode]);

  if (loading) return (
    <div className="results-page loading"><div className="loading-spinner" /><p>Loading results...</p></div>
  );

  // transform for display
  const transformedNodes = (network.nodes || []).map(n => ({ ...n, gps: transformToGPS(n.coordinates.x, n.coordinates.y) }));
  const transformedPipes = (network.pipes || []).map(p => {
    const a = transformedNodes.find(n => n.id === p.from_node);
    const b = transformedNodes.find(n => n.id === p.to_node);
    return a && b ? { ...p, positions: [[a.gps.lat, a.gps.lng], [b.gps.lat, b.gps.lng]] } : null;
  }).filter(Boolean);

  // build leak locations list
  const leakLocations = [];
  if (pred) {
    if (pred.node_id) {
      const node = transformedNodes.find(n => n.id === pred.node_id);
      if (node) leakLocations.push({ id: node.id, gps: node.gps, size: (pred.leak_size_lps && pred.leak_size_lps[0]) || 0.1, radius: 30 });
    }
    if (Array.isArray(pred.leak_x) && Array.isArray(pred.leak_y)) {
      for (let i=0;i<Math.min(pred.leak_x.length, pred.leak_y.length); i++) {
        const gps = transformToGPS(pred.leak_x[i], pred.leak_y[i]);
        leakLocations.push({ id: `L${i}`, gps, size: (pred.leak_size_lps && pred.leak_size_lps[i]) || 0.1, radius: 20 + ((pred.leak_size_lps && pred.leak_size_lps[i]) || 0.1) * 10 });
      }
    }
  }

  const maxLeakSize = leakLocations.length ? Math.max(...leakLocations.map(l => l.size || 0.1)) : 0.1;

  const calculateDistance = (lat1, lon1, lat2, lon2) => haversine(lat1, lon1, lat2, lon2);
  const getLeakColor = (size) => {
    const intensity = size / Math.max(maxLeakSize, 0.0001);
    if (intensity > 0.7) return '#ef4444';
    if (intensity > 0.4) return '#f59e0b';
    return '#eab308';
  };

  const bounds = getNetworkBounds(network.nodes || []);

  return (
    <div className="results-page">
      <div className="page-header"><h2>Leak Detection Dashboard</h2></div>

      <div className="info-row">
        <div className="info-card"><div className="info-title">Average Pressure</div><div className="info-value">{(simData && simData.average_pressure) ? Number(simData.average_pressure).toFixed(2) + ' kPa' : '—'}</div></div>
        <div className="info-card"><div className="info-title">Total Nodes</div><div className="info-value">{network.total_nodes ?? (network.nodes ? network.nodes.length : 0)}</div></div>
        <div className="info-card"><div className="info-title">Total Pipes</div><div className="info-value">{network.total_pipes ?? (network.pipes ? network.pipes.length : 0)}</div></div>
        <div className="info-card"><div className="info-title">System Status</div><div className="info-value">{network.system_status || 'unknown'}</div></div>
      </div>

      <div className="dashboard-grid">
        <div className="map-pane">
          <MapContainer center={[27.7172, 85.3240]} zoom={13} style={{ height: '100%', width: '100%' }} whenCreated={m => (mapRef.current = m)}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            {transformedPipes.map(pipe => (<Polyline key={pipe.id} positions={pipe.positions} pathOptions={{ color: '#60a5fa', weight: 2, opacity: 0.8 }} />))}
            {transformedNodes.map(node => (<CircleMarker key={node.id} center={[node.gps.lat, node.gps.lng]} radius={4} pathOptions={{ fillColor: '#3b82f6', color: '#1e40af', weight: 1, fillOpacity: 0.9 }} />))}

            {leakLocations.map(leak => (
              <React.Fragment key={leak.id}>
                <Circle center={[leak.gps.lat, leak.gps.lng]} radius={leak.radius * 1.5} pathOptions={{ fillColor: getLeakColor(leak.size), color: 'transparent', fillOpacity: 0.1 }} />
                <Circle center={[leak.gps.lat, leak.gps.lng]} radius={leak.radius} pathOptions={{ fillColor: getLeakColor(leak.size), color: getLeakColor(leak.size), weight: 2, fillOpacity: 0.3, opacity: 0.6 }} />
                <CircleMarker center={[leak.gps.lat, leak.gps.lng]} radius={5} pathOptions={{ fillColor: getLeakColor(leak.size), color: '#ffffff', weight: 1, fillOpacity: 1 }}>
                  <Popup><div>Predicted Leak ({leak.id})</div></Popup>
                </CircleMarker>
              </React.Fragment>
            ))}

            {nearestNode && nearestNode.gps && (
              <CircleMarker center={[nearestNode.gps.lat, nearestNode.gps.lng]} radius={8} pathOptions={{ fillColor: '#ef4444', color: '#9b111e', weight: 1, fillOpacity: 0.9 }}>
                <Popup><div><strong>{nearestNode.id}</strong><br/>Nearest predicted node</div></Popup>
              </CircleMarker>
            )}
          </MapContainer>
        </div>

        <div className="charts-pane">
          <div className="chart-card">
            <div className="chart-title">Pressure Over Time</div>
            <div style={{ height: 240 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={pressureSeries}><CartesianGrid stroke="#111827" /><XAxis dataKey="time" stroke="#94a3b8" /><YAxis stroke="#94a3b8" /><Tooltip /><Line type="monotone" dataKey="pressure" stroke="#60a5fa" dot={false} /></LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="chart-card">
            <div className="chart-title">Demand Analysis</div>
            <div style={{ height: 240 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={demandSeries}><CartesianGrid stroke="#111827" /><XAxis dataKey="time" stroke="#94a3b8" /><YAxis stroke="#94a3b8" /><Tooltip /><Bar dataKey="demand" fill="#3b82f6" /></BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      <div className="legend">
        <h3>Legend</h3>
        <div className="legend-item"><div className="legend-color" style={{ background: '#ef4444' }}></div><span>High Leak Intensity</span></div>
        <div className="legend-item"><div className="legend-color" style={{ background: '#f59e0b' }}></div><span>Medium Leak Intensity</span></div>
        <div className="legend-item"><div className="legend-color" style={{ background: '#eab308' }}></div><span>Low Leak Intensity</span></div>
        <div className="legend-item"><div className="legend-color" style={{ background: '#64748b' }}></div><span>Unaffected Infrastructure</span></div>
      </div>
    </div>
  );
};


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
