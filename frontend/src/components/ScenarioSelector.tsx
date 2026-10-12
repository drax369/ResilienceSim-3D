import {
  Network,
  RefreshCw,
  Database,
  Factory,
  Building2,
  Store,
} from 'lucide-react';
import type { GraphResponse, ScenarioSummary } from '../types/models';

interface ScenarioSelectorProps {
  scenarios: ScenarioSummary[];
  selectedScenarioId: string;
  onSelectScenario: (id: string) => void;
  graph: GraphResponse | null;
  loading: boolean;
  onRefresh: () => void;
}

export function ScenarioSelector({
  scenarios,
  selectedScenarioId,
  onSelectScenario,
  graph,
  loading,
  onRefresh,
}: ScenarioSelectorProps) {
  const currentScenario = scenarios.find((s) => s.id === selectedScenarioId);

  return (
    <div className="deck-card scenario-selector-deck">
      <div className="deck-card-header">
        <div className="card-title-group">
          <Network size={18} className="deck-icon icon-blue" />
          <div>
            <h3>Benchmark Supply Chain Network Library</h3>
            <span className="card-subtitle">
              Pre-validated industrial multi-tier network topologies with directed routing
            </span>
          </div>
        </div>

        <div className="scenario-controls-row">
          <label htmlFor="scenario-select-input" className="select-label">
            Active Scenario:
          </label>
          <select
            id="scenario-select-input"
            className="select-scenario-dropdown"
            value={selectedScenarioId}
            onChange={(e) => onSelectScenario(e.target.value)}
            disabled={loading || scenarios.length === 0}
          >
            {scenarios.map((sc) => (
              <option key={sc.id} value={sc.id}>
                {sc.name} ({sc.industry})
              </option>
            ))}
          </select>

          <button
            className="btn-refresh-scenarios"
            onClick={onRefresh}
            disabled={loading}
            title="Reload scenarios from backend API"
          >
            <RefreshCw size={14} className={loading ? 'spin-icon' : ''} />
          </button>
        </div>
      </div>

      <div className="deck-card-body">
        {currentScenario && graph && (
          <div className="scenario-meta-layout">
            {/* Quick Metrics Bar */}
            <div className="scenario-stats-strip">
              <div className="s-stat-tile">
                <span className="s-label">Industry</span>
                <span className="s-val highlight-blue">{currentScenario.industry}</span>
              </div>
              <div className="s-stat-tile">
                <span className="s-label">Total Facilities</span>
                <span className="s-val">{graph.summary.total_nodes}</span>
              </div>
              <div className="s-stat-tile">
                <span className="s-label">Transport Lanes</span>
                <span className="s-val">{graph.summary.total_edges}</span>
              </div>
              <div className="s-stat-tile">
                <span className="s-label">Planning Horizon</span>
                <span className="s-val">
                  {currentScenario.planning_horizon_periods} {currentScenario.period_unit}
                </span>
              </div>
              <div className="s-stat-tile">
                <span className="s-label">Supply Capacity</span>
                <span className="s-val">{graph.summary.total_supply_capacity.toLocaleString()} units</span>
              </div>
              <div className="s-stat-tile">
                <span className="s-label">Daily Demand</span>
                <span className="s-val">{graph.summary.total_demand.toLocaleString()} units</span>
              </div>
              <div className="s-stat-tile">
                <span className="s-label">Network Topology</span>
                <span className="s-val highlight-green">
                  {graph.summary.unreachable_demand_nodes.length === 0
                    ? '100% Connected'
                    : `${graph.summary.unreachable_demand_nodes.length} Disconnected`}
                </span>
              </div>
            </div>

            {/* Description note */}
            <p className="scenario-narrative-note">
              {currentScenario.description}
            </p>

            {/* Facility Tiers Distribution Pills */}
            <div className="facility-tiers-pills-bar">
              <span className="tier-pills-label">Network Tier Breakdown:</span>
              <span className="tier-pill tier-pill-blue">
                <Database size={13} /> {graph.summary.nodes_by_type.supplier || 0} Suppliers
              </span>
              <span className="tier-pill tier-pill-indigo">
                <Factory size={13} /> {graph.summary.nodes_by_type.factory || 0} Factories
              </span>
              <span className="tier-pill tier-pill-teal">
                <Building2 size={13} />{' '}
                {(graph.summary.nodes_by_type.distribution_center || 0) +
                  (graph.summary.nodes_by_type.warehouse || 0)}{' '}
                Distribution Hubs
              </span>
              <span className="tier-pill tier-pill-green">
                <Store size={13} /> {graph.summary.nodes_by_type.retailer || 0} Retail Demand Centers
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
