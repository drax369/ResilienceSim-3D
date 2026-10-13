import {
  Box,
  ArrowRight,
  ShieldAlert,
  Cpu,
  BarChart3,
  Network,
  CheckCircle2,
  Zap,
  Globe2,
  Lock,
} from 'lucide-react';
import { ThemeToggle } from '../ThemeToggle';
import './LandingPage.css';

interface LandingPageProps {
  onEnterWorkspace: () => void;
  onGoToLogin: () => void;
}

export function LandingPage({ onEnterWorkspace, onGoToLogin }: LandingPageProps) {
  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="landing-page">
      {/* =========================================================================
          1. NAVIGATION BAR
          ========================================================================= */}
      <nav className="landing-nav">
        <div className="landing-nav-container">
          <div className="landing-brand">
            <div className="landing-logo-badge">
              <Box size={22} className="landing-logo-icon" />
            </div>
            <div>
              <span className="landing-brand-title">ResilienceSim 3D</span>
              <span className="landing-brand-tag">Enterprise Edition</span>
            </div>
          </div>

          <div className="landing-nav-links">
            <button
              onClick={() => scrollToSection('capabilities')}
              className="landing-nav-link"
            >
              Capabilities
            </button>
            <button
              onClick={() => scrollToSection('workflow')}
              className="landing-nav-link"
            >
              How It Works
            </button>
            <button
              onClick={() => scrollToSection('scenarios')}
              className="landing-nav-link"
            >
              Benchmark Scenarios
            </button>
            <button
              onClick={() => scrollToSection('architecture')}
              className="landing-nav-link"
            >
              Architecture
            </button>
          </div>

          <div className="landing-nav-actions">
            <ThemeToggle />
            <button onClick={onGoToLogin} className="landing-btn-secondary">
              Sign In
            </button>
            <button onClick={onEnterWorkspace} className="landing-btn-primary">
              <span>Access Workspace</span>
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </nav>

      {/* =========================================================================
          2. HERO SECTION
          ========================================================================= */}
      <header className="landing-hero">
        <div className="landing-hero-container">
          <div className="landing-hero-badge">
            <Zap size={14} className="text-teal" />
            <span>Supply Chain Resilience Intelligence & Recovery Digital Twin</span>
          </div>

          <h1 className="landing-hero-headline">
            Anticipate Disruptions.
            <br />
            <span className="gradient-text">Optimize Recovery.</span>
            <br />
            Protect Your Supply Chain.
          </h1>

          <p className="landing-hero-subhead">
            Model complex supply networks, simulate operational disruptions, and
            evaluate constraint-aware recovery plans through an interactive 3D digital
            twin powered by SimPy discrete-event simulation and Google OR-Tools.
          </p>

          <div className="landing-hero-cta-group">
            <button
              onClick={onEnterWorkspace}
              className="landing-cta-primary"
              id="hero-access-workspace-btn"
            >
              <span>Access Your Workspace</span>
              <ArrowRight size={18} />
            </button>
            <button
              onClick={() => scrollToSection('capabilities')}
              className="landing-cta-secondary"
            >
              <span>Explore Capabilities</span>
            </button>
          </div>

          {/* Quick Stats / Proof Points */}
          <div className="landing-hero-proof-bar">
            <div className="proof-item">
              <span className="proof-number">SimPy 4</span>
              <span className="proof-label">Discrete-Event Engine</span>
            </div>
            <div className="proof-divider" />
            <div className="proof-item">
              <span className="proof-number">Google OR-Tools</span>
              <span className="proof-label">GLOP Linear Optimization</span>
            </div>
            <div className="proof-divider" />
            <div className="proof-item">
              <span className="proof-number">0 Deviations</span>
              <span className="proof-label">Mathematical LP Alignment</span>
            </div>
            <div className="proof-divider" />
            <div className="proof-item">
              <span className="proof-number">WebGL 3D</span>
              <span className="proof-label">Interactive Spatial Layout</span>
            </div>
          </div>

          {/* Visual Digital Twin Preview Canvas Mockup */}
          <div className="landing-preview-frame">
            <div className="preview-top-bar">
              <div className="preview-controls">
                <span className="window-dot red" />
                <span className="window-dot amber" />
                <span className="window-dot green" />
              </div>
              <div className="preview-title">
                ResilienceSim 3D Command Center — Global Multi-Tier Supply Network
              </div>
              <div className="preview-badge">Live Digital Twin Preview</div>
            </div>

            <div className="preview-content-grid">
              {/* Left representative 3D network visualization */}
              <div className="preview-visual-canvas">
                <div className="preview-tier-headers">
                  <span>TIER 1: SUPPLIERS</span>
                  <span>TIER 2: FACTORIES</span>
                  <span>TIER 3: DISTRIBUTION HUBS</span>
                  <span>TIER 4: RETAILERS</span>
                </div>

                <svg className="preview-network-svg" viewBox="0 0 900 320" fill="none">
                  {/* Background Grid Lines */}
                  <line x1="225" y1="20" x2="225" y2="300" stroke="var(--chart-grid)" strokeDasharray="4 4" />
                  <line x1="450" y1="20" x2="450" y2="300" stroke="var(--chart-grid)" strokeDasharray="4 4" />
                  <line x1="675" y1="20" x2="675" y2="300" stroke="var(--chart-grid)" strokeDasharray="4 4" />

                  {/* Flow Edges */}
                  <path d="M 100 80 Q 210 70 320 80" stroke="#0284c7" strokeWidth="2.5" />
                  <path d="M 100 160 Q 210 110 320 80" stroke="#0284c7" strokeWidth="2" />
                  <path d="M 100 240 Q 210 200 320 220" stroke="#0284c7" strokeWidth="2" />

                  {/* Disrupted corridor */}
                  <path d="M 320 80 Q 430 110 540 140" stroke="#ef4444" strokeWidth="3" strokeDasharray="6 4" />
                  {/* Optimized recovery bypass corridor */}
                  <path d="M 320 220 Q 430 180 540 140" stroke="#0d9488" strokeWidth="3.5" />
                  <path d="M 320 80 Q 430 60 540 60" stroke="#0284c7" strokeWidth="2" />

                  <path d="M 540 60 Q 660 70 780 80" stroke="#0284c7" strokeWidth="2.5" />
                  <path d="M 540 140 Q 660 140 780 160" stroke="#0d9488" strokeWidth="3" />
                  <path d="M 540 220 Q 660 210 780 240" stroke="#0284c7" strokeWidth="2" />

                  {/* Animated Pulses on Recovery Corridor */}
                  <circle cx="430" cy="180" r="4.5" fill="#0d9488" className="pulse-dot" />
                  <circle cx="660" cy="140" r="4.5" fill="#0d9488" className="pulse-dot" />

                  {/* Tier 1 Nodes (Suppliers) */}
                  <g className="node-group">
                    <circle cx="100" cy="80" r="18" fill="var(--bg-surface)" stroke="#0284c7" strokeWidth="3" />
                    <text x="100" y="85" textAnchor="middle" fontSize="10" fontWeight="700" fill="var(--text-main)">SUP-1</text>
                    <text x="100" y="112" textAnchor="middle" fontSize="9" fill="var(--text-muted)">Taiwan Semi</text>
                  </g>
                  <g className="node-group">
                    <circle cx="100" cy="160" r="18" fill="var(--bg-surface)" stroke="#0284c7" strokeWidth="3" />
                    <text x="100" y="165" textAnchor="middle" fontSize="10" fontWeight="700" fill="var(--text-main)">SUP-2</text>
                    <text x="100" y="192" textAnchor="middle" fontSize="9" fill="var(--text-muted)">Korea Fab</text>
                  </g>
                  <g className="node-group">
                    <circle cx="100" cy="240" r="18" fill="var(--bg-surface)" stroke="#0284c7" strokeWidth="3" />
                    <text x="100" y="245" textAnchor="middle" fontSize="10" fontWeight="700" fill="var(--text-main)">SUP-3</text>
                    <text x="100" y="272" textAnchor="middle" fontSize="9" fill="var(--text-muted)">Japan PCB</text>
                  </g>

                  {/* Tier 2 Nodes (Factories) */}
                  <g className="node-group">
                    <rect x="302" y="62" width="36" height="36" rx="6" fill="var(--bg-surface)" stroke="#0284c7" strokeWidth="3" />
                    <text x="320" y="85" textAnchor="middle" fontSize="10" fontWeight="700" fill="var(--text-main)">FAC-1</text>
                    <text x="320" y="112" textAnchor="middle" fontSize="9" fill="var(--text-muted)">Shenzhen</text>
                  </g>
                  <g className="node-group">
                    <rect x="302" y="202" width="36" height="36" rx="6" fill="var(--bg-surface)" stroke="#0d9488" strokeWidth="3" />
                    <text x="320" y="225" textAnchor="middle" fontSize="10" fontWeight="700" fill="#0d9488">FAC-2</text>
                    <text x="320" y="252" textAnchor="middle" fontSize="9" fill="#0d9488">Penang (Bypass)</text>
                  </g>

                  {/* Tier 3 Nodes (Distribution Centers) */}
                  <g className="node-group">
                    <polygon points="540,42 558,74 522,74" fill="var(--bg-surface)" stroke="#0284c7" strokeWidth="3" />
                    <text x="540" y="68" textAnchor="middle" fontSize="10" fontWeight="700" fill="var(--text-main)">DC-1</text>
                    <text x="540" y="90" textAnchor="middle" fontSize="9" fill="var(--text-muted)">Rotterdam</text>
                  </g>
                  <g className="node-group">
                    <polygon points="540,122 558,154 522,154" fill="var(--bg-surface)" stroke="#0d9488" strokeWidth="3" />
                    <text x="540" y="148" textAnchor="middle" fontSize="10" fontWeight="700" fill="#0d9488">DC-2</text>
                    <text x="540" y="170" textAnchor="middle" fontSize="9" fill="#0d9488">Chicago Hub</text>
                  </g>

                  {/* Tier 4 Nodes (Retailers) */}
                  <g className="node-group">
                    <circle cx="780" cy="80" r="16" fill="var(--bg-surface)" stroke="#059669" strokeWidth="3" />
                    <text x="780" y="84" textAnchor="middle" fontSize="9" fontWeight="700" fill="#059669">RET-1</text>
                    <text x="780" y="110" textAnchor="middle" fontSize="9" fill="var(--text-muted)">Berlin Hub</text>
                  </g>
                  <g className="node-group">
                    <circle cx="780" cy="160" r="16" fill="var(--bg-surface)" stroke="#059669" strokeWidth="3" />
                    <text x="780" y="164" textAnchor="middle" fontSize="9" fontWeight="700" fill="#059669">RET-2</text>
                    <text x="780" y="190" textAnchor="middle" fontSize="9" fill="var(--text-muted)">New York</text>
                  </g>
                  <g className="node-group">
                    <circle cx="780" cy="240" r="16" fill="var(--bg-surface)" stroke="#059669" strokeWidth="3" />
                    <text x="780" y="244" textAnchor="middle" fontSize="9" fontWeight="700" fill="#059669">RET-3</text>
                    <text x="780" y="270" textAnchor="middle" fontSize="9" fill="var(--text-muted)">London Hub</text>
                  </g>
                </svg>
              </div>

              {/* Right KPI comparison preview sidebar */}
              <div className="preview-metrics-sidebar">
                <div className="preview-state-card baseline">
                  <div className="state-badge">STATE 1: BASELINE</div>
                  <div className="state-kpi">5,965 units</div>
                  <div className="state-sub">42.61% SLA • Healthy flow</div>
                </div>

                <div className="preview-state-card disrupted">
                  <div className="state-badge alert">STATE 2: DISRUPTED</div>
                  <div className="state-kpi">5,665 units</div>
                  <div className="state-sub">40.46% SLA • -300 units lost</div>
                </div>

                <div className="preview-state-card recovered">
                  <div className="state-badge success">STATE 3: OR-TOOLS RECOVERED</div>
                  <div className="state-kpi">6,515 units</div>
                  <div className="state-sub">+850 units • 0 deviations • Optimal</div>
                </div>

                <button onClick={onEnterWorkspace} className="preview-launch-btn">
                  <span>Open Interactive Digital Twin</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* =========================================================================
          3. CAPABILITIES / CORE FEATURES SECTION
          ========================================================================= */}
      <section className="landing-section" id="capabilities">
        <div className="section-container">
          <div className="section-header">
            <span className="section-tag">Enterprise Capabilities</span>
            <h2 className="section-title">
              Full-Spectrum Supply Chain Resilience Intelligence
            </h2>
            <p className="section-desc">
              From simultaneous multi-shock injection to constraint-validated LP
              rerouting, ResilienceSim 3D equips operations teams with deterministic
              decision support.
            </p>
          </div>

          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon-wrapper bg-blue-light text-blue">
                <ShieldAlert size={24} />
              </div>
              <h3 className="feature-card-title">Multi-Shock Disruption Simulation</h3>
              <p className="feature-card-desc">
                Inject five simultaneous operational shock types: Route Closures,
                Facility Outages, Throughput Throttling, Transit Delays, and Demand
                Surges with explicit time horizons.
              </p>
              <ul className="feature-checklist">
                <li><CheckCircle2 size={14} /> Dynamic multi-period shock scheduling</li>
                <li><CheckCircle2 size={14} /> Lead-time compounding & capacity cuts</li>
                <li><CheckCircle2 size={14} /> Unmitigated backlog tracking</li>
              </ul>
            </div>

            <div className="feature-card">
              <div className="feature-icon-wrapper bg-teal-light text-teal">
                <Cpu size={24} />
              </div>
              <h3 className="feature-card-title">Constrained Recovery Optimization</h3>
              <p className="feature-card-desc">
                Google OR-Tools GLOP solver formulates multi-period time-expanded linear
                programs that coordinate alternate transport corridors and inventory
                conservation.
              </p>
              <ul className="feature-checklist">
                <li><CheckCircle2 size={14} /> Multi-echelon backlog conservation</li>
                <li><CheckCircle2 size={14} /> Automated lateral transshipment</li>
                <li><CheckCircle2 size={14} /> Zero physical capacity violations</li>
              </ul>
            </div>

            <div className="feature-card">
              <div className="feature-icon-wrapper bg-green-light text-green">
                <BarChart3 size={24} />
              </div>
              <h3 className="feature-card-title">3-Way Comparative Operational KPIs</h3>
              <p className="feature-card-desc">
                Evaluate Baseline vs Disrupted vs Recovered performance side-by-side:
                service levels, delivered units, backlog reduction, and exact logistics
                transport costs.
              </p>
              <ul className="feature-checklist">
                <li><CheckCircle2 size={14} /> Absolute & percentage delta metrics</li>
                <li><CheckCircle2 size={14} /> Unavoidable shortage bottleneck audit</li>
                <li><CheckCircle2 size={14} /> Transparent solver explainability</li>
              </ul>
            </div>

            <div className="feature-card">
              <div className="feature-icon-wrapper bg-slate-light text-slate">
                <Network size={24} />
              </div>
              <h3 className="feature-card-title">Interactive 3D Digital Twin</h3>
              <p className="feature-card-desc">
                Real-time Three.js viewport provides node inspection, route flow
                visualizations, disruption heatmaps, and step-by-step playback scrubbers.
              </p>
              <ul className="feature-checklist">
                <li><CheckCircle2 size={14} /> Deterministic 3D tier coordinate mapping</li>
                <li><CheckCircle2 size={14} /> In-transit shipment particle motion</li>
                <li><CheckCircle2 size={14} /> Period-by-period timeline scrubber</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          4. WORKFLOW / HOW IT WORKS SECTION
          ========================================================================= */}
      <section className="landing-section bg-subtle-section" id="workflow">
        <div className="section-container">
          <div className="section-header">
            <span className="section-tag">Methodology</span>
            <h2 className="section-title">
              The Closed-Loop Resilience Lifecycle
            </h2>
            <p className="section-desc">
              Rigorous, test-verified discrete-event simulation paired with mathematical
              linear programming ensures no simulated metric violates physical reality.
            </p>
          </div>

          <div className="workflow-steps-grid">
            <div className="workflow-step-card">
              <div className="step-badge">STAGE 1</div>
              <h4 className="step-title">Ingest & Model</h4>
              <p className="step-desc">
                Constructs directed NetworkX graphs from multi-tier facilities and
                transport lanes, validating throughput limits, initial inventories,
                and geographic tiers.
              </p>
            </div>

            <div className="workflow-step-card">
              <div className="step-badge">STAGE 2</div>
              <h4 className="step-title">Simulate Shocks</h4>
              <p className="step-desc">
                SimPy discrete-event engine steps period-by-period, executing material
                replenishment and logging customer backlog when critical corridors fail.
              </p>
            </div>

            <div className="workflow-step-card">
              <div className="step-badge">STAGE 3</div>
              <h4 className="step-title">Optimize Recovery</h4>
              <p className="step-desc">
                OR-Tools builds a time-expanded linear program minimizing unmet demand
                penalties and transport costs, scheduling multi-period dispatches.
              </p>
            </div>

            <div className="workflow-step-card">
              <div className="step-badge">STAGE 4</div>
              <h4 className="step-title">Execute & Audit</h4>
              <p className="step-desc">
                The recovery plan is fed back into SimPy for independent re-simulation,
                verifying 0 execution deviations and mathematically proven SLA gains.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          5. BENCHMARK SCENARIOS SHOWCASE
          ========================================================================= */}
      <section className="landing-section" id="scenarios">
        <div className="section-container">
          <div className="section-header">
            <span className="section-tag">Scenario Library</span>
            <h2 className="section-title">
              Pre-Configured Enterprise Supply Networks
            </h2>
            <p className="section-desc">
              Test proven resilience strategies across complex multi-tier supply chain
              benchmarks.
            </p>
          </div>

          <div className="scenarios-grid">
            <div className="scenario-card">
              <div className="scenario-card-header">
                <Globe2 size={20} className="text-blue" />
                <span className="scenario-industry-tag">High-Tech Electronics</span>
              </div>
              <h3 className="scenario-name">Global Electronics Supply Chain</h3>
              <p className="scenario-description">
                13 facilities and 22 international transport corridors. Models
                semiconductor foundries in Taiwan and Korea shipping to assembly plants
                in Shenzhen and Penang, distribution hubs in Singapore, Rotterdam, and
                Chicago, and omnichannel retailers.
              </p>
              <div className="scenario-metrics-pills">
                <span>13 Facilities</span>
                <span>22 Corridors</span>
                <span>14-Day Horizon</span>
                <span>Multi-Hop Maritime Bypass</span>
              </div>
              <button onClick={onEnterWorkspace} className="scenario-explore-btn">
                <span>Load Scenario in Workspace</span>
                <ArrowRight size={14} />
              </button>
            </div>

            <div className="scenario-card">
              <div className="scenario-card-header">
                <Globe2 size={20} className="text-teal" />
                <span className="scenario-industry-tag">Pharmaceutical Cold Chain</span>
              </div>
              <h3 className="scenario-name">European Pharma Vaccine Distribution</h3>
              <p className="scenario-description">
                11 ultra-cold facilities and 16 temperature-controlled routes.
                Biologics synthesized in Basel and Dublin, transported through deep-freeze
                depots in Frankfurt and Lyon, and distributed to regional European hospital
                consortiums.
              </p>
              <div className="scenario-metrics-pills">
                <span>11 Facilities</span>
                <span>16 Corridors</span>
                <span>21-Day Horizon</span>
                <span>Deep-Freeze Constraints</span>
              </div>
              <button onClick={onEnterWorkspace} className="scenario-explore-btn">
                <span>Load Scenario in Workspace</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          6. ARCHITECTURE & SECURITY CALLOUT
          ========================================================================= */}
      <section className="landing-section bg-subtle-section" id="architecture">
        <div className="section-container">
          <div className="architecture-banner">
            <div className="architecture-content">
              <div className="architecture-tag">
                <Lock size={14} />
                <span>Enterprise Architecture & Demo Access</span>
              </div>
              <h3 className="architecture-title">
                Zero Fabrication. Mathematical Truth.
              </h3>
              <p className="architecture-desc">
                Unlike synthetic mock dashboards, ResilienceSim 3D operates on true
                discrete-event simulation and linear programming solvers. Every unit
                delivered respects capacity bounds, lead-time delays, and conservation of
                material flow.
              </p>
              <div className="architecture-notes">
                <div className="arch-note-item">
                  <CheckCircle2 size={16} className="text-green" />
                  <span>
                    <strong>Demo Access Mode:</strong> Fully unlocked evaluation environment
                    without mandatory server credentials.
                  </span>
                </div>
                <div className="arch-note-item">
                  <CheckCircle2 size={16} className="text-green" />
                  <span>
                    <strong>Production Roadmap:</strong> Ready for OAuth2 / OIDC SSO,
                    encrypted JWT session tokens, and Postgres persistence.
                  </span>
                </div>
              </div>
            </div>

            <div className="architecture-cta-box">
              <h4>Ready to test resilience?</h4>
              <p>Explore the full interactive 3D digital twin now.</p>
              <button onClick={onEnterWorkspace} className="landing-cta-primary full-width">
                <span>Enter Workspace</span>
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          7. FOOTER
          ========================================================================= */}
      <footer className="landing-footer">
        <div className="landing-footer-container">
          <div className="footer-top">
            <div className="footer-brand">
              <div className="landing-logo-badge small">
                <Box size={16} className="landing-logo-icon" />
              </div>
              <span className="footer-title">ResilienceSim 3D</span>
            </div>
            <p className="footer-motto">
              Next-generation supply-chain resilience simulation and recovery optimization.
            </p>
          </div>

          <div className="footer-disclaimer-card">
            <strong>Prototype & Hackathon Demonstration Notice:</strong>
            <p>
              This deployment is an engineering demonstration prototype. Demo access mode
              provides local simulated session authorization for product evaluation. No
              confidential company credentials should be entered. Production deployment
              requires dedicated server-side authentication, HTTPS, and tenant isolation.
            </p>
          </div>

          <div className="footer-bottom">
            <span>© 2026 ResilienceSim 3D. All rights reserved.</span>
            <div className="footer-links">
              <span>FastAPI Backend v1.2.0</span>
              <span>•</span>
              <span>React 19 + Three.js</span>
              <span>•</span>
              <span>Google OR-Tools GLOP</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
