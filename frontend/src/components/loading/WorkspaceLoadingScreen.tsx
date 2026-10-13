import { useState, useEffect, useRef } from 'react';
import {
  Box,
  AlertTriangle,
  RefreshCw,
  ArrowRight,
} from 'lucide-react';
import { checkBackendHealth, listScenarios } from '../../api/client';
import { ThemeToggle } from '../ThemeToggle';
import './WorkspaceLoadingScreen.css';

interface WorkspaceLoadingScreenProps {
  onInitializationComplete: () => void;
  onAbortToLogin: () => void;
}

const STATUS_MESSAGES = [
  'Validating workspace access...',
  'Connecting to the resilience engine...',
  'Preparing the digital twin...',
  'Loading operational intelligence...',
];

export function WorkspaceLoadingScreen({
  onInitializationComplete,
  onAbortToLogin,
}: WorkspaceLoadingScreenProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [progressPercent, setProgressPercent] = useState(15);
  const [initError, setInitError] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);

  const isMountedRef = useRef(true);

  const startInitialization = async () => {
    setInitError(null);
    setProgressPercent(20);
    setCurrentStepIndex(0);

    try {
      // Step 1: Validating workspace access
      await new Promise((r) => setTimeout(r, 200));
      if (!isMountedRef.current) return;
      setProgressPercent(45);
      setCurrentStepIndex(1); // "Connecting to the resilience engine..."

      // Step 2: Real backend connectivity check
      const health = await checkBackendHealth();
      if (!health || health.status !== 'healthy') {
        throw new Error('Backend health check returned non-healthy status.');
      }
      if (!isMountedRef.current) return;
      setProgressPercent(70);
      setCurrentStepIndex(2); // "Preparing the digital twin..."

      // Step 3: Real scenario catalog preload
      const scenarios = await listScenarios();
      if (!scenarios || scenarios.length === 0) {
        throw new Error('No scenario definitions available from the backend.');
      }
      if (!isMountedRef.current) return;
      setProgressPercent(95);
      setCurrentStepIndex(3); // "Loading operational intelligence..."

      // Step 4: Finalize transition
      await new Promise((r) => setTimeout(r, 200));
      if (!isMountedRef.current) return;
      setProgressPercent(100);

      await new Promise((r) => setTimeout(r, 150));
      if (!isMountedRef.current) return;
      onInitializationComplete();
    } catch (err) {
      if (!isMountedRef.current) return;
      const message =
        err instanceof Error
          ? err.message
          : 'Failed to establish connectivity with the FastAPI resilience backend.';
      setInitError(message);
    }
  };

  useEffect(() => {
    isMountedRef.current = true;
    startInitialization();
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const handleRetry = () => {
    setIsRetrying(true);
    setInitError(null);
    startInitialization().finally(() => {
      if (isMountedRef.current) {
        setIsRetrying(false);
      }
    });
  };

  // Option to proceed even if backend offline (with honest offline disclaimer)
  const handleProceedOffline = () => {
    onInitializationComplete();
  };

  return (
    <div className="loading-screen" role="status" aria-live="polite">
      <div className="loading-container">
        <div className="loading-header-actions">
          <ThemeToggle />
        </div>

        {/* Animated Brand Mark */}
        <div className="loading-brand-visual">
          <div className="loading-logo-halo" />
          <div className="loading-logo-core">
            <Box size={36} className="loading-box-icon" />
          </div>
        </div>

        {/* Dynamic Nodes Graphic */}
        <div className="loading-network-track">
          <svg className="loading-track-svg" viewBox="0 0 320 60" fill="none">
            <line
              x1="30"
              y1="30"
              x2="290"
              y2="30"
              stroke="var(--border-medium)"
              strokeWidth="2"
              strokeDasharray="4 4"
            />
            {/* Pulsing delivery flow line */}
            <line
              x1="30"
              y1="30"
              x2={`${30 + (progressPercent / 100) * 260}`}
              y2="30"
              stroke="var(--accent-teal)"
              strokeWidth="3"
              className="loading-flow-line"
            />
            <circle cx="30" cy="30" r="9" fill="var(--accent-blue)" />
            <circle cx="116" cy="30" r="9" fill={progressPercent > 35 ? 'var(--accent-blue)' : 'var(--border-subtle)'} />
            <circle cx="203" cy="30" r="9" fill={progressPercent > 65 ? 'var(--accent-teal)' : 'var(--border-subtle)'} />
            <circle cx="290" cy="30" r="9" fill={progressPercent >= 95 ? 'var(--accent-green)' : 'var(--border-subtle)'} />
          </svg>
        </div>

        {/* Loading Message & Progress Bar */}
        {!initError ? (
          <div className="loading-status-block">
            <h2 className="loading-step-message">
              {STATUS_MESSAGES[currentStepIndex]}
            </h2>
            <div className="loading-progress-bar-bg">
              <div
                className="loading-progress-bar-fill"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <span className="loading-subtext">
              Initializing digital twin session • {progressPercent}%
            </span>
          </div>
        ) : (
          /* Real Backend Error & Retry Fallback */
          <div className="loading-error-block">
            <div className="loading-error-badge">
              <AlertTriangle size={18} />
              <span>Resilience Engine Connectivity Warning</span>
            </div>
            <p className="loading-error-details">{initError}</p>
            <p className="loading-error-note">
              The FastAPI backend at <code>http://127.0.0.1:8000/api/health</code> is not
              responding or could not be reached. Ensure the server is running via{' '}
              <code>uvicorn app.main:app</code>.
            </p>

            <div className="loading-error-actions">
              <button
                onClick={handleRetry}
                disabled={isRetrying}
                className="btn-loading-retry"
              >
                <RefreshCw size={14} className={isRetrying ? 'spin-icon' : ''} />
                <span>Retry Connection</span>
              </button>

              <button
                onClick={handleProceedOffline}
                className="btn-loading-offline"
              >
                <span>Proceed in Offline Mode</span>
                <ArrowRight size={14} />
              </button>

              <button
                onClick={onAbortToLogin}
                className="btn-loading-abort"
              >
                Back to Sign In
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
