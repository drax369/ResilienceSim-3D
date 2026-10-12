"""Simulation comparison service comparing baseline and disrupted outcomes."""
from typing import Any, List, Optional, Tuple

from app.models.disruption import Disruption
from app.models.scenario import Scenario
from app.models.simulation import (
    ComparisonResult,
    SimulationDeltaMetrics,
    SimulationMode,
    SimulationResult,
)
from app.simulation.simpy_engine import SupplyChainSimulationEngine


def run_scenario_simulation(
    scenario: Scenario,
    mode: SimulationMode = SimulationMode.BASELINE,
    disruptions: Optional[List[Disruption]] = None,
    horizon_periods: Optional[int] = None,
    random_seed: int = 42,
    recovery_plan: Optional[Any] = None,
) -> SimulationResult:
    """Executes a single simulation run in the specified mode."""
    engine = SupplyChainSimulationEngine(
        scenario=scenario,
        mode=mode,
        disruptions=disruptions,
        horizon_periods=horizon_periods,
        random_seed=random_seed,
        recovery_plan=recovery_plan,
    )
    return engine.run()




def compare_simulations(
    scenario: Scenario,
    disruptions: Optional[List[Disruption]] = None,
    horizon_periods: Optional[int] = None,
    random_seed: int = 42,
) -> ComparisonResult:
    """
    Executes baseline and counterfactual disrupted simulations on identical scenario
    conditions and derives relative and absolute delta metrics.
    """
    applied_disruptions = disruptions or scenario.initial_disruptions

    # 1. Run healthy baseline
    baseline_result = run_scenario_simulation(
        scenario=scenario,
        mode=SimulationMode.BASELINE,
        disruptions=[],
        horizon_periods=horizon_periods,
        random_seed=random_seed,
    )

    # 2. Run counterfactual disrupted
    disrupted_result = run_scenario_simulation(
        scenario=scenario,
        mode=SimulationMode.DISRUPTED,
        disruptions=applied_disruptions,
        horizon_periods=horizon_periods,
        random_seed=random_seed,
    )

    # 3. Calculate metrics safely without division-by-zero errors
    def calc_pct_change(old_val: float, new_val: float) -> float:
        if old_val == 0.0:
            return 0.0 if new_val == 0.0 else 100.0
        return round(((new_val - old_val) / old_val) * 100.0, 2)

    delivered_delta = disrupted_result.total_delivered_units - baseline_result.total_delivered_units
    delivered_pct = calc_pct_change(
        baseline_result.total_delivered_units, disrupted_result.total_delivered_units
    )

    unmet_delta = disrupted_result.total_unmet_demand - baseline_result.total_unmet_demand
    unmet_pct = calc_pct_change(
        baseline_result.total_unmet_demand, disrupted_result.total_unmet_demand
    )

    sla_delta_pts = round(
        disrupted_result.service_level_pct - baseline_result.service_level_pct, 2
    )

    cost_delta = disrupted_result.total_transport_cost - baseline_result.total_transport_cost
    cost_pct = calc_pct_change(
        baseline_result.total_transport_cost, disrupted_result.total_transport_cost
    )

    in_transit_delta = disrupted_result.in_transit_units - baseline_result.in_transit_units

    deltas = SimulationDeltaMetrics(
        delivered_units_delta=round(delivered_delta, 3),
        delivered_units_pct_change=delivered_pct,
        unmet_demand_delta=round(unmet_delta, 3),
        unmet_demand_pct_change=unmet_pct,
        service_level_delta_pct_points=sla_delta_pts,
        transport_cost_delta=round(cost_delta, 2),
        transport_cost_pct_change=cost_pct,
        in_transit_units_delta=round(in_transit_delta, 3),
    )

    return ComparisonResult(
        scenario_id=scenario.id,
        planning_horizon_periods=baseline_result.planning_horizon_periods,
        period_unit=scenario.period_unit,
        baseline=baseline_result,
        disrupted=disrupted_result,
        deltas=deltas,
        disruptions_applied_count=len(applied_disruptions),
    )
