import {
  Box,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  RotateCcw,
  LogOut,
  User as UserIcon,
  Shield,
} from 'lucide-react';
import type { HealthStatus } from '../types/models';
import type { User } from '../types/auth';
import { ThemeToggle } from './ThemeToggle';

interface NavigationHeaderProps {
  health: HealthStatus | null;
  loadingHealth: boolean;
  onRefreshHealth: () => void;
  onResetSession: () => void;
  currentUser?: User | null;
  onLogout?: () => void;
  onNavigateToLanding?: () => void;
}

export function NavigationHeader({
  health,
  loadingHealth,
  onRefreshHealth,
  onResetSession,
  currentUser,
  onLogout,
  onNavigateToLanding,
}: NavigationHeaderProps) {
  return (
    <header className="app-header">
      <div
        className="header-brand clickable"
        onClick={onNavigateToLanding}
        title="Return to Landing Page"
      >
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

        {/* Application Theme Toggle */}
        <ThemeToggle />

        {/* Global Reset Action */}
        <button
          className="btn-reset-nav"
          onClick={onResetSession}
          title="Reset experiment and clear shocks"
        >
          <RotateCcw size={14} />
          <span>Reset Session</span>
        </button>

        {/* User Identity & Demo Badge */}
        {currentUser && (
          <div className="header-user-identity" title="Active workspace session">
            <div className="user-avatar-badge" title={currentUser.email}>
              {currentUser.avatarInitials || <UserIcon size={14} />}
            </div>
            <div className="user-text-info">
              <span className="user-name-text">{currentUser.name}</span>
              <span className="user-demo-tag" title="Client-side session. No company-level data isolation.">
                <Shield size={10} /> DEMO MODE
              </span>
            </div>

            {onLogout && (
              <button
                className="btn-header-logout"
                onClick={onLogout}
                title="Log out and return to landing page"
                id="header-logout-button"
              >
                <LogOut size={14} />
                <span>Log Out</span>
              </button>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
