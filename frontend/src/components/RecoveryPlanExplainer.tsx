import { useState } from 'react';
import {
  Cpu,
  ShieldCheck,
  AlertTriangle,
  Clock,
  Filter,
  CheckCircle2,
} from 'lucide-react';
import type { OptimizationRecoveryResponse } from '../types/models';

interface RecoveryPlanExplainerProps {
  optimizationResponse: OptimizationRecoveryResponse | null;
}

export function RecoveryPlanExplainer({
  optimizationResponse,
}: RecoveryPlanExplainerProps) {
  const [filterAction, setFilterAction] = useState<string>('ALL');

  if (!optimizationResponse) return null;

  const plan = optimizationResponse.recovery_plan;
  const actions = optimizationResponse.recovery_actions;
  const deviations = optimizationResponse.execution_deviations;
  const bottlenecks = optimizationResponse.bottlenecks_and_shortages;

  // Filter actions by type
  const actionTypes = ['ALL', ...Array.from(new Set(actions.map((a) => a.action_type)))];
  const filteredActions =
    filterAction === 'ALL'
      ? actions
      : actions.filter((a) => a.action_type === filterAction);

  return (
    <div className="deck-card recovery-explainer-card">
      <div className="deck-card-header">
        <div className="card-title-group">
          <Cpu size={18} className="deck-icon icon-teal" />
          <div>
            <h3>OR-Tools Recovery Optimization & Explainability</h3>
            <span className="card-subtitle">
              Transparent mathematical decisions, lane reroutings, and SimPy dispatch verification
            </span>
          </div>
        </div>

        <div className="solver-status-indicator">
          <span className="status-badge status-optimal">
            <CheckCircle2 size={13} /> {optimizationResponse.solver_status.toUpperCase()}
          </span>
          <span className="runtime-badge">
            <Clock size={13} /> {optimizationResponse.solve_runtime_ms} ms
          </span>
        </div>
      </div>

      <div className="deck-card-body">
        {/* Solver Meta Strip */}
        <div className="explainer-meta-banner">
          <div className="meta-tile">
            <span className="m-label">Linear Solver</span>
            <strong className="m-val highlight-blue">{optimizationResponse.solver_name}</strong>
          </div>
          <div className="meta-tile">
            <span className="m-label">Penalized Objective Value</span>
            <strong className="m-val">${optimizationResponse.objective_value.toLocaleString()}</strong>
          </div>
          <div className="meta-tile">
            <span className="m-label">Planned Flow Dispatches</span>
            <strong className="m-val">{plan ? plan.total_planned_dispatches.toLocaleString() : 0} units</strong>
          </div>
          <div className="meta-tile">
            <span className="m-label">Planned Transport Cost</span>
            <strong className="m-val">${plan ? plan.total_planned_transport_cost.toLocaleString() : 0}</strong>
          </div>
          <div className="meta-tile">
            <span className="m-label">Execution Deviations</span>
            <strong className="m-val highlight-green">
              {deviations.length === 0 ? '0 (100% Executed)' : `${deviations.length} Deviations`}
            </strong>
          </div>
        </div>

        {/* Triple Explanation Principle (Grounding) */}
        <div className="grounding-pillars-grid">
          <div className="pillar-card">
            <div className="pillar-header">
              <span className="pillar-number">1</span>
              <h4>Optimizer Proposal</h4>
            </div>
            <p>
              OR-Tools solves continuous flow variables across the time-expanded network, minimizing total unmet
              demand penalties ($1000/unit) subject to active route closures and capacity limits.
            </p>
          </div>

          <div className="pillar-card">
            <div className="pillar-header">
              <span className="pillar-number">2</span>
              <h4>SimPy Physical Execution</h4>
            </div>
            <p>
              The SimPy engine ingests the recovery plan and attempts to dispatch exact planned quantities. If dynamic
              stockouts or throughput bounds bind, discrepancies are logged as execution deviations.
            </p>
          </div>

          <div className="pillar-card">
            <div className="pillar-header">
              <span className="pillar-number">3</span>
              <h4>Measurable SLA Gain</h4>
            </div>
            <p>
              Final metrics reflect true discrete-event arrivals. Service level is calculated from actual delivered
              inventory, never inflated or mocked.
            </p>
          </div>
        </div>

        {/* Rerouting & Optimization Actions Table */}
        <div className="explainer-actions-section">
          <div className="section-header-row">
            <h4>Optimization Actions & Corridor Rerouting ({actions.length})</h4>

            {actionTypes.length > 2 && (
              <div className="action-filter-pills">
                <Filter size={13} className="inline-icon text-muted" />
                {actionTypes.map((t) => (
                  <button
                    key={t}
                    className={`filter-pill ${filterAction === t ? 'active' : ''}`}
                    onClick={() => setFilterAction(t)}
                  >
                    {t}
                  </button>
                ))}
              </div>
            )}
          </div>

          {actions.length === 0 ? (
            <div className="empty-actions-box">
              <p>No special rerouting actions required; existing network flows fulfilled all feasible demand.</p>
            </div>
          ) : (
            <div className="actions-table-container">
              <table className="explainer-table">
                <thead>
                  <tr>
                    <th>Period</th>
                    <th>Action</th>
                    <th>Corridor / Node</th>
                    <th>Volume</th>
                    <th>Operational Rationale</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredActions.slice(0, 15).map((act, idx) => (
                    <tr key={idx}>
                      <td className="period-cell">t = {act.period}</td>
                      <td>
                        <span className="action-type-tag">{act.action_type}</span>
                      </td>
                      <td>
                        <code>{act.facility_or_route_id}</code>
                      </td>
                      <td className="volume-cell">
                        <strong>{act.quantity.toLocaleString()}</strong> units
                      </td>
                      <td className="rationale-cell">{act.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredActions.length > 15 && (
                <div className="table-footer-note">
                  Showing top 15 of {filteredActions.length} recovery actions.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bottlenecks, Shortages, and Execution Deviations */}
        <div className="explainer-dual-columns">
          {/* Active Bottlenecks */}
          <div className="explainer-subbox">
            <div className="subbox-header">
              <AlertTriangle size={15} className="icon-amber" />
              <h4>Binding Bottlenecks & Shortages ({bottlenecks.length})</h4>
            </div>
            {bottlenecks.length === 0 ? (
              <p className="clean-subtext">No binding bottlenecks or unfulfilled demand detected.</p>
            ) : (
              <ul className="bottlenecks-explainer-list">
                {bottlenecks.map((b, idx) => (
                  <li key={idx} className="b-item">
                    <span className="b-bullet">•</span>
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Execution Deviations */}
          <div className="explainer-subbox">
            <div className="subbox-header">
              <ShieldCheck size={15} className="icon-green" />
              <h4>SimPy Execution Deviations ({deviations.length})</h4>
            </div>
            {deviations.length === 0 ? (
              <div className="clean-deviation-box">
                <CheckCircle2 size={16} className="icon-green" />
                <p>
                  Zero execution deviations recorded. 100% of the optimizer's planned recovery dispatches were
                  physically executed by the SimPy simulation engine within network bounds.
                </p>
              </div>
            ) : (
              <ul className="deviations-explainer-list">
                {deviations.map((dev, idx) => (
                  <li key={idx} className="dev-item">
                    <strong>Period t={dev.period} on {dev.route_id}:</strong> Planned {dev.planned_quantity} units,
                    dispatched {dev.actual_dispatched_quantity} units ({dev.reason}).
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
