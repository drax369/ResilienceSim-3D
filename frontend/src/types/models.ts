/**
 * Core type definitions for ResilienceSim 3D.
 * Mirrors backend Pydantic models for validated API contracts.
 */

export interface HealthStatus {
  status: 'healthy' | 'unhealthy';
  service: string;
  version: string;
  timestamp: string;
}

export type FacilityType =
  | 'supplier'
  | 'factory'
  | 'distribution_center'
  | 'warehouse'
  | 'retailer';

export type OperationalStatus = 'operational' | 'degraded' | 'offline';

export type RouteStatus = 'active' | 'congested' | 'blocked';

export type DisruptionType =
  | 'facility_shutdown'
  | 'route_closure'
  | 'capacity_reduction'
  | 'lead_time_increase'
  | 'demand_surge';

export interface Coordinate3D {
  x: number;
  y: number;
  z: number;
}

export interface Facility {
  id: string;
  name: string;
  facility_type: FacilityType;
  location?: string | null;
  position?: Coordinate3D | null;
  supply_capacity: number;
  processing_capacity: number;
  inventory: number;
  demand: number;
  status: OperationalStatus;
  metadata?: Record<string, unknown>;
}

export interface TransportRoute {
  id: string;
  source_id: string;
  target_id: string;
  capacity: number;
  lead_time_periods: number;
  cost_per_unit: number;
  status: RouteStatus;
  distance_km?: number | null;
  metadata?: Record<string, unknown>;
}

export interface Disruption {
  id: string;
  disruption_type: DisruptionType;
  target_id: string;
  magnitude: number;
  start_period: number;
  duration_periods?: number | null;
  description?: string | null;
}

export interface ScenarioSummary {
  id: string;
  name: string;
  description: string;
  industry: string;
  node_count: number;
  route_count: number;
  planning_horizon_periods: number;
  period_unit: string;
  total_supply_capacity: number;
  total_demand: number;
}

export interface Scenario {
  id: string;
  name: string;
  description: string;
  industry: string;
  planning_horizon_periods: number;
  period_unit: string;
  facilities: Facility[];
  routes: TransportRoute[];
  initial_disruptions: Disruption[];
  metadata?: Record<string, unknown>;
}

export interface GraphNode {
  id: string;
  name: string;
  facility_type: FacilityType;
  location?: string | null;
  position: Coordinate3D;
  supply_capacity: number;
  processing_capacity: number;
  inventory: number;
  demand: number;
  status: OperationalStatus;
  metadata?: Record<string, unknown>;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  capacity: number;
  lead_time_periods: number;
  cost_per_unit: number;
  status: RouteStatus;
  distance_km?: number | null;
  metadata?: Record<string, unknown>;
}

export interface GraphSummary {
  total_nodes: number;
  total_edges: number;
  nodes_by_type: Record<string, number>;
  total_supply_capacity: number;
  total_demand: number;
  is_weakly_connected: boolean;
  is_strongly_connected: boolean;
  unreachable_demand_nodes: string[];
  isolated_nodes: string[];
}

export interface GraphResponse {
  scenario_id: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  summary: GraphSummary;
}

export type SimulationMode = 'baseline' | 'disrupted';
export type ShipmentStatus = 'dispatched' | 'delivered' | 'in_transit' | 'blocked';

export interface ShipmentRecord {
  shipment_id: string;
  route_id: string;
  source_id: string;
  target_id: string;
  quantity: number;
  dispatch_period: number;
  expected_arrival_period: number;
  actual_arrival_period?: number | null;
  status: ShipmentStatus;
  cost: number;
}

export interface PeriodMetrics {
  period: number;
  requested_demand: number;
  delivered_units: number;
  unmet_demand: number;
  service_level_pct: number;
  transport_cost: number;
  shipments_dispatched: number;
  shipments_delivered: number;
  active_disruptions: string[];
}

export interface DisruptionEventRecord {
  disruption_id: string;
  disruption_type: string;
  target_id: string;
  period: number;
  event: string;
  details?: Record<string, unknown>;
}

export interface SimulationRequest {
  scenario_id: string;
  mode?: SimulationMode;
  disruptions?: Disruption[];
  horizon_periods?: number | null;
  random_seed?: number;
}

export interface SimulationResult {
  scenario_id: string;
  simulation_mode: SimulationMode;
  planning_horizon_periods: number;
  period_unit: string;
  total_requested_demand: number;
  total_delivered_units: number;
  total_unmet_demand: number;
  service_level_pct: number;
  total_transport_cost: number;
  shipments_dispatched_count: number;
  shipments_delivered_count: number;
  shipments_in_transit_count: number;
  in_transit_units: number;
  period_metrics: PeriodMetrics[];
  shipment_records: ShipmentRecord[];
  inventory_snapshots: Record<string, Record<number, number>>;
  disruption_events: DisruptionEventRecord[];
  status: string;
  warnings: string[];
}

export interface SimulationDeltaMetrics {
  delivered_units_delta: number;
  delivered_units_pct_change: number;
  unmet_demand_delta: number;
  unmet_demand_pct_change: number;
  service_level_delta_pct_points: number;
  transport_cost_delta: number;
  transport_cost_pct_change: number;
  in_transit_units_delta: number;
}

export interface ComparisonRequest {
  scenario_id: string;
  disruptions?: Disruption[];
  horizon_periods?: number | null;
  random_seed?: number;
}

export interface ComparisonResult {
  scenario_id: string;
  planning_horizon_periods: number;
  period_unit: string;
  baseline: SimulationResult;
  disrupted: SimulationResult;
  deltas: SimulationDeltaMetrics;
  disruptions_applied_count: number;
}

// =========================================================================
// PHASE 4 OPTIMIZATION TYPES (Google OR-Tools)
// =========================================================================

export type OptimizationSolverStatus =
  | 'optimal'
  | 'feasible'
  | 'infeasible'
  | 'unbounded'
  | 'abnormal'
  | 'solver_unavailable';

export interface RouteDispatchDecision {
  period: number;
  route_id: string;
  source_id: string;
  target_id: string;
  planned_quantity: number;
  unit_cost: number;
  total_cost: number;
}

export interface RecoveryAction {
  action_type: string;
  facility_or_route_id: string;
  period: number;
  description: string;
  quantity: number;
}

export interface ExecutionDeviation {
  period: number;
  route_id: string;
  source_id: string;
  target_id: string;
  planned_quantity: number;
  actual_dispatched_quantity: number;
  deviation: number;
  reason: string;
}

export interface RecoveryPlan {
  scenario_id: string;
  planning_horizon_periods: number;
  solver_status: OptimizationSolverStatus;
  objective_value: number;
  total_planned_dispatches: number;
  total_planned_transport_cost: number;
  dispatches_by_period: Record<number, RouteDispatchDecision[]>;
  summary_flow_by_route: Record<string, number>;
  rerouted_routes: string[];
  bottlenecks: string[];
}

export interface OptimizationRequest {
  scenario_id: string;
  disruptions?: Disruption[];
  horizon_periods?: number | null;
  shortage_penalty_per_unit?: number;
  random_seed?: number | null;
}

export interface OptimizationRecoveryResponse {
  scenario_id: string;
  planning_horizon_periods: number;
  period_unit: string;
  solver_name: string;
  solver_status: OptimizationSolverStatus;
  is_feasible: boolean;
  objective_value: number;
  solve_runtime_ms: number;
  recovery_plan?: RecoveryPlan | null;
  recovery_actions: RecoveryAction[];
  execution_deviations: ExecutionDeviation[];
  baseline: SimulationResult;
  disrupted: SimulationResult;
  recovered?: SimulationResult | null;
  baseline_to_disrupted: SimulationDeltaMetrics;
  disrupted_to_recovered?: SimulationDeltaMetrics | null;
  baseline_to_recovered?: SimulationDeltaMetrics | null;
  bottlenecks_and_shortages: string[];
  warnings: string[];
}

