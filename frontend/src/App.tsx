import { useEffect, useState, useMemo } from 'react';
import {
  Play,
  Cpu,
  RefreshCw,
  Layers,
  ShieldAlert,
  Sliders,
  AlertTriangle,
} from 'lucide-react';
import {
  checkBackendHealth,
  listScenarios,
  getScenarioGraph,
  compareSimulation,
  optimizeRecovery,
  ApiError,
} from './api/client';
import type {
  ComparisonResult,
  Disruption,
  GraphResponse,
  HealthStatus,
  OptimizationRecoveryResponse,
  ScenarioSummary,
  ShipmentRecord,
} from './types/models';
import { NavigationHeader } from './components/NavigationHeader';
import { ScenarioSelector } from './components/ScenarioSelector';
import { NetworkDigitalTwin3D } from './components/NetworkDigitalTwin3D';
import { InspectorPanel } from './components/InspectorPanel';
import { DisruptionControlCenter } from './components/DisruptionControlCenter';
import { SimulationPlaybackControl } from './components/SimulationPlaybackControl';
import { KpiDashboard } from './components/KpiDashboard';
import { RecoveryPlanExplainer } from './components/RecoveryPlanExplainer';
import { useNavigation } from './hooks/useNavigation';
import { authService } from './services/authService';
import { LandingPage } from './components/landing/LandingPage';
import { LoginPage } from './components/auth/LoginPage';
import { WorkspaceLoadingScreen } from './components/loading/WorkspaceLoadingScreen';
import './App.css';

export function App() {
  // Navigation & Authentication
  const { currentView, navigateTo } = useNavigation();
  const currentUser = authService.getCurrentUser();

  const handleLogout = () => {
    authService.logout();
    navigateTo('landing');
  };

  // System Health
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [loadingHealth, setLoadingHealth] = useState<boolean>(true);

  // Scenario Library & Graph
  const [scenarios, setScenarios] = useState<ScenarioSummary[]>([]);
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>('');
  const [activeGraph, setActiveGraph] = useState<GraphResponse | null>(null);
  const [loadingScenarios, setLoadingScenarios] = useState<boolean>(false);
  const [scenarioError, setScenarioError] = useState<string | null>(null);

  // Selection state in 3D scene
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);

  // Staged Disruptions
  const [stagedDisruptions, setStagedDisruptions] = useState<Disruption[]>([]);

  // Right Dock Tab: 'disruptions' | 'inspector'
  const [activeDockTab, setActiveDockTab] = useState<'disruptions' | 'inspector'>('disruptions');

  // Simulation execution states
  const [simulating, setSimulating] = useState<boolean>(false);
  const [simulationError, setSimulationError] = useState<string | null>(null);
  const [comparisonResult, setComparisonResult] = useState<ComparisonResult | null>(null);

  // Optimization execution states
  const [optimizing, setOptimizing] = useState<boolean>(false);
  const [optimizationError, setOptimizationError] = useState<string | null>(null);
  const [optimizationResponse, setOptimizationResponse] = useState<OptimizationRecoveryResponse | null>(null);
  const [lastRunDisruptionsHash, setLastRunDisruptionsHash] = useState<string | null>(null);

  // Playback state
  const [currentPeriod, setCurrentPeriod] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [playbackViewMode, setPlaybackViewMode] = useState<'recovered' | 'disrupted' | 'baseline'>('recovered');

  // =========================================================================
  // API Fetchers
  // =========================================================================

  const fetchHealth = async () => {
    setLoadingHealth(true);
    try {
      const data = await checkBackendHealth();
      setHealth(data);
    } catch {
      setHealth(null);
    } finally {
      setLoadingHealth(false);
    }
  };

  const fetchScenariosList = async () => {
    setLoadingScenarios(true);
    setScenarioError(null);
    try {
      const list = await listScenarios();
      setScenarios(list);
      if (list.length > 0 && !selectedScenarioId) {
        setSelectedScenarioId(list[0].id);
      }
    } catch (err) {
      setScenarioError(
        err instanceof ApiError
          ? err.message
          : 'Failed to connect to backend scenario library'
      );
    } finally {
      setLoadingScenarios(false);
    }
  };

  const loadScenarioDetails = async (id: string) => {
    if (!id) return;
    setLoadingScenarios(true);
    setScenarioError(null);
    try {
      const graphData = await getScenarioGraph(id);
      setActiveGraph(graphData);
    } catch (err) {
      setActiveGraph(null);
      setScenarioError(
        err instanceof ApiError ? err.message : `Failed to load graph for ${id}`
      );
    } finally {
      setLoadingScenarios(false);
    }
  };

  // Initial load
  useEffect(() => {
    fetchHealth();
    fetchScenariosList();
  }, []);

  // When scenario changes, load graph and reset experiment state
  useEffect(() => {
    if (selectedScenarioId) {
      loadScenarioDetails(selectedScenarioId);
      setSelectedNodeId(null);
      setSelectedEdgeId(null);
      setStagedDisruptions([]);
      setComparisonResult(null);
      setOptimizationResponse(null);
      setLastRunDisruptionsHash(null);
      setCurrentPeriod(0);
      setIsPlaying(false);
      setSimulationError(null);
      setOptimizationError(null);
    }
  }, [selectedScenarioId]);

  // When an element is selected in 3D, switch dock tab to 'inspector'
  useEffect(() => {
    if (selectedNodeId || selectedEdgeId) {
      setActiveDockTab('inspector');
    }
  }, [selectedNodeId, selectedEdgeId]);

  // Current scenario summary object
  const currentScenario = useMemo(
    () => scenarios.find((s) => s.id === selectedScenarioId) || null,
    [scenarios, selectedScenarioId]
  );

  // Active Disrupted Nodes and Routes IDs for 3D highlighting
  const { disruptedNodeIds, disruptedEdgeIds } = useMemo(() => {
    const nIds = new Set<string>();
    const eIds = new Set<string>();

    for (const d of stagedDisruptions) {
      if (
        d.disruption_type === 'facility_shutdown' ||
        d.disruption_type === 'demand_surge'
      ) {
        nIds.add(d.target_id);
      } else if (
        d.disruption_type === 'route_closure' ||
        d.disruption_type === 'lead_time_increase'
      ) {
        eIds.add(d.target_id);
      } else {
        // capacity_reduction can target either
        if (activeGraph?.nodes.some((n) => n.id === d.target_id)) {
          nIds.add(d.target_id);
        } else {
          eIds.add(d.target_id);
        }
      }
    }

    return { disruptedNodeIds: nIds, disruptedEdgeIds: eIds };
  }, [stagedDisruptions, activeGraph]);

  // Determine which simulation result governs the current playback view
  const activePlaybackResult = useMemo(() => {
    if (optimizationResponse?.recovered && playbackViewMode === 'recovered') {
      return optimizationResponse.recovered;
    }
    if (optimizationResponse?.disrupted && playbackViewMode === 'disrupted') {
      return optimizationResponse.disrupted;
    }
    if (comparisonResult?.disrupted && playbackViewMode === 'disrupted') {
      return comparisonResult.disrupted;
    }
    return (
      optimizationResponse?.baseline ||
      comparisonResult?.baseline ||
      null
    );
  }, [optimizationResponse, comparisonResult, playbackViewMode]);

  // Active Shipments in transit during current playback period
  const activeShipments: ShipmentRecord[] = useMemo(() => {
    if (!activePlaybackResult) return [];
    return activePlaybackResult.shipment_records.filter(
      (s) =>
        s.dispatch_period <= currentPeriod &&
        (s.actual_arrival_period !== null && s.actual_arrival_period !== undefined
          ? currentPeriod < s.actual_arrival_period
          : currentPeriod <= s.expected_arrival_period)
    );
  }, [activePlaybackResult, currentPeriod]);

  // Conserved inventory snapshot for selected node at current period
  const currentPeriodInventory: number | null = useMemo(() => {
    if (!selectedNodeId || !activePlaybackResult) return null;
    const nodeSnapshots = activePlaybackResult.inventory_snapshots[selectedNodeId];
    if (nodeSnapshots && nodeSnapshots[currentPeriod] !== undefined) {
      return nodeSnapshots[currentPeriod];
    }
    return null;
  }, [selectedNodeId, activePlaybackResult, currentPeriod]);

  // =========================================================================
  // Workflow Execution Handlers
  // =========================================================================

  // Step 3: Run Baseline vs Disrupted Simulation
  const handleRunSimulation = async () => {
    if (!selectedScenarioId || simulating || optimizing) return;
    setSimulating(true);
    setSimulationError(null);
    try {
      const res = await compareSimulation({
        scenario_id: selectedScenarioId,
        disruptions: stagedDisruptions,
        horizon_periods: currentScenario?.planning_horizon_periods || 14,
      });
      setComparisonResult(res);
      setLastRunDisruptionsHash(JSON.stringify(stagedDisruptions));
      setPlaybackViewMode('disrupted');
      setCurrentPeriod(0);
    } catch (err) {
      setSimulationError(
        err instanceof ApiError ? err.message : 'Simulation run failed'
      );
    } finally {
      setSimulating(false);
    }
  };

  // Step 4: Run Constrained Recovery Optimization (OR-Tools GLOP + SimPy)
  const handleRunOptimization = async () => {
    if (!selectedScenarioId || simulating || optimizing) return;
    setOptimizing(true);
    setOptimizationError(null);
    try {
      const res = await optimizeRecovery({
        scenario_id: selectedScenarioId,
        disruptions: stagedDisruptions,
        horizon_periods: currentScenario?.planning_horizon_periods || 14,
      });
      setOptimizationResponse(res);
      setLastRunDisruptionsHash(JSON.stringify(stagedDisruptions));
      setPlaybackViewMode('recovered');
      setCurrentPeriod(0);
    } catch (err) {
      setOptimizationError(
        err instanceof ApiError ? err.message : 'Recovery optimization failed'
      );
    } finally {
      setOptimizing(false);
    }
  };

  // Check if staged disruptions have changed since last simulation or optimization execution
  const isResultsOutdated = useMemo(() => {
    if (!comparisonResult && !optimizationResponse) return false;
    if (lastRunDisruptionsHash === null) return false;
    return lastRunDisruptionsHash !== JSON.stringify(stagedDisruptions);
  }, [comparisonResult, optimizationResponse, lastRunDisruptionsHash, stagedDisruptions]);

  // Reset entire session
  const handleResetSession = () => {
    setStagedDisruptions([]);
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    setComparisonResult(null);
    setOptimizationResponse(null);
    setLastRunDisruptionsHash(null);
    setCurrentPeriod(0);
    setIsPlaying(false);
    setSimulationError(null);
    setOptimizationError(null);
  };

  if (currentView === 'landing') {
    return (
      <LandingPage
        onEnterWorkspace={() => {
          if (authService.isAuthenticated()) {
            navigateTo('loading');
          } else {
            navigateTo('login');
          }
        }}
        onGoToLogin={() => navigateTo('login')}
      />
    );
  }

  if (currentView === 'login') {
    return (
      <LoginPage
        onLoginSuccess={() => navigateTo('loading')}
        onBackToHome={() => navigateTo('landing')}
      />
    );
  }

  if (currentView === 'loading') {
    return (
      <WorkspaceLoadingScreen
        onInitializationComplete={() => navigateTo('workspace')}
        onAbortToLogin={() => navigateTo('login')}
      />
    );
  }

  return (
    <div className="app-container">
      {/* Top Navigation */}
      <NavigationHeader
        health={health}
        loadingHealth={loadingHealth}
        onRefreshHealth={fetchHealth}
        onResetSession={handleResetSession}
        currentUser={currentUser}
        onLogout={handleLogout}
        onNavigateToLanding={() => navigateTo('landing')}
      />

      <main className="dashboard-content">
        {/* Scenario Selector & Tier Distribution */}
        <ScenarioSelector
          scenarios={scenarios}
          selectedScenarioId={selectedScenarioId}
          onSelectScenario={setSelectedScenarioId}
          graph={activeGraph}
          loading={loadingScenarios}
          onRefresh={fetchScenariosList}
        />

        {/* Global Error Banner */}
        {scenarioError && (
          <div className="state-panel error-panel">
            <div className="status-indicator-row">
              <span className="indicator-dot dot-red" />
              <strong>Scenario Connection Error</strong>
            </div>
            <p className="error-message-text">{scenarioError}</p>
          </div>
        )}

        {/* Step-by-Step Guided Action Bar */}
        <section className="workflow-stepper-card">
          <div className="stepper-track">
            {/* Step 1: Scenario */}
            <div className="step-item step-completed">
              <span className="step-badge">1</span>
              <div className="step-text">
                <strong>Scenario Loaded</strong>
                <small>{currentScenario?.name || 'Selected'}</small>
              </div>
            </div>

            <div className="step-connector" />

            {/* Step 2: Disruptions */}
            <div
              className={`step-item ${
                stagedDisruptions.length > 0 ? 'step-completed' : 'step-active'
              }`}
            >
              <span className="step-badge">2</span>
              <div className="step-text">
                <strong>Disruptions Staged</strong>
                <small>{stagedDisruptions.length} Shocks Active</small>
              </div>
            </div>

            <div className="step-connector" />

            {/* Step 3: Simulation */}
            <div
              className={`step-item ${
                comparisonResult || optimizationResponse ? 'step-completed' : ''
              }`}
            >
              <span className="step-badge">3</span>
              <div className="step-text">
                <strong>SimPy Simulation</strong>
                <small>
                  {comparisonResult || optimizationResponse
                    ? 'Completed'
                    : 'Unmitigated Run'}
                </small>
              </div>
            </div>

            <div className="step-connector" />

            {/* Step 4: Recovery */}
            <div
              className={`step-item ${
                optimizationResponse ? 'step-completed' : ''
              }`}
            >
              <span className="step-badge">4</span>
              <div className="step-text">
                <strong>OR-Tools Recovery</strong>
                <small>
                  {optimizationResponse ? '3-Way Evaluated' : 'GLOP Constrained'}
                </small>
              </div>
            </div>
          </div>

          {/* Action Trigger Buttons */}
          <div className="stepper-action-buttons">
            <button
              className="btn-action-simulate"
              onClick={handleRunSimulation}
              disabled={simulating || optimizing || !activeGraph}
              title="Run SimPy simulation comparing baseline vs unmitigated disruption"
            >
              {simulating ? (
                <>
                  <RefreshCw size={15} className="spin-icon" />
                  <span>Simulating in SimPy...</span>
                </>
              ) : (
                <>
                  <Play size={15} />
                  <span>Run Discrete Simulation</span>
                </>
              )}
            </button>

            <button
              className="btn-action-optimize"
              onClick={handleRunOptimization}
              disabled={simulating || optimizing || !activeGraph}
              title="Formulate time-expanded LP in Google OR-Tools, re-simulate in SimPy, and evaluate"
            >
              {optimizing ? (
                <>
                  <RefreshCw size={15} className="spin-icon" />
                  <span>Solving OR-Tools & Re-simulating...</span>
                </>
              ) : (
                <>
                  <Cpu size={15} />
                  <span>Optimize Recovery (Google OR-Tools)</span>
                </>
              )}
            </button>
          </div>
        </section>

        {/* Pipeline Error Feedback */}
        {simulationError && (
          <div className="state-panel error-panel">
            <div className="status-indicator-row">
              <span className="indicator-dot dot-red" />
              <strong>Simulation Execution Error</strong>
            </div>
            <p className="error-message-text">{simulationError}</p>
          </div>
        )}

        {optimizationError && (
          <div className="state-panel error-panel">
            <div className="status-indicator-row">
              <span className="indicator-dot dot-red" />
              <strong>Recovery Optimization Error</strong>
            </div>
            <p className="error-message-text">{optimizationError}</p>
          </div>
        )}

        {/* Staged Disruptions Changed Warning */}
        {isResultsOutdated && (
          <div className="state-panel warning-panel">
            <div className="status-indicator-row">
              <AlertTriangle size={15} className="inline-icon icon-amber" />
              <strong>Active Results Outdated</strong>
            </div>
            <p className="error-message-text">
              Staged disruptions have changed since the last execution. Re-run discrete simulation or recovery optimization to evaluate the updated disruption queue.
            </p>
          </div>
        )}

        {/* ========================================================================= */}
        {/* MAIN DIGITAL TWIN WORKSPACE (3D Canvas + Side Dock) */}
        {/* ========================================================================= */}
        <section className="digital-twin-workspace-grid">
          {/* Left Column: 3D Network Canvas + Playback Bar */}
          <div className="workspace-main-column">
            {/* 3D Network Canvas */}
            <div className="digital-twin-card">
              <div className="viewport-header-strip">
                <div className="viewport-title-group">
                  <Layers size={16} className="inline-icon icon-blue" />
                  <h4>Interactive 3D Supply Chain Topology</h4>
                  <span className="viewport-subtitle">
                    Directed NetworkX spatial layout • OrbitControls Pan / Zoom / Rotate
                  </span>
                </div>

                {/* Playback view selector if multiple simulation results available */}
                {(comparisonResult || optimizationResponse) && (
                  <div className="view-mode-selector">
                    <span className="view-mode-label">Displaying:</span>
                    <button
                      className={`view-mode-chip ${playbackViewMode === 'baseline' ? 'active' : ''}`}
                      onClick={() => setPlaybackViewMode('baseline')}
                    >
                      Baseline
                    </button>
                    <button
                      className={`view-mode-chip ${playbackViewMode === 'disrupted' ? 'active' : ''}`}
                      onClick={() => setPlaybackViewMode('disrupted')}
                    >
                      Disrupted
                    </button>
                    {optimizationResponse?.recovered && (
                      <button
                        className={`view-mode-chip ${playbackViewMode === 'recovered' ? 'active' : ''}`}
                        onClick={() => setPlaybackViewMode('recovered')}
                      >
                        Recovered
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* R3F 3D Viewport */}
              <NetworkDigitalTwin3D
                graph={activeGraph}
                selectedNodeId={selectedNodeId}
                onSelectNode={setSelectedNodeId}
                selectedEdgeId={selectedEdgeId}
                onSelectEdge={setSelectedEdgeId}
                disruptedNodeIds={disruptedNodeIds}
                disruptedEdgeIds={disruptedEdgeIds}
                activeShipments={activeShipments}
              />
            </div>

            {/* Timeline Scrubber & Simulation Playback Bar */}
            <SimulationPlaybackControl
              simulationResult={activePlaybackResult}
              currentPeriod={currentPeriod}
              onPeriodChange={setCurrentPeriod}
              isPlaying={isPlaying}
              onTogglePlay={() => setIsPlaying(!isPlaying)}
              playbackSpeed={playbackSpeed}
              onSpeedChange={setPlaybackSpeed}
            />
          </div>

          {/* Right Column: Tabbed Dock (Disruptions / Inspector) */}
          <div className="workspace-dock-column">
            {/* Dock Tab Selector */}
            <div className="dock-tabs-header">
              <button
                className={`dock-tab-btn ${activeDockTab === 'disruptions' ? 'active' : ''}`}
                onClick={() => setActiveDockTab('disruptions')}
              >
                <ShieldAlert size={14} />
                <span>Disruption Control ({stagedDisruptions.length})</span>
              </button>
              <button
                className={`dock-tab-btn ${activeDockTab === 'inspector' ? 'active' : ''}`}
                onClick={() => setActiveDockTab('inspector')}
              >
                <Sliders size={14} />
                <span>Element Inspector</span>
              </button>
            </div>

            {/* Tab 1: Disruption Control Center */}
            {activeDockTab === 'disruptions' && (
              <DisruptionControlCenter
                graph={activeGraph}
                scenario={currentScenario}
                stagedDisruptions={stagedDisruptions}
                onAddDisruption={(newD) => setStagedDisruptions((prev) => [...prev, newD])}
                onRemoveDisruption={(id) =>
                  setStagedDisruptions((prev) => prev.filter((d) => d.id !== id))
                }
                onClearDisruptions={() => setStagedDisruptions([])}
                onApplyPreset={(presetList) => setStagedDisruptions(presetList)}
              />
            )}

            {/* Tab 2: Element Inspector */}
            {activeDockTab === 'inspector' && (
              <InspectorPanel
                graph={activeGraph}
                selectedNodeId={selectedNodeId}
                selectedEdgeId={selectedEdgeId}
                onSelectNode={setSelectedNodeId}
                onSelectEdge={setSelectedEdgeId}
                currentPeriodInventory={currentPeriodInventory}
              />
            )}
          </div>
        </section>

        {/* ========================================================================= */}
        {/* 3-WAY KPI DASHBOARD (Baseline vs Disrupted vs Recovered) */}
        {/* ========================================================================= */}
        <KpiDashboard
          baselineResult={
            optimizationResponse?.baseline || comparisonResult?.baseline || null
          }
          disruptedResult={
            optimizationResponse?.disrupted || comparisonResult?.disrupted || null
          }
          recoveredResult={optimizationResponse?.recovered || null}
          deltasDisrupted={
            optimizationResponse?.baseline_to_disrupted ||
            comparisonResult?.deltas ||
            null
          }
          deltasRecovered={optimizationResponse?.disrupted_to_recovered || null}
          optimizationResponse={optimizationResponse}
        />

        {/* ========================================================================= */}
        {/* RECOVERY PLAN EXPLAINABILITY (Google OR-Tools + SimPy Verification) */}
        {/* ========================================================================= */}
        {optimizationResponse && (
          <RecoveryPlanExplainer optimizationResponse={optimizationResponse} />
        )}
      </main>
    </div>
  );
}

export default App;
