import {
  Box,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  RotateCcw,
} from 'lucide-react';
import type { HealthStatus } from '../types/models';

interface NavigationHeaderProps {
  health: HealthStatus | null;
  loadingHealth: boolean;
  onRefreshHealth: () => void;
  onResetSession: () => void;
}

export function NavigationHeader({
  health,
  loadingHealth,
  onRefreshHealth,
  onResetSession,
}: NavigationHeaderProps) {
  return (
    <header className="app-header">
      <div className="header-brand">
        <div className="logo-badge">
          <Box size={20} className="logo-icon" />
        </div>
        <div>
          <h1 className="header-title">ResilienceSim 3D</h1>
          <span className="header-subtitle">
            Supply Chain Resilience Intelligence & Recovery Digital Twin
          </span>
        </div>
      </div>

      <div className="header-right-actions">
        {/* Real Backend Connection Health Badge */}
        <div className="header-status-badge">
          {loadingHealth ? (
            <span className="status-tag status-loading">
              <RefreshCw size={13} className="spin-icon" /> Probing API...
            </span>
          ) : health && health.status === 'healthy' ? (
            <span
              className="status-tag status-healthy"
              title={`API online: ${health.service} v${health.version}`}
              onClick={onRefreshHealth}
            >
              <CheckCircle2 size={13} /> FastAPI Online (v{health.version})
            </span>
          ) : (
            <span
              className="status-tag status-error"
              title="FastAPI server unreachable"
              onClick={onRefreshHealth}
            >
              <AlertTriangle size={13} /> Backend Offline
            </span>
          )}
        </div>

        {/* Global Reset Action */}
        <button
          className="btn-reset-nav"
          onClick={onResetSession}
          title="Reset experiment and clear shocks"
        >
          <RotateCcw size={14} />
          <span>Reset Session</span>
        </button>
      </div>
    </header>
  );
}
