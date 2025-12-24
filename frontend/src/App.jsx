import { useState, useEffect } from 'react';
import './App.css';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import NetworkMap from './components/NetworkMap';
import PressureChart from './components/PressureChart';
import DemandChart from './components/DemandChart';
import StatisticsPanel from './components/StatisticsPanel';
import LeakPredictions from './components/LeakPredictions';
import { apiService } from './services/api';

function App() {
  const [networkData, setNetworkData] = useState(null);
  const [statistics, setStatistics] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = async () => {
    try {
      setError(null);
      const [network, stats] = await Promise.all([
        apiService.getNetworkData(),
        apiService.getStatistics(),
      ]);
      setNetworkData(network);
      setStatistics(stats);
      setLoading(false);
    } catch (err) {
      setError('Failed to connect to backend. Make sure the API server is running on port 8000.');
      setLoading(false);
      console.error('Error fetching data:', err);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      fetchData();
    }, 30000); // Refresh every 30 seconds

    return () => clearInterval(interval);
  }, [autoRefresh]);

  const handleRefresh = () => {
    setLoading(true);
    fetchData();
  };

  if (loading) {
    return (
      <div className="app">
        <div className="loading-container">
          <div className="spinner"></div>
          <p style={{ marginTop: '1rem', color: '#94a3b8' }}>Loading Water Supply Network...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="app">
        <div className="error-container">
          <div className="error-content">
            <h2>⚠️ Connection Error</h2>
            <p>{error}</p>
            <div style={{ marginTop: '1rem' }}>
              <p style={{ fontSize: '0.875rem', color: '#94a3b8' }}>
                Start the backend server:
              </p>
              <code style={{ 
                display: 'block', 
                background: '#1e293b', 
                padding: '0.5rem', 
                borderRadius: '4px',
                marginTop: '0.5rem' 
              }}>
                cd backend && python main.py
              </code>
            </div>
            <button className="btn btn-primary" onClick={handleRefresh} style={{ marginTop: '1.5rem' }}>
              Retry Connection
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <Header 
        autoRefresh={autoRefresh}
        onToggleAutoRefresh={() => setAutoRefresh(!autoRefresh)}
        onRefresh={handleRefresh}
      />
      <div className="main-container">
        <Sidebar statistics={statistics} />
        <main className="content">
          <div className="dashboard-grid">
            <div className="grid-item map-section">
              <NetworkMap 
                networkData={networkData}
                selectedNode={selectedNode}
                onNodeSelect={setSelectedNode}
              />
              {console.log('Selected Node in App:', networkData)}

            </div>
            
            <div className="grid-item">
              <LeakPredictions selectedNode={selectedNode} />
            </div>

            <div className="grid-item">
              <PressureChart nodeId={selectedNode || 'J1'} />
            </div>

            <div className="grid-item">
              <DemandChart nodeId={selectedNode || 'J1'} />
            </div>

            <div className="grid-item stats-section">
              <StatisticsPanel statistics={statistics} />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;
