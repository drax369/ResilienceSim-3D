import {
  X,
  Building2,
  Truck,
  ArrowRight,
  Database,
  Factory,
  Store,
  Layers,
  MapPin,
  Clock,
  DollarSign,
  Activity,
  Maximize2,
} from 'lucide-react';
import type { GraphResponse } from '../types/models';

interface InspectorPanelProps {
  graph: GraphResponse | null;
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  onSelectNode: (id: string | null) => void;
  onSelectEdge: (id: string | null) => void;
  currentPeriodInventory?: number | null;
}

export function InspectorPanel({
  graph,
  selectedNodeId,
  selectedEdgeId,
  onSelectNode,
  onSelectEdge,
  currentPeriodInventory,
}: InspectorPanelProps) {
  if (!graph) return null;

  const selectedNode = selectedNodeId
    ? graph.nodes.find((n) => n.id === selectedNodeId)
    : null;

  const selectedEdge = selectedEdgeId
    ? graph.edges.find((e) => e.id === selectedEdgeId)
    : null;

  const sourceNode = selectedEdge
    ? graph.nodes.find((n) => n.id === selectedEdge.source)
    : null;

  const targetNode = selectedEdge
    ? graph.nodes.find((n) => n.id === selectedEdge.target)
    : null;

  // Inbound and Outbound routes for the selected node
  const inboundRoutes = selectedNode
    ? graph.edges.filter((e) => e.target === selectedNode.id)
    : [];

  const outboundRoutes = selectedNode
    ? graph.edges.filter((e) => e.source === selectedNode.id)
    : [];

  const getNodeIcon = (type: string) => {
    switch (type) {
      case 'supplier':
        return <Database size={16} className="inspector-type-icon icon-blue" />;
      case 'factory':
        return <Factory size={16} className="inspector-type-icon icon-indigo" />;
      case 'distribution_center':
      case 'warehouse':
        return <Building2 size={16} className="inspector-type-icon icon-teal" />;
      case 'retailer':
        return <Store size={16} className="inspector-type-icon icon-green" />;
      default:
        return <Layers size={16} className="inspector-type-icon" />;
    }
  };

  return (
    <div className="inspector-dock-card">
      <div className="inspector-dock-header">
        <div className="dock-title-group">
          {selectedNode ? (
            getNodeIcon(selectedNode.facility_type)
          ) : selectedEdge ? (
            <Truck size={16} className="inspector-type-icon icon-blue" />
          ) : (
            <Maximize2 size={16} className="inspector-type-icon icon-muted" />
          )}
          <h3>
            {selectedNode
              ? 'Facility Inspector'
              : selectedEdge
                ? 'Transport Route Inspector'
                : 'Network Element Inspector'}
          </h3>
        </div>

        {(selectedNode || selectedEdge) && (
          <button
            className="btn-close-inspector"
            onClick={() => {
              onSelectNode(null);
              onSelectEdge(null);
            }}
            title="Deselect"
          >
            <X size={15} />
          </button>
        )}
      </div>

      <div className="inspector-dock-body">
        {/* Empty selection state */}
        {!selectedNode && !selectedEdge && (
          <div className="inspector-empty-state">
            <p className="empty-hint-text">
              Click any facility node or transport route in the 3D digital twin to inspect operational attributes,
              live capacities, and topological connections.
            </p>
          </div>
        )}

        {/* Selected Facility Inspector */}
        {selectedNode && (
          <div className="inspector-details-stack">
            <div className="inspector-primary-id">
              <h4>{selectedNode.name}</h4>
              <span className="element-id-pill">ID: <code>{selectedNode.id}</code></span>
            </div>

            <div className="inspector-badge-row">
              <span className={`status-badge status-${selectedNode.status}`}>
                <Activity size={12} /> {selectedNode.status.toUpperCase()}
              </span>
              <span className="type-badge">
                {selectedNode.facility_type.replace('_', ' ').toUpperCase()}
              </span>
              {selectedNode.location && (
                <span className="location-badge">
                  <MapPin size={12} /> {selectedNode.location}
                </span>
              )}
            </div>

            {/* Metrics Grid */}
            <div className="inspector-metrics-grid">
              {selectedNode.supply_capacity > 0 && (
                <div className="insp-metric-tile">
                  <span className="tile-label">Supply Capacity</span>
                  <span className="tile-value">{selectedNode.supply_capacity} <small>units/period</small></span>
                </div>
              )}

              {selectedNode.processing_capacity > 0 && (
                <div className="insp-metric-tile">
                  <span className="tile-label">Processing Limit</span>
                  <span className="tile-value">{selectedNode.processing_capacity} <small>units/period</small></span>
                </div>
              )}

              <div className="insp-metric-tile">
                <span className="tile-label">Conserved Inventory</span>
                <span className="tile-value">
                  {currentPeriodInventory !== null && currentPeriodInventory !== undefined
                    ? currentPeriodInventory
                    : selectedNode.inventory}{' '}
                  <small>units</small>
                </span>
              </div>

              {selectedNode.demand > 0 && (
                <div className="insp-metric-tile">
                  <span className="tile-label">Retail Demand</span>
                  <span className="tile-value highlight-green">{selectedNode.demand} <small>units/period</small></span>
                </div>
              )}

              <div className="insp-metric-tile">
                <span className="tile-label">3D Coordinates</span>
                <span className="tile-value mono-val">
                  [{selectedNode.position.x}, {selectedNode.position.y}, {selectedNode.position.z}]
                </span>
              </div>
            </div>

            {/* Inbound & Outbound Connections */}
            <div className="connections-section">
              <div className="conn-block">
                <h5>Inbound Routes ({inboundRoutes.length})</h5>
                {inboundRoutes.length === 0 ? (
                  <span className="no-conn-text">Tier-0 Origin (No Inbound Routes)</span>
                ) : (
                  <div className="conn-chips-list">
                    {inboundRoutes.map((r) => (
                      <button
                        key={r.id}
                        className="conn-chip"
                        onClick={() => onSelectEdge(r.id)}
                        title={`Inspect lane ${r.id}`}
                      >
                        <code>{r.source}</code> &rarr; <span>Cap {r.capacity}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="conn-block">
                <h5>Outbound Routes ({outboundRoutes.length})</h5>
                {outboundRoutes.length === 0 ? (
                  <span className="no-conn-text">Demand Sink (No Outbound Routes)</span>
                ) : (
                  <div className="conn-chips-list">
                    {outboundRoutes.map((r) => (
                      <button
                        key={r.id}
                        className="conn-chip"
                        onClick={() => onSelectEdge(r.id)}
                        title={`Inspect lane ${r.id}`}
                      >
                        &rarr; <code>{r.target}</code> • <span>Cap {r.capacity}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Selected Route Inspector */}
        {selectedEdge && (
          <div className="inspector-details-stack">
            <div className="inspector-primary-id">
              <h4>Transport Corridor</h4>
              <span className="element-id-pill">ID: <code>{selectedEdge.id}</code></span>
            </div>

            {/* Route Topology Card */}
            <div className="route-topology-visual">
              <button
                className="route-endpoint-btn"
                onClick={() => onSelectNode(selectedEdge.source)}
                title="Inspect origin facility"
              >
                <strong>{sourceNode?.name || selectedEdge.source}</strong>
                <small>{selectedEdge.source}</small>
              </button>

              <div className="route-arrow-connector">
                <ArrowRight size={18} />
                <span className="route-lead-badge">{selectedEdge.lead_time_periods}d lead</span>
              </div>

              <button
                className="route-endpoint-btn"
                onClick={() => onSelectNode(selectedEdge.target)}
                title="Inspect destination facility"
              >
                <strong>{targetNode?.name || selectedEdge.target}</strong>
                <small>{selectedEdge.target}</small>
              </button>
            </div>

            {/* Route Metrics Grid */}
            <div className="inspector-metrics-grid">
              <div className="insp-metric-tile">
                <span className="tile-label">Lanes Throughput Capacity</span>
                <span className="tile-value">{selectedEdge.capacity} <small>units/period</small></span>
              </div>

              <div className="insp-metric-tile">
                <span className="tile-label">Lead Time</span>
                <span className="tile-value">
                  <Clock size={13} className="inline-icon" /> {selectedEdge.lead_time_periods} <small>periods</small>
                </span>
              </div>

              <div className="insp-metric-tile">
                <span className="tile-label">Transport Unit Cost</span>
                <span className="tile-value">
                  <DollarSign size={13} className="inline-icon" /> ${selectedEdge.cost_per_unit.toFixed(2)} <small>/unit</small>
                </span>
              </div>

              {selectedEdge.distance_km && (
                <div className="insp-metric-tile">
                  <span className="tile-label">Geographic Distance</span>
                  <span className="tile-value">{selectedEdge.distance_km.toLocaleString()} <small>km</small></span>
                </div>
              )}

              <div className="insp-metric-tile">
                <span className="tile-label">Lane Status</span>
                <span className={`tile-value status-${selectedEdge.status}`}>
                  {selectedEdge.status.toUpperCase()}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
