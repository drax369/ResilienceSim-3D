"""Scenario and network graph API endpoints."""
from typing import List
from fastapi import APIRouter, HTTPException, Path

from app.core.graph_builder import scenario_to_graph_response
from app.models.graph import GraphResponse
from app.models.scenario import Scenario, ScenarioSummary
from app.scenarios.benchmark_scenarios import get_scenario_library

router = APIRouter(prefix="/scenarios", tags=["Scenarios"])


@router.get(
    "",
    response_model=List[ScenarioSummary],
    summary="List All Benchmark Scenarios",
    description="Returns high-level metadata, facility counts, route counts, and horizon details for available scenarios.",
)
def list_scenarios() -> List[ScenarioSummary]:
    library = get_scenario_library()
    return [scenario.to_summary() for scenario in library.values()]


@router.get(
    "/{scenario_id}",
    response_model=Scenario,
    summary="Get Full Scenario Definition",
    description="Returns the full scenario configuration including all facilities, routes, initial disruptions, and 3D layout coordinates.",
)
def get_scenario(
    scenario_id: str = Path(..., description="Unique scenario identifier (e.g. 'global_electronics')")
) -> Scenario:
    library = get_scenario_library()
    if scenario_id not in library:
        available = ", ".join(repr(k) for k in library.keys())
        raise HTTPException(
            status_code=404,
            detail=f"Scenario '{scenario_id}' not found. Available scenarios: [{available}].",
        )
    return library[scenario_id]


@router.get(
    "/{scenario_id}/graph",
    response_model=GraphResponse,
    summary="Get Scenario Network Graph & Diagnostics",
    description="Returns directed graph nodes, edges, tier groupings, and connectivity diagnostics.",
)
def get_scenario_graph(
    scenario_id: str = Path(..., description="Unique scenario identifier (e.g. 'global_electronics')")
) -> GraphResponse:
    library = get_scenario_library()
    if scenario_id not in library:
        available = ", ".join(repr(k) for k in library.keys())
        raise HTTPException(
            status_code=404,
            detail=f"Scenario '{scenario_id}' not found. Available scenarios: [{available}].",
        )
    scenario = library[scenario_id]
    return scenario_to_graph_response(scenario)
