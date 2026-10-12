"""Recovery orchestration service coordinating optimization and SimPy re-simulation."""
from typing import List, Optional

from app.models.disruption import Disruption
from app.models.optimization import (
    OptimizationRecoveryResponse,
    OptimizationRequest,
    OptimizationSolverStatus,
    RecoveryPlan,
)
from app.models.scenario import Scenario
from app.models.simulation import (
    SimulationDeltaMetrics,
    SimulationMode,
    SimulationResult,
)
from app.optimization.recovery_optimizer import SupplyChainRecoveryOptimizer
from app.simulation.simpy_engine import SupplyChainSimulationEngine


def _calculate_deltas(from_res: SimulationResult, to_res: SimulationResult) -> SimulationDeltaMetrics:
    """Calculates relative and absolute metrics changes safely without zero-division."""
    def calc_pct(old_val: float, new_val: float) -> float:
        if old_val == 0.0:
            return 0.0 if new_val == 0.0 else 100.0
        return round(((new_val - old_val) / old_val) * 100.0, 2)

    deliv_delta = to_res.total_delivered_units - from_res.total_delivered_units
    deliv_pct = calc_pct(from_res.total_delivered_units, to_res.total_delivered_units)

    unmet_delta = to_res.total_unmet_demand - from_res.total_unmet_demand
    unmet_pct = calc_pct(from_res.total_unmet_demand, to_res.total_unmet_demand)

    sla_delta_pts = round(to_res.service_level_pct - from_res.service_level_pct, 2)

    cost_delta = to_res.total_transport_cost - from_res.total_transport_cost
    cost_pct = calc_pct(from_res.total_transport_cost, to_res.total_transport_cost)

    in_transit_delta = to_res.in_transit_units - from_res.in_transit_units

    return SimulationDeltaMetrics(
        delivered_units_delta=round(deliv_delta, 3),
        delivered_units_pct_change=deliv_pct,
        unmet_demand_delta=round(unmet_delta, 3),
        unmet_demand_pct_change=unmet_pct,
        service_level_delta_pct_points=sla_delta_pts,
        transport_cost_delta=round(cost_delta, 2),
        transport_cost_pct_change=cost_pct,
        in_transit_units_delta=round(in_transit_delta, 3),
    )


def execute_recovery_optimization(
    scenario: Scenario,
    request: OptimizationRequest,
) -> OptimizationRecoveryResponse:
    """
    Executes the full recovery cycle:
    1. Baseline SimPy run (healthy).
    2. Disrupted SimPy run (unmitigated).
    3. Google OR-Tools constrained recovery optimization.
    4. Recovered SimPy run enforcing optimizer-guided dispatches.
    5. Delta metrics calculation across all three states.
    """
    horizon = request.horizon_periods or scenario.planning_horizon_periods
    applied_disruptions = request.disruptions or scenario.initial_disruptions

    # Step 1: Run healthy baseline simulation
    baseline_engine = SupplyChainSimulationEngine(
        scenario=scenario,
        mode=SimulationMode.BASELINE,
        disruptions=[],
        horizon_periods=horizon,
        random_seed=request.random_seed or 42,
    )
    baseline_result = baseline_engine.run()

    # Step 2: Run unmitigated disrupted simulation
    disrupted_engine = SupplyChainSimulationEngine(
        scenario=scenario,
        mode=SimulationMode.DISRUPTED,
        disruptions=applied_disruptions,
        horizon_periods=horizon,
        random_seed=request.random_seed or 42,
    )
    disrupted_result = disrupted_engine.run()

    # Calculate baseline -> disrupted deltas
    b_to_d_deltas = _calculate_deltas(baseline_result, disrupted_result)

    # Step 3: Run Google OR-Tools Constrained Recovery Optimizer
    optimizer = SupplyChainRecoveryOptimizer(
        scenario=scenario,
        disruptions=applied_disruptions,
        horizon_periods=horizon,
        shortage_penalty=request.shortage_penalty_per_unit,
        solver_name="GLOP",
    )
    plan, recovery_actions, obj_val, solver_status, is_feasible, runtime_ms, bottlenecks = optimizer.solve()

    # Step 4: Run Recovered Simulation if feasible
    recovered_result: Optional[SimulationResult] = None
    d_to_r_deltas: Optional[SimulationDeltaMetrics] = None
    b_to_r_deltas: Optional[SimulationDeltaMetrics] = None
    execution_deviations = []
    warnings: List[str] = []

    if is_feasible:
        recovered_engine = SupplyChainSimulationEngine(
            scenario=scenario,
            mode=SimulationMode.DISRUPTED,
            disruptions=applied_disruptions,
            horizon_periods=horizon,
            random_seed=request.random_seed or 42,
            recovery_plan=plan,
        )
        recovered_result = recovered_engine.run()
        execution_deviations = recovered_engine.execution_deviations

        d_to_r_deltas = _calculate_deltas(disrupted_result, recovered_result)
        b_to_r_deltas = _calculate_deltas(baseline_result, recovered_result)

        if execution_deviations:
            warnings.append(
                f"Recovered simulation encountered {len(execution_deviations)} execution deviations from proposed plan due to physical capacity bounds."
            )
    else:
        warnings.append(
            f"Recovery optimization returned status '{solver_status.value}'. No feasible recovery plan could be applied."
        )

    return OptimizationRecoveryResponse(
        scenario_id=scenario.id,
        planning_horizon_periods=horizon,
        period_unit=scenario.period_unit,
        solver_name="Google OR-Tools (GLOP)",
        solver_status=solver_status,
        is_feasible=is_feasible,
        objective_value=round(obj_val, 2),
        solve_runtime_ms=round(runtime_ms, 2),
        recovery_plan=plan,
        recovery_actions=recovery_actions,
        execution_deviations=execution_deviations,
        baseline=baseline_result,
        disrupted=disrupted_result,
        recovered=recovered_result,
        baseline_to_disrupted=b_to_d_deltas,
        disrupted_to_recovered=d_to_r_deltas,
        baseline_to_recovered=b_to_r_deltas,
        bottlenecks_and_shortages=bottlenecks,
        warnings=warnings,
    )
