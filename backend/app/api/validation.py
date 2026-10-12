"""Validation helpers for API request payloads."""
from typing import List
from fastapi import HTTPException

from app.models.common import FacilityType
from app.models.disruption import Disruption, DisruptionType
from app.models.scenario import Scenario


def validate_scenario_disruptions(
    scenario: Scenario,
    disruptions: List[Disruption],
    horizon_periods: int,
) -> None:
    """
    Validates that each disruption specifies a valid target entity within the scenario,
    valid temporal ranges, and logical disruption categories.
    Raises HTTPException(status_code=400) if validation fails.
    """
    facility_map = {f.id: f for f in scenario.facilities}
    route_map = {r.id: r for r in scenario.routes}

    for d in disruptions:
        # Check start period
        if d.start_period < 0:
            raise HTTPException(
                status_code=400,
                detail=f"Disruption '{d.id}': start_period must be >= 0 (got {d.start_period}).",
            )
        if d.start_period >= horizon_periods:
            raise HTTPException(
                status_code=400,
                detail=f"Disruption '{d.id}': start_period ({d.start_period}) exceeds planning horizon ({horizon_periods} periods).",
            )
        if d.duration_periods is not None and d.duration_periods <= 0:
            raise HTTPException(
                status_code=400,
                detail=f"Disruption '{d.id}': duration_periods must be > 0 (got {d.duration_periods}).",
            )

        # Check target entity by disruption type
        if d.disruption_type == DisruptionType.FACILITY_SHUTDOWN:
            if d.target_id not in facility_map:
                raise HTTPException(
                    status_code=400,
                    detail=f"Disruption '{d.id}': facility_shutdown target '{d.target_id}' not found in scenario '{scenario.id}' facilities.",
                )
        elif d.disruption_type == DisruptionType.DEMAND_SURGE:
            if d.target_id not in facility_map:
                raise HTTPException(
                    status_code=400,
                    detail=f"Disruption '{d.id}': demand_surge target '{d.target_id}' not found in scenario '{scenario.id}'.",
                )
            target_fac = facility_map[d.target_id]
            if target_fac.facility_type != FacilityType.RETAILER:
                raise HTTPException(
                    status_code=400,
                    detail=f"Disruption '{d.id}': demand_surge target '{d.target_id}' is a '{target_fac.facility_type.value}', not a retailer demand node.",
                )
        elif d.disruption_type in (DisruptionType.ROUTE_CLOSURE, DisruptionType.LEAD_TIME_INCREASE):
            if d.target_id not in route_map:
                raise HTTPException(
                    status_code=400,
                    detail=f"Disruption '{d.id}': {d.disruption_type.value} target '{d.target_id}' not found in scenario '{scenario.id}' routes.",
                )
        elif d.disruption_type == DisruptionType.CAPACITY_REDUCTION:
            if d.target_id not in facility_map and d.target_id not in route_map:
                raise HTTPException(
                    status_code=400,
                    detail=f"Disruption '{d.id}': capacity_reduction target '{d.target_id}' not found in scenario '{scenario.id}' facilities or routes.",
                )
