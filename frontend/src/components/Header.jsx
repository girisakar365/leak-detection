import { RefreshCw } from 'lucide-react';
import './Header.css';

function Header({ autoRefresh, onToggleAutoRefresh, onRefresh }) {
  return (
    <header className="header">
      <div className="header-content">
        <div className="header-left">
          <div className="logo">
            <div className="logo-icon">💧</div>
            <div>
              <h1>Water Supply Monitor</h1>
              <p className="subtitle">Leak Detection & Network Analysis</p>
            </div>
          </div>
        </div>
        
        <div className="header-right">
          <label className="auto-refresh-toggle">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={onToggleAutoRefresh}
            />
            <span>Auto-Refresh (30s)</span>
          </label>
          
          <button className="btn btn-primary refresh-btn" onClick={onRefresh}>
            <RefreshCw size={16} />
            <span>Refresh</span>
          </button>
        </div>
      </div>
    </header>
  );
}

export default Header;
