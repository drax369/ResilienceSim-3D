"""FastAPI route handlers for Google OR-Tools recovery optimization."""
from fastapi import APIRouter, HTTPException

from app.api.validation import validate_scenario_disruptions
from app.models.optimization import (
    OptimizationRecoveryResponse,
    OptimizationRequest,
)
from app.optimization.recovery_service import execute_recovery_optimization
from app.scenarios.benchmark_scenarios import get_scenario_library

router = APIRouter(prefix="/optimization", tags=["Optimization"])


@router.post(
    "/recover",
    response_model=OptimizationRecoveryResponse,
    summary="Optimize Supply Chain Recovery Plan",
    description="Formulates and solves a constrained recovery problem with Google OR-Tools, re-simulates in SimPy, and returns 3-way evaluation.",
)
def recover_supply_chain(request: OptimizationRequest) -> OptimizationRecoveryResponse:
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

    result = execute_recovery_optimization(scenario=scenario, request=request)
    return result
