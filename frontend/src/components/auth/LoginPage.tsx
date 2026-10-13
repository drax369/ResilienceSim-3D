import { useState, type FormEvent } from 'react';
import {
  Box,
  Eye,
  EyeOff,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  AlertCircle,
  HelpCircle,
  CheckCircle2,
  Lock,
  Sparkles,
} from 'lucide-react';
import {
  authService,
  DEMO_PREFILL_CREDENTIALS,
} from '../../services/authService';
import { ThemeToggle } from '../ThemeToggle';
import './LoginPage.css';

interface LoginPageProps {
  onLoginSuccess: () => void;
  onBackToHome: () => void;
}

export function LoginPage({ onLoginSuccess, onBackToHome }: LoginPageProps) {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false);

  // Quick fill demo credentials
  const handlePreFillDemo = () => {
    setIdentifier(DEMO_PREFILL_CREDENTIALS.email);
    setPassword(DEMO_PREFILL_CREDENTIALS.password);
    setErrorMessage(null);
  };

  // Instant demo bypass
  const handleInstantDemoLogin = () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      authService.loginWithDemoAccount(rememberMe);
      setTimeout(() => {
        setIsLoading(false);
        onLoginSuccess();
      }, 300);
    } catch {
      setIsLoading(false);
      setErrorMessage('Failed to initialize demo session.');
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const trimmedId = identifier.trim();
    if (!trimmedId) {
      setErrorMessage('Please enter your organization email or username.');
      return;
    }

    if (!password) {
      setErrorMessage('Please enter your password.');
      return;
    }

    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters in length.');
      return;
    }

    setIsLoading(true);

    try {
      authService.loginWithCredentials({
        identifier: trimmedId,
        password,
        rememberMe,
      });

      setTimeout(() => {
        setIsLoading(false);
        onLoginSuccess();
      }, 400);
    } catch {
      setIsLoading(false);
      setErrorMessage('An unexpected error occurred during workspace sign-in.');
    }
  };

  return (
    <div className="login-page">
      <div className="login-page-container">
        {/* Left / Primary Login Panel */}
        <div className="login-card">
          <div className="login-card-header">
            <div className="login-top-bar">
              <button
                onClick={onBackToHome}
                className="login-back-btn"
                title="Return to Landing Page"
              >
                <ArrowLeft size={16} />
                <span>Back to Home</span>
              </button>
              <ThemeToggle />
            </div>

            <div className="login-brand-lockup">
              <div className="login-logo-badge">
                <Box size={22} className="login-logo-icon" />
              </div>
              <div>
                <h1 className="login-title">ResilienceSim 3D</h1>
                <span className="login-subtitle">
                  Supply Chain Resilience Command Center
                </span>
              </div>
            </div>
          </div>

          {/* Demo Mode Notice Banner */}
          <div className="login-demo-banner">
            <div className="demo-banner-header">
              <Sparkles size={16} className="text-teal" />
              <span className="demo-banner-title">PROTOTYPE DEMONSTRATION MODE</span>
            </div>
            <p className="demo-banner-text">
              Real server-side LDAP/OAuth2 authentication is not configured in this
              hackathon deployment. Click below to explore with the pre-configured
              Demo Analyst account or enter any identifier.
            </p>
            <div className="demo-banner-actions">
              <button
                type="button"
                onClick={handleInstantDemoLogin}
                disabled={isLoading}
                className="btn-instant-demo"
                id="one-click-demo-login-btn"
              >
                <ShieldCheck size={15} />
                <span>One-Click Demo Access</span>
              </button>
              <button
                type="button"
                onClick={handlePreFillDemo}
                className="btn-prefill-demo"
              >
                Pre-Fill Demo Form
              </button>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="login-form" noValidate>
            {errorMessage && (
              <div className="login-error-alert" role="alert">
                <AlertCircle size={16} />
                <span>{errorMessage}</span>
              </div>
            )}

            <div className="form-group">
              <label htmlFor="login-identifier" className="form-label">
                Organization Email or Username
              </label>
              <input
                id="login-identifier"
                type="text"
                className="form-input"
                placeholder="name@company.com or username"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                autoComplete="username"
                disabled={isLoading}
                required
              />
            </div>

            <div className="form-group">
              <div className="form-label-row">
                <label htmlFor="login-password" className="form-label">
                  Password
                </label>
                <button
                  type="button"
                  className="btn-forgot-password"
                  onClick={() => setShowForgotPasswordModal(true)}
                >
                  Forgot password?
                </button>
              </div>
              <div className="password-input-wrapper">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  className="form-input password-input"
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  disabled={isLoading}
                  required
                />
                <button
                  type="button"
                  className="btn-toggle-password"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  tabIndex={0}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="form-checkbox-row">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  disabled={isLoading}
                />
                <span>Remember me for 30 days</span>
              </label>
            </div>

            <button
              type="submit"
              className="login-submit-btn"
              disabled={isLoading}
              id="login-submit-button"
            >
              {isLoading ? (
                <span className="spinner-label">
                  <span className="btn-spinner" /> Initializing Workspace...
                </span>
              ) : (
                <>
                  <span>Sign In to Digital Twin</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          <div className="login-footer-disclaimer">
            <Lock size={12} />
            <span>
              Demo access active. Client-side route guard only. No confidential data is verified.
            </span>
          </div>
        </div>

        {/* Right / Enterprise Showcase Panel (Visible on Desktop) */}
        <div className="login-showcase-panel">
          <div className="showcase-content">
            <span className="showcase-tag">OPERATIONAL RESILIENCE</span>
            <h2 className="showcase-headline">
              Constraint-Validated Supply Chain Digital Twin
            </h2>
            <p className="showcase-desc">
              Evaluate real-time multi-echelon network impacts, test alternative shipping
              corridors, and prove recovery plans before disruption events manifest in the
              physical world.
            </p>

            <div className="showcase-feature-list">
              <div className="showcase-feature-item">
                <div className="showcase-check">
                  <CheckCircle2 size={16} />
                </div>
                <div>
                  <strong>SimPy 4 Event Queue:</strong> Zero-delay micro-step replenishment
                  with dynamic conservation of material flow.
                </div>
              </div>

              <div className="showcase-feature-item">
                <div className="showcase-check">
                  <CheckCircle2 size={16} />
                </div>
                <div>
                  <strong>Google OR-Tools Optimization:</strong> Exact time-expanded
                  LP routing with backlog fulfillment and zero physical capacity violations.
                </div>
              </div>

              <div className="showcase-feature-item">
                <div className="showcase-check">
                  <CheckCircle2 size={16} />
                </div>
                <div>
                  <strong>3-Way Comparative Auditing:</strong> Immediate KPI delta
                  verification across Baseline, Disrupted, and Recovered states.
                </div>
              </div>
            </div>

            <div className="showcase-quote">
              <p>
                "Transforming supply chain vulnerability analysis into mathematical certainty."
              </p>
              <span>— ResilienceSim 3D Operations Architecture</span>
            </div>
          </div>
        </div>
      </div>

      {/* Forgot Password Modal (Clearly Explaining Demo Limitations) */}
      {showForgotPasswordModal && (
        <div
          className="modal-backdrop"
          onClick={() => setShowForgotPasswordModal(false)}
        >
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-icon-badge">
                <HelpCircle size={20} className="text-blue" />
              </div>
              <h3 className="modal-title">Password Reset in Demo Mode</h3>
            </div>
            <p className="modal-body">
              This deployment of <strong>ResilienceSim 3D</strong> is configured for hackathon
              evaluation and demonstration. Automated password resets via SMTP/SSO are
              intentionally disabled.
              <br /><br />
              To access the workspace immediately, use the <strong>One-Click Demo Access</strong>{' '}
              action or pre-fill the demo credentials:
              <br />
              <code className="modal-code">
                Email: demo.analyst@resiliencesim.internal<br />
                Password: Resilience2026!
              </code>
            </p>
            <div className="modal-actions">
              <button
                type="button"
                className="btn-modal-primary"
                onClick={() => {
                  setShowForgotPasswordModal(false);
                  handlePreFillDemo();
                }}
              >
                Pre-Fill Demo Credentials
              </button>
              <button
                type="button"
                className="btn-modal-secondary"
                onClick={() => setShowForgotPasswordModal(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
