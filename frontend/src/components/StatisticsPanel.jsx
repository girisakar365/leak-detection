import { TrendingUp, TrendingDown, Activity } from 'lucide-react';
import './StatisticsPanel.css';

function StatisticsPanel({ statistics }) {
  if (!statistics) return null;

  const stats = [
    {
      label: 'Total Network Nodes',
      value: statistics.total_nodes,
      icon: <Activity size={24} />,
      color: '#3b82f6',
      trend: 'stable',
    },
    {
      label: 'Active Pipes',
      value: statistics.active_pipes,
      icon: <TrendingUp size={24} />,
      color: '#10b981',
      trend: 'up',
    },
    {
      label: 'High Risk Nodes',
      value: statistics.high_risk_nodes,
      icon: <TrendingDown size={24} />,
      color: '#ef4444',
      trend: statistics.high_risk_nodes > 5 ? 'up' : 'down',
    },
    {
      label: 'Medium Risk Nodes',
      value: statistics.medium_risk_nodes,
      icon: <Activity size={24} />,
      color: '#f59e0b',
      trend: 'stable',
    },
    {
      label: 'Low Risk Nodes',
      value: statistics.low_risk_nodes,
      icon: <Activity size={24} />,
      color: '#eab308',
      trend: 'stable',
    },
    {
      label: 'Average Pressure',
      value: `${statistics.average_pressure} psi`,
      icon: <TrendingUp size={24} />,
      color: '#8b5cf6',
      trend: 'up',
    },
    {
      label: 'Total Flow Rate',
      value: `${statistics.total_flow.toFixed(0)} GPM`,
      icon: <Activity size={24} />,
      color: '#06b6d4',
      trend: 'stable',
    },
    {
      label: 'System Status',
      value: statistics.system_status.toUpperCase(),
      icon: <Activity size={24} />,
      color: '#10b981',
      trend: 'stable',
    },
  ];

  return (
    <div className="statistics-panel">
      <div className="panel-header">
        <h3>Network Statistics Overview</h3>
        <span className="last-update">
          Last updated: {new Date(statistics.last_updated).toLocaleTimeString()}
        </span>
      </div>

      <div className="stats-grid">
        {stats.map((stat, index) => (
          <div key={index} className="stat-box">
            <div className="stat-box-icon" style={{ background: `${stat.color}20`, color: stat.color }}>
              {stat.icon}
            </div>
            <div className="stat-box-content">
              <div className="stat-box-label">{stat.label}</div>
              <div className="stat-box-value">{stat.value}</div>
            </div>
            <div className={`stat-box-trend trend-${stat.trend}`}>
              {stat.trend === 'up' && '↑'}
              {stat.trend === 'down' && '↓'}
              {stat.trend === 'stable' && '→'}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default StatisticsPanel;
