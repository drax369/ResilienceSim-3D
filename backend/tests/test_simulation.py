"""Tests for SimPy discrete-event simulation engine, disruptions, and comparison."""
import copy
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.models.common import FacilityType
from app.models.disruption import Disruption, DisruptionType
from app.models.facility import Facility
from app.models.route import TransportRoute
from app.models.scenario import Scenario
from app.models.simulation import ShipmentStatus, SimulationMode
from app.scenarios.benchmark_scenarios import (
    create_global_electronics_scenario,
    create_pharma_cold_chain_scenario,
)
from app.simulation.comparison import compare_simulations, run_scenario_simulation
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
        description="Hand-calculable 3-node benchmark for verification",
        industry="Test",
        planning_horizon_periods=4,
        period_unit="days",
        facilities=[f_sup, f_dc, f_ret],
        routes=[r_sup_dc, r_dc_ret],
    )


# =========================================================================
# 1. BASELINE ENGINE & INVARIANT VERIFICATION
# =========================================================================

def test_baseline_deterministic_and_repeatable(small_linear_scenario):
    """Verify that identical simulation runs yield exact identical metrics."""
    res1 = run_scenario_simulation(small_linear_scenario, mode=SimulationMode.BASELINE)
    res2 = run_scenario_simulation(small_linear_scenario, mode=SimulationMode.BASELINE)

    assert res1.total_requested_demand == res2.total_requested_demand
    assert res1.total_delivered_units == res2.total_delivered_units
    assert res1.total_transport_cost == res2.total_transport_cost
    assert res1.service_level_pct == res2.service_level_pct
    assert len(res1.shipment_records) == len(res2.shipment_records)


def test_zero_demand_handling(small_linear_scenario):
    """Verify zero demand produces 100% service level without zero-division error."""
    zero_demand_scenario = copy.deepcopy(small_linear_scenario)
    for f in zero_demand_scenario.facilities:
        if f.facility_type == FacilityType.RETAILER:
            f.demand = 0.0

    res = run_scenario_simulation(zero_demand_scenario, mode=SimulationMode.BASELINE)
    assert res.total_requested_demand == 0.0
    assert res.total_delivered_units == 0.0
    assert res.total_unmet_demand == 0.0
    assert res.service_level_pct == 100.0


def test_shipment_lead_time_and_in_transit_boundary(small_linear_scenario):
    """
    Verify shipments in transit at horizon end are marked in_transit and
    NOT counted as delivered.
    """
    # Route with lead time 3 on a 3-period horizon dispatched at t=1 arrives at t=4 > horizon=3
    short_scenario = copy.deepcopy(small_linear_scenario)
    short_scenario.planning_horizon_periods = 2

    res = run_scenario_simulation(short_scenario, mode=SimulationMode.BASELINE)

    # All shipments arriving <= 2 are delivered; any arriving > 2 remain in transit
    for s in res.shipment_records:
        if s.expected_arrival_period <= 2.0:
            assert s.status == ShipmentStatus.DELIVERED
            assert s.actual_arrival_period is not None
        else:
            assert s.status == ShipmentStatus.IN_TRANSIT
            assert s.actual_arrival_period is None

    # Delivered cannot exceed requested demand
    assert res.total_delivered_units <= res.total_requested_demand


def test_inventory_non_negative_invariant():
    """Verify physical inventories never drop below zero in complex benchmark."""
    scenario = create_global_electronics_scenario()
    res = run_scenario_simulation(scenario, mode=SimulationMode.BASELINE)

    for fac_id, snap in res.inventory_snapshots.items():
        for period, qty in snap.items():
            assert qty >= 0.0, f"Facility {fac_id} has negative inventory {qty} at period {period}"


# =========================================================================
# 2. DISRUPTION MECHANICS
# =========================================================================

def test_disruption_route_closure(small_linear_scenario):
    """Closing the delivery route prevents shipments and increases unmet demand."""
    closure = Disruption(
        id="d_close_route",
        disruption_type=DisruptionType.ROUTE_CLOSURE,
        target_id="r_dc_ret",
        start_period=0,
        duration_periods=4,
    )

    baseline = run_scenario_simulation(small_linear_scenario, mode=SimulationMode.BASELINE)
    disrupted = run_scenario_simulation(
        small_linear_scenario, mode=SimulationMode.DISRUPTED, disruptions=[closure]
    )

    # Disrupted delivered units must be 0 because the only route to retailer is closed
    assert baseline.total_delivered_units > 0.0
    assert disrupted.total_delivered_units == 0.0
    assert disrupted.service_level_pct == 0.0
    assert disrupted.total_unmet_demand == disrupted.total_requested_demand


def test_disruption_facility_shutdown(small_linear_scenario):
    """Shutting down the DC prevents dispatching to retailer."""
    shutdown = Disruption(
        id="d_shut_dc",
        disruption_type=DisruptionType.FACILITY_SHUTDOWN,
        target_id="dc_mini",
        start_period=0,
        duration_periods=4,
    )

    disrupted = run_scenario_simulation(
        small_linear_scenario, mode=SimulationMode.DISRUPTED, disruptions=[shutdown]
    )
    assert disrupted.total_delivered_units == 0.0
    assert disrupted.service_level_pct == 0.0


def test_disruption_capacity_reduction(small_linear_scenario):
    """Reducing route capacity throttles delivered quantity."""
    cap_cut = Disruption(
        id="d_cap_cut",
        disruption_type=DisruptionType.CAPACITY_REDUCTION,
        target_id="r_dc_ret",
        magnitude=0.75,  # 75% reduction -> only 25% capacity remaining (30 * 0.25 = 7.5 units/day)
        start_period=0,
    )

    baseline = run_scenario_simulation(small_linear_scenario, mode=SimulationMode.BASELINE)
    disrupted = run_scenario_simulation(
        small_linear_scenario, mode=SimulationMode.DISRUPTED, disruptions=[cap_cut]
    )

    assert disrupted.total_delivered_units < baseline.total_delivered_units
    assert disrupted.service_level_pct < baseline.service_level_pct


def test_disruption_lead_time_increase(small_linear_scenario):
    """Adding transit delays pushes shipment arrivals past horizon."""
    delay = Disruption(
        id="d_delay",
        disruption_type=DisruptionType.LEAD_TIME_INCREASE,
        target_id="r_dc_ret",
        magnitude=3.0,  # +3 days delay -> lead time becomes 4 days
        start_period=0,
    )

    baseline = run_scenario_simulation(small_linear_scenario, mode=SimulationMode.BASELINE)
    disrupted = run_scenario_simulation(
        small_linear_scenario, mode=SimulationMode.DISRUPTED, disruptions=[delay]
    )

    # Delay causes deliveries within 4-day horizon to drop or arrive later
    assert disrupted.shipments_in_transit_count >= baseline.shipments_in_transit_count


def test_disruption_demand_surge(small_linear_scenario):
    """Demand surge increases total requested demand."""
    surge = Disruption(
        id="d_surge",
        disruption_type=DisruptionType.DEMAND_SURGE,
        target_id="ret_mini",
        magnitude=1.5,  # +50% surge
        start_period=0,
    )

    baseline = run_scenario_simulation(small_linear_scenario, mode=SimulationMode.BASELINE)
    disrupted = run_scenario_simulation(
        small_linear_scenario, mode=SimulationMode.DISRUPTED, disruptions=[surge]
    )

    assert disrupted.total_requested_demand == pytest.approx(baseline.total_requested_demand * 1.5)


def test_multiple_simultaneous_disruptions(small_linear_scenario):
    """Verify simultaneous disruptions apply concurrently."""
    d1 = Disruption(
        id="d1",
        disruption_type=DisruptionType.CAPACITY_REDUCTION,
        target_id="r_sup_dc",
        magnitude=0.5,
    )
    d2 = Disruption(
        id="d2",
        disruption_type=DisruptionType.DEMAND_SURGE,
        target_id="ret_mini",
        magnitude=1.2,
    )

    res = run_scenario_simulation(
        small_linear_scenario, mode=SimulationMode.DISRUPTED, disruptions=[d1, d2]
    )
    assert res.total_requested_demand == pytest.approx(small_linear_scenario.facilities[2].demand * 1.2 * 4)


def test_disruptions_do_not_mutate_original_scenario():
    """Verify scenario object is completely unmutated after disrupted simulation."""
    orig = create_global_electronics_scenario()
    orig_copy = copy.deepcopy(orig)

    disruption = Disruption(
        id="d_fac_out",
        disruption_type=DisruptionType.FACILITY_SHUTDOWN,
        target_id="fac_shenzhen",
        start_period=1,
        duration_periods=5,
    )

    _ = run_scenario_simulation(orig, mode=SimulationMode.DISRUPTED, disruptions=[disruption])

    assert orig.model_dump() == orig_copy.model_dump()


# =========================================================================
# 3. COMPARISON SERVICE & API ENDPOINTS
# =========================================================================

def test_compare_simulations_service(small_linear_scenario):
    """Verify comparison deltas between baseline and disrupted."""
    d = Disruption(
        id="d_cut",
        disruption_type=DisruptionType.CAPACITY_REDUCTION,
        target_id="r_dc_ret",
        magnitude=0.5,
    )

    comp = compare_simulations(small_linear_scenario, disruptions=[d])

    assert comp.disruptions_applied_count == 1
    assert comp.baseline.service_level_pct >= comp.disrupted.service_level_pct
    assert comp.deltas.delivered_units_delta <= 0.0
    assert comp.deltas.unmet_demand_delta >= 0.0


def test_api_simulation_run_endpoint():
    """Verify POST /api/simulation/run on global_electronics."""
    payload = {
        "scenario_id": "global_electronics",
        "mode": "baseline",
    }
    response = client.post("/api/simulation/run", json=payload)
    assert response.status_code == 200
    data = response.json()

    assert data["scenario_id"] == "global_electronics"
    assert data["simulation_mode"] == "baseline"
    assert data["total_requested_demand"] > 0
    assert data["total_delivered_units"] > 0
    assert "period_metrics" in data
    assert len(data["period_metrics"]) == 14


def test_api_simulation_compare_endpoint():
    """Verify POST /api/simulation/compare."""
    payload = {
        "scenario_id": "pharma_cold_chain",
        "disruptions": [
            {
                "id": "d_dublin_out",
                "disruption_type": "facility_shutdown",
                "target_id": "fac_dublin",
                "start_period": 2,
                "duration_periods": 7,
            }
        ],
    }
    response = client.post("/api/simulation/compare", json=payload)
    assert response.status_code == 200
    data = response.json()

    assert data["scenario_id"] == "pharma_cold_chain"
    assert data["disruptions_applied_count"] == 1
    assert "baseline" in data
    assert "disrupted" in data
    assert "deltas" in data
    assert data["deltas"]["delivered_units_delta"] <= 0.0


def test_api_simulation_unknown_scenario_returns_404():
    """Verify 404 for unknown scenario ID."""
    payload = {"scenario_id": "non_existent_xyz"}
    res1 = client.post("/api/simulation/run", json=payload)
    assert res1.status_code == 404

    res2 = client.post("/api/simulation/compare", json=payload)
    assert res2.status_code == 404
