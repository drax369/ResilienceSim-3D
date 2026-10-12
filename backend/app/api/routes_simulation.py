"""FastAPI route handlers for simulation execution and comparison."""
from fastapi import APIRouter, HTTPException

from app.api.validation import validate_scenario_disruptions
from app.models.simulation import (
    ComparisonRequest,
    ComparisonResult,
    SimulationRequest,
    SimulationResult,
)
from app.scenarios.benchmark_scenarios import get_scenario_library
from app.simulation.comparison import compare_simulations, run_scenario_simulation

router = APIRouter(prefix="/simulation", tags=["Simulation"])


@router.post(
    "/run",
    response_model=SimulationResult,
    summary="Run Discrete-Event Simulation",
    description="Simulates temporal shipment, capacity, inventory, and demand events using SimPy.",
)
def run_simulation(request: SimulationRequest) -> SimulationResult:
    library = get_scenario_library()
    if request.scenario_id not in library:
        available = ", ".join(repr(k) for k in library.keys())
        raise HTTPException(
            status_code=404,
            detail=f"Scenario '{request.scenario_id}' not found. Available scenarios: [{available}].",
        )

    scenario = library[request.scenario_id]
    horizon = request.horizon_periods or scenario.planning_horizon_periods
    if request.disruptions:
        validate_scenario_disruptions(scenario, request.disruptions, horizon)

    result = run_scenario_simulation(
        scenario=scenario,
        mode=request.mode,
        disruptions=request.disruptions,
        horizon_periods=horizon,
        random_seed=request.random_seed or 42,
    )
    return result


@router.post(
    "/compare",
    response_model=ComparisonResult,
    summary="Compare Baseline and Disrupted Simulations",
    description="Runs healthy baseline and counterfactual disrupted simulations and computes delta metrics.",
)
def compare_simulation(request: ComparisonRequest) -> ComparisonResult:
    library = get_scenario_library()
    if request.scenario_id not in library:
        available = ", ".join(repr(k) for k in library.keys())
        raise HTTPException(
            status_code=404,
            detail=f"Scenario '{request.scenario_id}' not found. Available scenarios: [{available}].",
        )

    scenario = library[request.scenario_id]
    horizon = request.horizon_periods or scenario.planning_horizon_periods
    if request.disruptions:
        validate_scenario_disruptions(scenario, request.disruptions, horizon)

    result = compare_simulations(
        scenario=scenario,
        disruptions=request.disruptions,
        horizon_periods=horizon,
        random_seed=request.random_seed or 42,
    )
    return result
