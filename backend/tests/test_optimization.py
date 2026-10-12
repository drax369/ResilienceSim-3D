"""Tests for Google OR-Tools recovery optimization engine, service, and API."""
import copy
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.models.common import FacilityType
from app.models.disruption import Disruption, DisruptionType
from app.models.facility import Facility
from app.models.optimization import (
    OptimizationRecoveryResponse,
    OptimizationRequest,
    OptimizationSolverStatus,
    RecoveryPlan,
)
from app.models.route import TransportRoute
from app.models.scenario import Scenario
from app.models.simulation import SimulationMode
from app.optimization.recovery_optimizer import SupplyChainRecoveryOptimizer
from app.optimization.recovery_service import execute_recovery_optimization
from app.simulation.simpy_engine import SupplyChainSimulationEngine

client = TestClient(app)


@pytest.fixture
def small_linear_scenario() -> Scenario:
    """Hand-calculable 3-node supply chain fixture."""
    f_sup = Facility(
        id="sup_mini",
        name="Mini Supplier",
        facility_type=FacilityType.SUPPLIER,
        supply_capacity=60.0,
    )
    f_dc = Facility(
        id="dc_mini",
        name="Mini DC",
        facility_type=FacilityType.DISTRIBUTION_CENTER,
        processing_capacity=50.0,
        inventory=40.0,  # initial stock
    )
    f_ret = Facility(
        id="ret_mini",
        name="Mini Retailer",
        facility_type=FacilityType.RETAILER,
        demand=20.0,  # daily demand
    )

    r_sup_dc = TransportRoute(
        id="r_sup_dc",
        source_id="sup_mini",
        target_id="dc_mini",
        capacity=50.0,
        lead_time_periods=2.0,
        cost_per_unit=2.0,
    )
    r_dc_ret = TransportRoute(
        id="r_dc_ret",
        source_id="dc_mini",
        target_id="ret_mini",
        capacity=30.0,
        lead_time_periods=1.0,
        cost_per_unit=1.5,
    )

    return Scenario(
        id="small_linear",
        name="Small Linear Network",
        description="Hand-calculable 3-node benchmark for optimization verification",
        industry="Test",
        planning_horizon_periods=4,
        period_unit="days",
        facilities=[f_sup, f_dc, f_ret],
        routes=[r_sup_dc, r_dc_ret],
    )


@pytest.fixture
def dual_route_scenario() -> Scenario:
    """Network with primary cheap route and backup expensive route to test rerouting."""
    f_sup_cheap = Facility(
        id="sup_cheap",
        name="Primary Cheap Supplier",
        facility_type=FacilityType.SUPPLIER,
        supply_capacity=50.0,
    )
    f_sup_alt = Facility(
        id="sup_alt",
        name="Backup Expensive Supplier",
        facility_type=FacilityType.SUPPLIER,
        supply_capacity=50.0,
    )
    f_dc = Facility(
        id="dc_node",
        name="Central DC",
        facility_type=FacilityType.DISTRIBUTION_CENTER,
        processing_capacity=50.0,
        inventory=10.0,
    )
    f_ret = Facility(
        id="ret_node",
        name="Retailer Node",
        facility_type=FacilityType.RETAILER,
        demand=20.0,
    )

    r_cheap = TransportRoute(
        id="r_cheap",
        source_id="sup_cheap",
        target_id="dc_node",
        capacity=30.0,
        lead_time_periods=1.0,
        cost_per_unit=2.0,
    )
    r_alt = TransportRoute(
        id="r_alt",
        source_id="sup_alt",
        target_id="dc_node",
        capacity=30.0,
        lead_time_periods=1.0,
        cost_per_unit=8.0,  # higher cost
    )
    r_to_ret = TransportRoute(
        id="r_to_ret",
        source_id="dc_node",
        target_id="ret_node",
        capacity=30.0,
        lead_time_periods=1.0,
        cost_per_unit=1.0,
    )

    return Scenario(
        id="dual_route",
        name="Dual Route Benchmark",
        description="Dual supplier network to verify rerouting decisions",
        industry="Test",
        planning_horizon_periods=4,
        period_unit="days",
        facilities=[f_sup_cheap, f_sup_alt, f_dc, f_ret],
        routes=[r_cheap, r_alt, r_to_ret],
    )


# =========================================================================
# 1. OPTIMIZER SOLVER UNIT TESTS
# =========================================================================

def test_optimizer_hand_calculable_small_network(small_linear_scenario):
    """Verify OR-Tools finds an optimal or feasible recovery plan on healthy network."""
    optimizer = SupplyChainRecoveryOptimizer(small_linear_scenario)
    plan, actions, obj, status, is_feasible, runtime_ms, bottlenecks = optimizer.solve()

    assert is_feasible is True
    assert status in (OptimizationSolverStatus.OPTIMAL, OptimizationSolverStatus.FEASIBLE)
    assert runtime_ms > 0.0
    assert len(plan.decisions) > 0
    assert plan.total_planned_dispatches > 0.0
    assert plan.total_planned_transport_cost > 0.0
    assert obj >= 0.0


def test_closed_route_receives_zero_flow(small_linear_scenario):
    """When a route is completely closed by disruption, optimizer assigns exactly 0 dispatches."""
    route_disruption = Disruption(
        id="disr_r_sup_dc",
        disruption_type=DisruptionType.ROUTE_CLOSURE,
        target_id="r_sup_dc",
        magnitude=1.0,
        start_period=0,
        duration_periods=4,
        description="Route Closure",
    )

    optimizer = SupplyChainRecoveryOptimizer(
        small_linear_scenario, disruptions=[route_disruption]
    )
    plan, actions, obj, status, is_feasible, runtime_ms, bottlenecks = optimizer.solve()

    assert is_feasible is True
    # Verify no flow is scheduled on the closed route
    closed_dispatches = [
        d for d in plan.decisions if d.route_id == "r_sup_dc" and d.period in (0, 1, 2, 3)
    ]
    for d in closed_dispatches:
        assert d.planned_quantity == 0.0


def test_facility_shutdown_respected_by_optimizer(small_linear_scenario):
    """When a facility is shut down, outbound flow and processing capacity drop to zero."""
    dc_shutdown = Disruption(
        id="disr_dc_shutdown",
        disruption_type=DisruptionType.FACILITY_SHUTDOWN,
        target_id="dc_mini",
        magnitude=1.0,
        start_period=0,
        duration_periods=4,
        description="DC Fire Shutdown",
    )

    optimizer = SupplyChainRecoveryOptimizer(
        small_linear_scenario, disruptions=[dc_shutdown]
    )
    plan, actions, obj, status, is_feasible, runtime_ms, bottlenecks = optimizer.solve()

    assert is_feasible is True
    # Outbound dispatches from dc_mini must be 0
    outbound_from_dc = [
        d for d in plan.decisions if d.route_id == "r_dc_ret" and d.period in (0, 1, 2, 3)
    ]
    for d in outbound_from_dc:
        assert d.planned_quantity == 0.0


def test_capacity_reduction_respected_by_optimizer(small_linear_scenario):
    """When route capacity is reduced by 60%, planned dispatches never exceed 40% capacity."""
    # r_sup_dc capacity = 50.0. 60% impact -> cap mult = 0.4 -> cap = 20.0
    cap_reduction = Disruption(
        id="disr_cap_cut",
        disruption_type=DisruptionType.CAPACITY_REDUCTION,
        target_id="r_sup_dc",
        magnitude=0.6,
        start_period=0,
        duration_periods=4,
        description="Port Congestion 60% Cut",
    )

    optimizer = SupplyChainRecoveryOptimizer(
        small_linear_scenario, disruptions=[cap_reduction]
    )
    plan, actions, obj, status, is_feasible, runtime_ms, bottlenecks = optimizer.solve()

    assert is_feasible is True
    dispatches = [d for d in plan.decisions if d.route_id == "r_sup_dc"]
    for d in dispatches:
        assert d.planned_dispatch_quantity <= 20.001


def test_unavoidable_shortage_handling_without_crash(small_linear_scenario):
    """Excessive demand that cannot physically be met does not cause INFEASIBLE crash; penalizes shortages."""
    stress_scenario = copy.deepcopy(small_linear_scenario)
    for f in stress_scenario.facilities:
        if f.id == "ret_mini":
            f.demand = 500.0  # Far exceeds 60 supply capacity

    optimizer = SupplyChainRecoveryOptimizer(
        stress_scenario, shortage_penalty=2000.0
    )
    plan, actions, obj, status, is_feasible, runtime_ms, bottlenecks = optimizer.solve()

    assert is_feasible is True
    assert status in (OptimizationSolverStatus.OPTIMAL, OptimizationSolverStatus.FEASIBLE)
    # Objective must account for heavy shortage penalties
    assert obj > 1000.0
    assert len(bottlenecks) > 0


def test_optimizer_reroutes_around_disrupted_route(dual_route_scenario):
    """When the cheap route is cut, optimizer reroutes volume through the alternative backup route."""
    cut_cheap = Disruption(
        id="disr_cheap_cut",
        disruption_type=DisruptionType.ROUTE_CLOSURE,
        target_id="r_cheap",
        magnitude=1.0,
        start_period=0,
        duration_periods=4,
        description="Sever Cheap Route",
    )

    optimizer = SupplyChainRecoveryOptimizer(
        dual_route_scenario, disruptions=[cut_cheap]
    )
    plan, actions, obj, status, is_feasible, runtime_ms, bottlenecks = optimizer.solve()

    assert is_feasible is True
    # Flow on r_cheap must be 0
    cheap_dispatches = [d for d in plan.decisions if d.route_id == "r_cheap"]
    for d in cheap_dispatches:
        assert d.planned_dispatch_quantity == 0.0

    # Flow on r_alt must be positive (rerouted)
    alt_dispatches = [d for d in plan.decisions if d.route_id == "r_alt"]
    total_alt_flow = sum(d.planned_dispatch_quantity for d in alt_dispatches)
    assert total_alt_flow > 0.0

    # Rerouting action logged
    action_types = [a.action_type for a in actions]
    assert any("REROUTE" in a or "CAPACITY" in a for a in action_types)


# =========================================================================
# 2. SIMPY ENGINE RECOVERY PLAN EXECUTION
# =========================================================================

def test_simpy_executes_recovery_plan(small_linear_scenario):
    """SimPy simulation ingests the recovery plan and enforces planned quantities."""
    optimizer = SupplyChainRecoveryOptimizer(small_linear_scenario)
    plan, _, _, _, is_feasible, _, _ = optimizer.solve()
    assert is_feasible is True

    engine = SupplyChainSimulationEngine(
        scenario=small_linear_scenario,
        mode=SimulationMode.DISRUPTED,
        disruptions=[],
        recovery_plan=plan,
    )
    result = engine.run()

    assert result.total_delivered_units > 0.0
    assert len(result.shipment_records) > 0
    # No deviations should occur on unconstrained scenario
    assert len(engine.execution_deviations) == 0


# =========================================================================
# 3. ORCHESTRATION SERVICE & 3-WAY COMPARISON
# =========================================================================

def test_execute_recovery_optimization_service(small_linear_scenario):
    """Orchestration service runs Baseline, Disrupted, and Recovered states consistently."""
    cut_sup = Disruption(
        id="disr_sup",
        disruption_type=DisruptionType.CAPACITY_REDUCTION,
        target_id="r_sup_dc",
        magnitude=0.5,
        start_period=0,
        duration_periods=4,
        description="Supplier 50% Reduction",
    )

    req = OptimizationRequest(
        scenario_id=small_linear_scenario.id,
        disruptions=[cut_sup],
        horizon_periods=4,
    )

    response = execute_recovery_optimization(scenario=small_linear_scenario, request=req)

    assert response.is_feasible is True
    assert response.baseline is not None
    assert response.disrupted is not None
    assert response.recovered is not None
    assert response.baseline_to_disrupted is not None
    assert response.disrupted_to_recovered is not None
    assert response.baseline_to_recovered is not None
    assert response.recovery_plan is not None
    assert response.solve_runtime_ms > 0.0


# =========================================================================
# 4. FASTAPI ROUTE ENDPOINTS
# =========================================================================

def test_api_optimize_recover_global_electronics():
    """Verify POST /api/v1/optimization/recover on global_electronics scenario."""
    payload = {
        "scenario_id": "global_electronics",
        "horizon_periods": 30,
        "disruptions": [
            {
                "id": "test_disr_1",
                "name": "Taiwan Strait Shipping Halt",
                "target_id": "r_taiwan_shenzhen",
                "target_type": "route",
                "disruption_type": "route_closure",
                "start_period": 3,
                "duration_periods": 7,
                "severity": "critical",
                "capacity_impact": 1.0,
            }
        ],
    }

    response = client.post("/api/optimization/recover", json=payload)
    assert response.status_code == 200

    data = response.json()
    assert data["scenario_id"] == "global_electronics"
    assert data["is_feasible"] is True
    assert data["solver_status"] in ("optimal", "feasible")
    assert data["baseline"]["total_requested_demand"] > 0.0
    assert data["disrupted"]["total_requested_demand"] > 0.0
    assert data["recovered"]["total_requested_demand"] > 0.0
    assert data["recovery_plan"]["total_planned_dispatches"] > 0.0
    assert len(data["recovery_actions"]) > 0


def test_api_optimize_recover_pharma_cold_chain():
    """Verify POST /api/v1/optimization/recover on pharma_cold_chain scenario."""
    payload = {
        "scenario_id": "pharma_cold_chain",
        "horizon_periods": 30,
        "disruptions": [
            {
                "id": "test_disr_pharma",
                "name": "Cold Storage Outage",
                "target_id": "dc_frankfurt_cold",
                "target_type": "facility",
                "disruption_type": "facility_shutdown",
                "start_period": 5,
                "duration_periods": 5,
                "severity": "critical",
                "capacity_impact": 1.0,
            }
        ],
    }

    response = client.post("/api/optimization/recover", json=payload)
    assert response.status_code == 200

    data = response.json()
    assert data["scenario_id"] == "pharma_cold_chain"
    assert data["is_feasible"] is True
    assert data["recovered"] is not None


def test_api_optimize_recover_scenario_not_found():
    """Verify POST /api/v1/optimization/recover returns 404 for nonexistent scenario."""
    payload = {
        "scenario_id": "nonexistent_space_supply_chain",
    }
    response = client.post("/api/optimization/recover", json=payload)
    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()
