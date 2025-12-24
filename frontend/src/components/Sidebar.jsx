import { AlertTriangle, Activity, Droplets, TrendingUp } from 'lucide-react';
import './Sidebar.css';

function Sidebar({ statistics }) {
  if (!statistics) return null;

  const stats = [
    {
      label: 'Total Nodes',
      value: statistics.total_nodes,
      icon: <Droplets size={20} />,
      color: '#3b82f6',
    },
    {
      label: 'Active Pipes',
      value: statistics.active_pipes,
      icon: <Activity size={20} />,
      color: '#10b981',
    },
    {
      label: 'High Risk',
      value: statistics.high_risk_nodes,
      icon: <AlertTriangle size={20} />,
      color: '#ef4444',
    },
    {
      label: 'Medium Risk',
      value: statistics.medium_risk_nodes,
      icon: <AlertTriangle size={20} />,
      color: '#f59e0b',
    },
    {
      label: 'Avg Pressure',
      value: `${statistics.average_pressure} psi`,
      icon: <TrendingUp size={20} />,
      color: '#8b5cf6',
    },
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h2>Network Status</h2>
        <span className={`status-badge ${statistics.system_status === 'operational' ? 'status-operational' : ''}`}>
          {statistics.system_status}
        </span>
      </div>

      <div className="stats-list">
        {stats.map((stat, index) => (
          <div key={index} className="stat-card">
            <div className="stat-icon" style={{ background: `${stat.color}20`, color: stat.color }}>
              {stat.icon}
            </div>
            <div className="stat-content">
              <div className="stat-label">{stat.label}</div>
              <div className="stat-value">{stat.value}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="sidebar-footer">
        <div className="last-updated">
          <span className="label">Last Updated:</span>
          <span className="time">
            {new Date(statistics.last_updated).toLocaleTimeString()}
          </span>
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;
