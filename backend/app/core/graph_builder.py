"""Graph construction and deterministic 3D spatial layout generation."""
from collections import defaultdict
from typing import Any, Dict, List, Set
import networkx as nx

from app.models.common import Coordinate3D, FacilityType
from app.models.graph import (
    GraphEdge,
    GraphNode,
    GraphResponse,
    GraphSummary,
)
from app.models.scenario import Scenario

# Standard layered layout X-offsets along supply chain direction
TIER_LAYER_X: Dict[FacilityType, float] = {
    FacilityType.SUPPLIER: -30.0,
    FacilityType.FACTORY: -10.0,
    FacilityType.DISTRIBUTION_CENTER: 10.0,
    FacilityType.WAREHOUSE: 10.0,
    FacilityType.RETAILER: 30.0,
}

VERTICAL_SPACING = 12.0
DEPTH_STAGGER = 3.0


def assign_deterministic_3d_positions(scenario: Scenario) -> Scenario:
    """
    Ensures every facility has stable, deterministic, finite 3D coordinates.
    Preserves user-defined positions if already specified.
    Positions are layered left-to-right by supply-chain tier:
    Supplier (X=-30) -> Factory (X=-10) -> DC/Warehouse (X=+10) -> Retailer (X=+30).
    """
    # Group facilities by tier
    tiered_facilities: Dict[FacilityType, List[Any]] = defaultdict(list)
    for fac in scenario.facilities:
        tiered_facilities[fac.facility_type].append(fac)

    for f_type, fac_list in tiered_facilities.items():
        # Sort deterministically by ID
        fac_list.sort(key=lambda f: f.id)
        count = len(fac_list)
        layer_x = TIER_LAYER_X.get(f_type, 0.0)

        for i, fac in enumerate(fac_list):
            if fac.position is not None:
                continue  # Preserve explicit user-defined position

            # Compute centered vertical spread
            y_pos = (i - (count - 1) / 2.0) * VERTICAL_SPACING
            # Alternating subtle depth offset to reduce line and label overlap in 3D
            z_pos = ((i % 2) * 2.0 - 1.0) * DEPTH_STAGGER if count > 1 else 0.0

            fac.position = Coordinate3D(
                x=float(round(layer_x, 3)),
                y=float(round(y_pos, 3)),
                z=float(round(z_pos, 3)),
            )

    return scenario


def build_networkx_graph(scenario: Scenario) -> nx.DiGraph:
    """
    Builds a directed NetworkX graph (DiGraph) representing the supply chain.
    Preserves all operational attributes on nodes and edges for simulation and optimization.
    """
    graph = nx.DiGraph(
        id=scenario.id,
        name=scenario.name,
        industry=scenario.industry,
        planning_horizon=scenario.planning_horizon_periods,
        period_unit=scenario.period_unit,
    )

    # Add facilities as nodes
    for fac in scenario.facilities:
        pos_dict = fac.position.model_dump() if fac.position else None
        graph.add_node(
            fac.id,
            name=fac.name,
            facility_type=fac.facility_type.value,
            location=fac.location,
            position=pos_dict,
            supply_capacity=fac.supply_capacity,
            processing_capacity=fac.processing_capacity,
            inventory=fac.inventory,
            demand=fac.demand,
            status=fac.status.value,
            metadata=fac.metadata,
        )

    # Add routes as directed edges
    for r in scenario.routes:
        graph.add_edge(
            r.source_id,
            r.target_id,
            id=r.id,
            capacity=r.capacity,
            lead_time_periods=r.lead_time_periods,
            cost_per_unit=r.cost_per_unit,
            status=r.status.value,
            distance_km=r.distance_km,
            metadata=r.metadata,
        )

    return graph


def compute_graph_diagnostics(scenario: Scenario, graph: nx.DiGraph) -> GraphSummary:
    """
    Analyzes directed network connectivity and detects unreachable retailer demand.
    Does not mutate or remove disconnected nodes.
    """
    total_nodes = graph.number_of_nodes()
    total_edges = graph.number_of_edges()

    nodes_by_type: Dict[str, int] = defaultdict(int)
    for _, data in graph.nodes(data=True):
        nodes_by_type[data.get("facility_type", "unknown")] += 1

    total_supply = sum(
        f.supply_capacity for f in scenario.facilities if f.facility_type == FacilityType.SUPPLIER
    )
    total_demand = sum(
        f.demand for f in scenario.facilities if f.facility_type == FacilityType.RETAILER
    )

    is_weakly_connected = nx.is_weakly_connected(graph) if total_nodes > 0 else False
    is_strongly_connected = nx.is_strongly_connected(graph) if total_nodes > 0 else False

    # Detect unreachable retailer demand from suppliers
    supplier_ids: Set[str] = {
        f.id for f in scenario.facilities if f.facility_type == FacilityType.SUPPLIER
    }
    retailer_demand_nodes: List[str] = [
        f.id for f in scenario.facilities if f.facility_type == FacilityType.RETAILER and f.demand > 0
    ]

    unreachable_demand_nodes: List[str] = []
    for ret_id in retailer_demand_nodes:
        # Check if ANY supplier has a directed path to this retailer
        reachable = False
        for sup_id in supplier_ids:
            if nx.has_path(graph, sup_id, ret_id):
                reachable = True
                break
        if not reachable:
            unreachable_demand_nodes.append(ret_id)

    # Detect isolated nodes (no incoming or outgoing edges)
    isolated_nodes = list(nx.isolates(graph))

    return GraphSummary(
        total_nodes=total_nodes,
        total_edges=total_edges,
        nodes_by_type=dict(nodes_by_type),
        total_supply_capacity=total_supply,
        total_demand=total_demand,
        is_weakly_connected=is_weakly_connected,
        is_strongly_connected=is_strongly_connected,
        unreachable_demand_nodes=sorted(unreachable_demand_nodes),
        isolated_nodes=sorted(isolated_nodes),
    )


def scenario_to_graph_response(scenario: Scenario) -> GraphResponse:
    """
    Transforms a validated Scenario into a serializable GraphResponse.
    Ensures 3D positions are assigned first.
    """
    # Ensure layout positions exist
    positioned_scenario = assign_deterministic_3d_positions(scenario)
    graph = build_networkx_graph(positioned_scenario)
    summary = compute_graph_diagnostics(positioned_scenario, graph)

    nodes: List[GraphNode] = []
    for fac in positioned_scenario.facilities:
        nodes.append(
            GraphNode(
                id=fac.id,
                name=fac.name,
                facility_type=fac.facility_type,
                location=fac.location,
                position=fac.position,  # guaranteed non-null after assign_deterministic_3d_positions
                supply_capacity=fac.supply_capacity,
                processing_capacity=fac.processing_capacity,
                inventory=fac.inventory,
                demand=fac.demand,
                status=fac.status,
                metadata=fac.metadata,
            )
        )

    edges: List[GraphEdge] = []
    for r in positioned_scenario.routes:
        edges.append(
            GraphEdge(
                id=r.id,
                source=r.source_id,
                target=r.target_id,
                capacity=r.capacity,
                lead_time_periods=r.lead_time_periods,
                cost_per_unit=r.cost_per_unit,
                status=r.status,
                distance_km=r.distance_km,
                metadata=r.metadata,
            )
        )

    return GraphResponse(
        scenario_id=scenario.id,
        nodes=nodes,
        edges=edges,
        summary=summary,
    )
