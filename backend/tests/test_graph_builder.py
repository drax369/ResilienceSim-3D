"""Unit tests for NetworkX graph builder, diagnostics, and 3D positioning."""
import math
import networkx as nx
import pytest

from app.core.graph_builder import (
    assign_deterministic_3d_positions,
    build_networkx_graph,
    compute_graph_diagnostics,
)
from app.models.common import Coordinate3D, FacilityType
from app.models.facility import Facility
from app.models.route import TransportRoute
from app.models.scenario import Scenario
from app.scenarios.benchmark_scenarios import create_global_electronics_scenario


def test_build_networkx_graph_preserves_attributes():
    scenario = create_global_electronics_scenario()
    graph = build_networkx_graph(scenario)

    assert isinstance(graph, nx.DiGraph)
    assert graph.number_of_nodes() == len(scenario.facilities)
    assert graph.number_of_edges() == len(scenario.routes)

    # Check node attributes
    node_data = graph.nodes["sup_semi_taiwan"]
    assert node_data["facility_type"] == FacilityType.SUPPLIER.value
    assert node_data["supply_capacity"] == 500.0

    # Check edge attributes
    edge_data = graph.edges[("sup_semi_taiwan", "fac_shenzhen")]
    assert edge_data["capacity"] == 350.0
    assert edge_data["cost_per_unit"] == 3.5
    assert edge_data["lead_time_periods"] == 1.0


def test_compute_graph_diagnostics_healthy_network():
    scenario = create_global_electronics_scenario()
    graph = build_networkx_graph(scenario)
    summary = compute_graph_diagnostics(scenario, graph)

    assert summary.total_nodes == 13
    assert summary.total_edges == 22
    assert summary.is_weakly_connected is True
    assert len(summary.unreachable_demand_nodes) == 0
    assert summary.total_supply_capacity == 1550.0
    assert summary.total_demand == 1000.0


def test_unreachable_demand_node_detection_without_deletion():
    """Verify disconnected retailer demand is detected and NOT deleted."""
    f_sup = Facility(id="sup_1", name="Supplier", facility_type=FacilityType.SUPPLIER, supply_capacity=100.0)
    f_ret_reachable = Facility(id="ret_1", name="Reachable Retailer", facility_type=FacilityType.RETAILER, demand=50.0)
    f_ret_isolated = Facility(id="ret_iso", name="Isolated Retailer", facility_type=FacilityType.RETAILER, demand=40.0)

    r1 = TransportRoute(id="r_1", source_id="sup_1", target_id="ret_1", capacity=50.0, lead_time_periods=1.0, cost_per_unit=1.0)

    scenario = Scenario(
        id="test_disc",
        name="Disconnected Test",
        description="Testing unreachable diagnostics",
        industry="Test",
        facilities=[f_sup, f_ret_reachable, f_ret_isolated],
        routes=[r1],
    )

    graph = build_networkx_graph(scenario)
    summary = compute_graph_diagnostics(scenario, graph)

    # Isolated retailer must be flagged as unreachable demand
    assert "ret_iso" in summary.unreachable_demand_nodes
    assert "ret_1" not in summary.unreachable_demand_nodes

    # Isolated node must still exist in the graph (not silently removed)
    assert graph.has_node("ret_iso")
    assert graph.number_of_nodes() == 3


def test_deterministic_3d_positions_stability_and_tiers():
    scenario = create_global_electronics_scenario()
    # Reset positions to test fresh assignment
    for f in scenario.facilities:
        f.position = None

    scenario_assigned = assign_deterministic_3d_positions(scenario)

    # 1. Every facility has finite coordinates
    for f in scenario_assigned.facilities:
        assert f.position is not None
        assert math.isfinite(f.position.x)
        assert math.isfinite(f.position.y)
        assert math.isfinite(f.position.z)

    # 2. Tier layered placement
    suppliers = [f for f in scenario_assigned.facilities if f.facility_type == FacilityType.SUPPLIER]
    factories = [f for f in scenario_assigned.facilities if f.facility_type == FacilityType.FACTORY]
    dcs = [f for f in scenario_assigned.facilities if f.facility_type == FacilityType.DISTRIBUTION_CENTER]
    retailers = [f for f in scenario_assigned.facilities if f.facility_type == FacilityType.RETAILER]

    assert all(f.position.x == -30.0 for f in suppliers)
    assert all(f.position.x == -10.0 for f in factories)
    assert all(f.position.x == 10.0 for f in dcs)
    assert all(f.position.x == 30.0 for f in retailers)

    # 3. Repeatability: re-running gives identical positions
    positions_run1 = {f.id: (f.position.x, f.position.y, f.position.z) for f in scenario_assigned.facilities}

    scenario_2 = create_global_electronics_scenario()
    for f in scenario_2.facilities:
        f.position = None
    assign_deterministic_3d_positions(scenario_2)
    positions_run2 = {f.id: (f.position.x, f.position.y, f.position.z) for f in scenario_2.facilities}

    assert positions_run1 == positions_run2


def test_preserves_explicit_user_position():
    custom_pos = Coordinate3D(x=12.34, y=56.78, z=90.12)
    f = Facility(
        id="sup_custom",
        name="Custom Supplier",
        facility_type=FacilityType.SUPPLIER,
        supply_capacity=100.0,
        position=custom_pos,
    )
    scenario = Scenario(
        id="test_custom",
        name="Custom Pos Test",
        description="Testing preservation",
        industry="Test",
        facilities=[f],
        routes=[],
    )

    assign_deterministic_3d_positions(scenario)
    assert scenario.facilities[0].position == custom_pos
