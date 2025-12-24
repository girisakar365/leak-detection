import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { apiService } from '../services/api';
import './LeakPredictions.css';

function LeakPredictions({ selectedNode }) {
  const [predictions, setPredictions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPredictions = async () => {
      try {
        setLoading(true);
        const data = await apiService.getLeakPredictions();
        setPredictions(data);
      } catch (error) {
        console.error('Error fetching leak predictions:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPredictions();
    const interval = setInterval(fetchPredictions, 10000); // Update every 10 seconds

    return () => clearInterval(interval);
  }, []);

  const getRiskClass = (level) => {
    switch (level.toLowerCase()) {
      case 'high': return 'risk-high';
      case 'medium': return 'risk-medium';
      case 'low': return 'risk-low';
      default: return 'risk-none';
    }
  };

  const filteredPredictions = selectedNode
    ? predictions.filter(p => p.node_id === selectedNode)
    : predictions.filter(p => p.risk_level !== 'none').slice(0, 5);

  return (
    <div className="leak-predictions">
      <div className="predictions-header">
        <div className="header-title">
          <AlertTriangle size={20} />
          <h3>Leak Predictions</h3>
        </div>
        {selectedNode && (
          <span className="filter-badge">Filtered: {selectedNode}</span>
        )}
      </div>

      {loading ? (
        <div className="predictions-loading">
          <div className="spinner"></div>
        </div>
      ) : filteredPredictions.length === 0 ? (
        <div className="no-predictions">
          <p>No significant leak risks detected</p>
        </div>
      ) : (
        <div className="predictions-list">
          {filteredPredictions.map((prediction) => (
            <div key={prediction.node_id} className="prediction-card">
              <div className="prediction-header">
                <span className="prediction-node">{prediction.node_id}</span>
                <span className={`risk-badge ${getRiskClass(prediction.risk_level)}`}>
                  {prediction.risk_level}
                </span>
              </div>
              
              <div className="prediction-body">
                <div className="prediction-stat">
                  <span className="stat-label">Leak Probability</span>
                  <span className="stat-value">{prediction.leak_probability.toFixed(1)}%</span>
                </div>
                
                <div className="probability-bar">
                  <div 
                    className={`probability-fill ${getRiskClass(prediction.risk_level)}`}
                    style={{ width: `${prediction.leak_probability}%` }}
                  ></div>
                </div>

                {prediction.affected_nodes.length > 0 && (
                  <div className="affected-nodes">
                    <span className="affected-label">Affected Nodes:</span>
                    <span className="affected-count">{prediction.affected_nodes.length}</span>
                  </div>
                )}
              </div>

              <div className="prediction-footer">
                <span className="prediction-time">
                  {new Date(prediction.timestamp).toLocaleTimeString()}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default LeakPredictions;
