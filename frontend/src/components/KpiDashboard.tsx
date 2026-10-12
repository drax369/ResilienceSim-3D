import { useState } from 'react';
import {
  BarChart3,
  LineChart,
} from 'lucide-react';
import type {
  OptimizationRecoveryResponse,
  SimulationDeltaMetrics,
  SimulationResult,
} from '../types/models';

interface KpiDashboardProps {
  baselineResult: SimulationResult | null;
  disruptedResult: SimulationResult | null;
  recoveredResult: SimulationResult | null;
  deltasDisrupted?: SimulationDeltaMetrics | null;
  deltasRecovered?: SimulationDeltaMetrics | null;
  optimizationResponse?: OptimizationRecoveryResponse | null;
}

/**
 * Native Responsive SVG Multi-line Chart comparing time-series values
 */
function MultiLineChart({
  title,
  periods,
  baselineData,
  disruptedData,
  recoveredData,
  unit = '%',
  maxY = 100,
}: {
  title: string;
  periods: number;
  baselineData: number[];
  disruptedData?: number[];
  recoveredData?: number[];
  unit?: string;
  maxY?: number;
}) {
  const width = 500;
  const height = 180;
  const padding = { top: 20, right: 30, bottom: 30, left: 45 };

  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  // Scale functions
  const getX = (index: number) => padding.left + (index / Math.max(1, periods - 1)) * chartW;
  const getY = (val: number) => padding.top + chartH - (Math.min(val, maxY) / Math.max(1, maxY)) * chartH;

  // Build SVG path strings
  const buildPath = (data: number[]) => {
    if (!data || data.length === 0) return '';
    return data
      .map((val, idx) => `${idx === 0 ? 'M' : 'L'} ${getX(idx).toFixed(1)} ${getY(val).toFixed(1)}`)
      .join(' ');
  };

  const pathBase = buildPath(baselineData);
  const pathDisr = disruptedData ? buildPath(disruptedData) : '';
  const pathRec = recoveredData ? buildPath(recoveredData) : '';

  return (
    <div className="chart-card">
      <div className="chart-header">
        <h4>{title}</h4>
        <div className="chart-legend-row">
          <span className="legend-chip chip-blue">Baseline</span>
          {disruptedData && <span className="legend-chip chip-red">Disrupted</span>}
          {recoveredData && <span className="legend-chip chip-green">Recovered</span>}
        </div>
      </div>

      <div className="svg-wrapper">
        <svg viewBox={`0 0 ${width} ${height}`} className="responsive-svg-chart">
          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((pct, idx) => {
            const y = padding.top + chartH * (1 - pct);
            const valLabel = Math.round(maxY * pct);
            return (
              <g key={idx}>
                <line
                  x1={padding.left}
                  y1={y}
                  x2={width - padding.right}
                  y2={y}
                  stroke="#e2e8f0"
                  strokeDasharray="3 3"
                />
                <text
                  x={padding.left - 8}
                  y={y + 4}
                  fill="#64748b"
                  fontSize="10"
                  textAnchor="end"
                  fontFamily="monospace"
                >
                  {valLabel}
                  {unit}
                </text>
              </g>
            );
          })}

          {/* X Axis ticks */}
          {Array.from({ length: Math.min(periods, 7) }).map((_, i) => {
            const periodIdx = Math.round((i / (Math.min(periods, 7) - 1)) * (periods - 1));
            const x = getX(periodIdx);
            return (
              <text
                key={i}
                x={x}
                y={height - 8}
                fill="#64748b"
                fontSize="10"
                textAnchor="middle"
                fontFamily="monospace"
              >
                t={periodIdx}
              </text>
            );
          })}

          {/* Paths */}
          {pathBase && (
            <path
              d={pathBase}
              fill="none"
              stroke="#0284c7"
              strokeWidth="2.2"
              strokeLinecap="round"
            />
          )}
          {pathDisr && (
            <path
              d={pathDisr}
              fill="none"
              stroke="#ef4444"
              strokeWidth="2.2"
              strokeDasharray="4 2"
              strokeLinecap="round"
            />
          )}
          {pathRec && (
            <path
              d={pathRec}
              fill="none"
              stroke="#10b981"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          )}
        </svg>
      </div>
    </div>
  );
}

export function KpiDashboard({
  baselineResult,
  disruptedResult,
  recoveredResult,
  deltasDisrupted,
  deltasRecovered,
  optimizationResponse,
}: KpiDashboardProps) {
  const [activeTab, setActiveTab] = useState<'cards' | 'charts'>('cards');

  if (!baselineResult) return null;

  const horizon = baselineResult.planning_horizon_periods;

  // Extract SLA series
  const baselineSlaSeries = baselineResult.period_metrics.map((m) => m.service_level_pct);
  const disruptedSlaSeries = disruptedResult?.period_metrics.map((m) => m.service_level_pct);
  const recoveredSlaSeries = recoveredResult?.period_metrics.map((m) => m.service_level_pct);

  // Extract Delivered Series
  const baselineDelivSeries = baselineResult.period_metrics.map((m) => m.delivered_units);
  const disruptedDelivSeries = disruptedResult?.period_metrics.map((m) => m.delivered_units);
  const recoveredDelivSeries = recoveredResult?.period_metrics.map((m) => m.delivered_units);

  const maxDelivVal = Math.max(
    ...baselineDelivSeries,
    ...(disruptedDelivSeries || [0]),
    ...(recoveredDelivSeries || [0]),
    100
  );

  return (
    <div className="deck-card kpi-dashboard-card">
      <div className="deck-card-header">
        <div className="card-title-group">
          <BarChart3 size={18} className="deck-icon icon-blue" />
          <div>
            <h3>3-Way Operational KPI Dashboard</h3>
            <span className="card-subtitle">
              Auditable comparison of Baseline, Unmitigated Disruption, and OR-Tools Recovered states
            </span>
          </div>
        </div>

        {/* View Switcher Tabs */}
        <div className="kpi-view-tabs">
          <button
            className={`tab-btn ${activeTab === 'cards' ? 'active' : ''}`}
            onClick={() => setActiveTab('cards')}
          >
            <BarChart3 size={14} />
            <span>Operational Scorecards</span>
          </button>
          <button
            className={`tab-btn ${activeTab === 'charts' ? 'active' : ''}`}
            onClick={() => setActiveTab('charts')}
          >
            <LineChart size={14} />
            <span>Time-Series Analytics</span>
          </button>
        </div>
      </div>

      <div className="deck-card-body">
        {activeTab === 'cards' && (
          <div className="three-way-scorecards-grid">
            {/* Card 1: State 1 — Baseline */}
            <div className="scorecard-column state-1-card">
              <div className="scorecard-top">
                <span className="state-badge-pill pill-blue">State 1</span>
                <h4>Healthy Baseline</h4>
                <p className="state-desc">Pristine network without injected shocks</p>
              </div>

              <div className="scorecard-primary-stat">
                <span className="stat-label">Service Level (SLA)</span>
                <span className="stat-value highlight-green">
                  {baselineResult.service_level_pct.toFixed(1)}%
                </span>
              </div>

              <div className="scorecard-metrics-list">
                <div className="sc-metric-row">
                  <span>Requested Demand</span>
                  <strong>{baselineResult.total_requested_demand.toLocaleString()} units</strong>
                </div>
                <div className="sc-metric-row">
                  <span>Delivered Units</span>
                  <strong className="highlight-green">{baselineResult.total_delivered_units.toLocaleString()} units</strong>
                </div>
                <div className="sc-metric-row">
                  <span>Unmet Shortage</span>
                  <strong>{baselineResult.total_unmet_demand.toLocaleString()} units</strong>
                </div>
                <div className="sc-metric-row">
                  <span>Transportation Cost</span>
                  <strong>${baselineResult.total_transport_cost.toLocaleString()}</strong>
                </div>
                <div className="sc-metric-row">
                  <span>Shipments Dispatched</span>
                  <strong>{baselineResult.shipments_dispatched_count}</strong>
                </div>
                <div className="sc-metric-row">
                  <span>In-Transit Backlog</span>
                  <strong>{baselineResult.in_transit_units.toLocaleString()} units</strong>
                </div>
              </div>
            </div>

            {/* Card 2: State 2 — Disrupted */}
            <div className="scorecard-column state-2-card">
              <div className="scorecard-top">
                <span className="state-badge-pill pill-red">State 2</span>
                <h4>Unmitigated Disruption</h4>
                <p className="state-desc">Simulated network without recovery actions</p>
              </div>

              {disruptedResult ? (
                <>
                  <div className="scorecard-primary-stat">
                    <span className="stat-label">Service Level (SLA)</span>
                    <span className="stat-value highlight-red">
                      {disruptedResult.service_level_pct.toFixed(1)}%
                      {deltasDisrupted && (
                        <span className="stat-delta-chip delta-red">
                          {deltasDisrupted.service_level_delta_pct_points > 0 ? '+' : ''}
                          {deltasDisrupted.service_level_delta_pct_points}% pts
                        </span>
                      )}
                    </span>
                  </div>

                  <div className="scorecard-metrics-list">
                    <div className="sc-metric-row">
                      <span>Requested Demand</span>
                      <strong>{disruptedResult.total_requested_demand.toLocaleString()} units</strong>
                    </div>
                    <div className="sc-metric-row">
                      <span>Delivered Units</span>
                      <strong>
                        {disruptedResult.total_delivered_units.toLocaleString()} units
                        {deltasDisrupted && (
                          <span className="sub-delta text-red">
                            ({deltasDisrupted.delivered_units_pct_change}%)
                          </span>
                        )}
                      </strong>
                    </div>
                    <div className="sc-metric-row">
                      <span>Unmet Shortage</span>
                      <strong className="highlight-red">
                        {disruptedResult.total_unmet_demand.toLocaleString()} units
                        {deltasDisrupted && deltasDisrupted.unmet_demand_delta > 0 && (
                          <span className="sub-delta text-red">
                            (+{deltasDisrupted.unmet_demand_delta.toLocaleString()})
                          </span>
                        )}
                      </strong>
                    </div>
                    <div className="sc-metric-row">
                      <span>Transportation Cost</span>
                      <strong>
                        ${disruptedResult.total_transport_cost.toLocaleString()}
                        {deltasDisrupted && (
                          <span className="sub-delta">
                            ({deltasDisrupted.transport_cost_pct_change > 0 ? '+' : ''}
                            {deltasDisrupted.transport_cost_pct_change}%)
                          </span>
                        )}
                      </strong>
                    </div>
                    <div className="sc-metric-row">
                      <span>Shipments Dispatched</span>
                      <strong>{disruptedResult.shipments_dispatched_count}</strong>
                    </div>
                    <div className="sc-metric-row">
                      <span>In-Transit Backlog</span>
                      <strong>{disruptedResult.in_transit_units.toLocaleString()} units</strong>
                    </div>
                  </div>
                </>
              ) : (
                <div className="scorecard-pending-state">
                  <p>Run Disrupted Simulation or Recovery Optimization to evaluate impact.</p>
                </div>
              )}
            </div>

            {/* Card 3: State 3 — Recovered */}
            <div className="scorecard-column state-3-card">
              <div className="scorecard-top">
                <span className="state-badge-pill pill-green">State 3</span>
                <h4>OR-Tools Recovery</h4>
                <p className="state-desc">GLOP dispatch plan re-simulated in SimPy</p>
              </div>

              {recoveredResult ? (
                <>
                  <div className="scorecard-primary-stat">
                    <span className="stat-label">Service Level (SLA)</span>
                    <span className="stat-value highlight-green">
                      {recoveredResult.service_level_pct.toFixed(1)}%
                      {deltasRecovered && (
                        <span className="stat-delta-chip delta-green">
                          +{deltasRecovered.service_level_delta_pct_points}% pts vs Disrupted
                        </span>
                      )}
                    </span>
                  </div>

                  {deltasRecovered && deltasRecovered.delivered_units_delta > 0 && deltasRecovered.transport_cost_delta > 0 && (
                    <div className="tradeoff-callout-strip">
                      <strong>Trade-Off:</strong> +${deltasRecovered.transport_cost_delta.toLocaleString()} extra transport spend to rescue +{deltasRecovered.delivered_units_delta.toLocaleString()} units (+{deltasRecovered.service_level_delta_pct_points}% pts SLA)
                    </div>
                  )}

                  <div className="scorecard-metrics-list">
                    <div className="sc-metric-row">
                      <span>Requested Demand</span>
                      <strong>{recoveredResult.total_requested_demand.toLocaleString()} units</strong>
                    </div>
                    <div className="sc-metric-row">
                      <span>Delivered Units</span>
                      <strong className="highlight-green">
                        {recoveredResult.total_delivered_units.toLocaleString()} units
                        {deltasRecovered && (
                          <span className="sub-delta text-green">
                            (+{deltasRecovered.delivered_units_delta.toLocaleString()} units)
                          </span>
                        )}
                      </strong>
                    </div>
                    <div className="sc-metric-row">
                      <span>Unmet Shortage</span>
                      <strong>
                        {recoveredResult.total_unmet_demand.toLocaleString()} units
                        {deltasRecovered && (
                          <span className="sub-delta text-green">
                            ({deltasRecovered.unmet_demand_delta < 0 ? '' : '+'}
                            {deltasRecovered.unmet_demand_delta.toLocaleString()})
                          </span>
                        )}
                      </strong>
                    </div>
                    <div className="sc-metric-row">
                      <span>Transportation Cost</span>
                      <strong>
                        ${recoveredResult.total_transport_cost.toLocaleString()}
                        {deltasRecovered && (
                          <span className="sub-delta">
                            ({deltasRecovered.transport_cost_pct_change > 0 ? '+' : ''}
                            {deltasRecovered.transport_cost_pct_change}%)
                          </span>
                        )}
                      </strong>
                    </div>
                    <div className="sc-metric-row">
                      <span>Execution Deviations</span>
                      <strong className="highlight-blue">
                        {optimizationResponse ? optimizationResponse.execution_deviations.length : 0}{' '}
                        (Physical bounds respected)
                      </strong>
                    </div>
                    <div className="sc-metric-row">
                      <span>Solver Runtime</span>
                      <strong>{optimizationResponse ? `${optimizationResponse.solve_runtime_ms} ms` : 'N/A'}</strong>
                    </div>
                  </div>
                </>
              ) : (
                <div className="scorecard-pending-state">
                  <p>Click "Run Constrained Recovery Optimization" to solve and re-simulate State 3.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Time-Series Charts Tab */}
        {activeTab === 'charts' && (
          <div className="charts-view-grid">
            <MultiLineChart
              title="Service Level Performance Over Planning Horizon"
              periods={horizon}
              baselineData={baselineSlaSeries}
              disruptedData={disruptedSlaSeries}
              recoveredData={recoveredSlaSeries}
              unit="%"
              maxY={100}
            />

            <MultiLineChart
              title="Daily Delivered Units Progression Across Horizon"
              periods={horizon}
              baselineData={baselineDelivSeries}
              disruptedData={disruptedDelivSeries}
              recoveredData={recoveredDelivSeries}
              unit=" u"
              maxY={maxDelivVal * 1.15}
            />
          </div>
        )}
      </div>
    </div>
  );
}
