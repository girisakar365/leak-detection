import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, CircleMarker, Circle, Polyline, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar } from 'recharts';
import { apiService } from '../services/api';
import { transformToGPS, getNetworkBounds } from '../utils/coordinateTransform';
import './ResultsPage.css';

function toRad(x) { return x * Math.PI / 180; }
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

export default function ResultsPageFixed() {
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
      const [net, predictions] = await Promise.all([apiService.getNetworkData(), apiService.getLeakPredictions()]);
      setNetwork(net || { nodes: [], pipes: [], total_nodes: 0, total_pipes: 0, system_status: 'unknown' });
      setPred(predictions || { leak_x: [], leak_y: [], leak_size_lps: [] });

      const nodesWithGps = (net.nodes || []).map(n => ({ ...n, gps: transformToGPS(n.coordinates.x, n.coordinates.y) }));

      let predGps = null;
      if (predictions) {
        if (Array.isArray(predictions.leak_x) && Array.isArray(predictions.leak_y) && predictions.leak_x.length) {
          predGps = transformToGPS(predictions.leak_x[0], predictions.leak_y[0]);
        } else if (predictions.node_id) {
          const n = nodesWithGps.find(x => x.id === predictions.node_id);
          if (n) predGps = n.gps;
        }
      }

      if (predGps && nodesWithGps.length) {
        let min = Infinity; let nearest = null;
        for (const n of nodesWithGps) {
          const d = haversine(predGps.lat, predGps.lng, n.gps.lat, n.gps.lng);
          if (d < min) { min = d; nearest = n; }
        }
        setNearestNode(nearest);
        try { const gen = await apiService.generateData({ nodeId: nearest.id }); setSimData(gen || {}); } catch (e) { console.warn('generateData failed', e); }
      }
    } catch (e) { console.error('loadAll failed', e); }
    setLoading(false);
  }

  useEffect(() => {
    if (!simData) { setPressureSeries([]); setDemandSeries([]); return; }
    const ph = simData.pressure_history || [];
    const ps = [];
    if (ph.length) {
      const keys = Object.keys(ph[0] || {});
      let col = keys[0];
      if (nearestNode) { const f = keys.find(k => k.includes(nearestNode.id)); if (f) col = f; }
      for (let i=0;i<ph.length;i++) {
        const v = ph[i][col];
        if (Array.isArray(v)) { const nums=v.filter(n=>typeof n==='number'); ps.push({time:i,pressure: nums.length?nums.reduce((a,b)=>a+b)/nums.length:null}); }
        else if (typeof v==='number') ps.push({time:i,pressure:v});
        else ps.push({time:i,pressure:null});
      }
    }
    setPressureSeries(ps);

    const dh = simData.demand_history || simData.leak_demand_time || [];
    const ds = Array.isArray(dh) ? dh.map((v,i)=>({ time:i, demand: typeof v==='number'?v:(Object.values(v||{})[0]||null)})) : [];
    setDemandSeries(ds);
  }, [simData, nearestNode]);

  if (loading) return <div className="results-page loading"><div className="loading-spinner"/>Loading...</div>;

  const transformedNodes = (network.nodes||[]).map(n=>({...n,gps:transformToGPS(n.coordinates.x,n.coordinates.y)}));
  const transformedPipes = (network.pipes||[]).map(p=>{ const a=transformedNodes.find(n=>n.id===p.from_node); const b=transformedNodes.find(n=>n.id===p.to_node); return a&&b?{...p,positions:[[a.gps.lat,a.gps.lng],[b.gps.lat,b.gps.lng]]}:null; }).filter(Boolean);

  const leakLocations = [];
  if (pred) {
    if (pred.node_id) { const node = transformedNodes.find(n=>n.id===pred.node_id); if (node) leakLocations.push({ id: node.id, gps: node.gps, size: (pred.leak_size_lps && pred.leak_size_lps[0])||0.1, radius: 30 }); }
    if (Array.isArray(pred.leak_x) && Array.isArray(pred.leak_y)) {
      for (let i=0;i<Math.min(pred.leak_x.length,pred.leak_y.length);i++) { const gps = transformToGPS(pred.leak_x[i], pred.leak_y[i]); leakLocations.push({ id:`L${i}`, gps, size:(pred.leak_size_lps&&pred.leak_size_lps[i])||0.1, radius:20+((pred.leak_size_lps&&pred.leak_size_lps[i])||0.1)*10 }); }
    }
  }

  const getLeakColor = s => { const max = Math.max(...leakLocations.map(l=>l.size||0.1),0.1); const intensity = s/max; if (intensity>0.7) return '#ef4444'; if (intensity>0.4) return '#f59e0b'; return '#eab308'; };

  return (
    <div className="results-page">
      <div className="page-header"><h2>Leak Detection Results</h2></div>
      <div className="dashboard-grid">
        <div className="map-pane">
          <MapContainer center={[27.7172,85.3240]} zoom={13} style={{height:'100%',width:'100%'}} whenCreated={m=>mapRef.current=m}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            {transformedPipes.map(pipe => (<Polyline key={pipe.id} positions={pipe.positions} pathOptions={{color:'#60a5fa', weight:2}}/>))}
            {transformedNodes.map(node => (<CircleMarker key={node.id} center={[node.gps.lat,node.gps.lng]} radius={4} pathOptions={{fillColor:'#3b82f6'}}/>))}
            {leakLocations.map(l => (<React.Fragment key={l.id}><Circle center={[l.gps.lat,l.gps.lng]} radius={l.radius*1.5} pathOptions={{fillColor:getLeakColor(l.size),fillOpacity:0.12,color:'transparent'}} /><CircleMarker center={[l.gps.lat,l.gps.lng]} radius={6} pathOptions={{fillColor:getLeakColor(l.size)}}><Popup>Leak {l.id}</Popup></CircleMarker></React.Fragment>))}
            {nearestNode && nearestNode.gps && (<CircleMarker center={[nearestNode.gps.lat, nearestNode.gps.lng]} radius={8} pathOptions={{fillColor:'#ef4444'}}><Popup><strong>{nearestNode.id}</strong></Popup></CircleMarker>)}
          </MapContainer>
        </div>
        <div className="charts-pane">
          <div className="chart-card"><div className="chart-title">Pressure Over Time</div><div style={{height:240}}><ResponsiveContainer width="100%" height="100%"><LineChart data={pressureSeries}><CartesianGrid stroke="#eee"/><XAxis dataKey="time"/><YAxis/><Tooltip/><Line type="monotone" dataKey="pressure" stroke="#60a5fa" dot={false}/></LineChart></ResponsiveContainer></div></div>
          <div className="chart-card"><div className="chart-title">Demand</div><div style={{height:240}}><ResponsiveContainer width="100%" height="100%"><BarChart data={demandSeries}><CartesianGrid stroke="#eee"/><XAxis dataKey="time"/><YAxis/><Tooltip/><Bar dataKey="demand" fill="#3b82f6"/></BarChart></ResponsiveContainer></div></div>
        </div>
      </div>
    </div>
  );
}
