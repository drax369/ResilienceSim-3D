"""Scenario domain model and scenario-level consistency validation."""
from typing import Any, Dict, List, Set
from pydantic import BaseModel, Field, model_validator

from app.models.disruption import Disruption
from app.models.facility import Facility
from app.models.route import TransportRoute


class ScenarioSummary(BaseModel):
    id: str = Field(..., description="Scenario identifier")
    name: str = Field(..., description="Human-readable scenario title")
    description: str = Field(..., description="Operational overview of the scenario")
    industry: str = Field(..., description="Supply chain industry vertical")
    node_count: int = Field(..., ge=0, description="Total number of facilities")
    route_count: int = Field(..., ge=0, description="Total number of transport lanes")
    planning_horizon_periods: int = Field(..., gt=0, description="Planning duration in periods")
    period_unit: str = Field(..., description="Time unit (e.g. days, hours)")
    total_supply_capacity: float = Field(..., ge=0.0, description="Sum of all supplier capacities")
    total_demand: float = Field(..., ge=0.0, description="Sum of all retailer customer demands")


class Scenario(BaseModel):
    id: str = Field(..., min_length=1, description="Unique scenario identifier")
    name: str = Field(..., min_length=1, description="Scenario title")
    description: str = Field(..., description="Operational background and context")
    industry: str = Field(..., description="Industry domain")
    planning_horizon_periods: int = Field(
        default=14,
        gt=0,
        description="Horizon length in discrete planning periods",
    )
    period_unit: str = Field(
        default="days",
        description="Unit of each discrete period (e.g., 'days', 'hours')",
    )
    facilities: List[Facility] = Field(
        ...,
        min_length=1,
        description="List of facilities / nodes comprising the network",
    )
    routes: List[TransportRoute] = Field(
        ...,
        description="List of directed transportation routes between facilities",
    )
    initial_disruptions: List[Disruption] = Field(
        default_factory=list,
        description="Optional pre-configured disruption scenarios",
    )
    metadata: Dict[str, Any] = Field(
        default_factory=dict,
        description="Arbitrary scenario parameters and domain notes",
    )

    @model_validator(mode="after")
    def validate_scenario_integrity(self) -> "Scenario":
        # 1. Unique Facility IDs
        facility_ids: Set[str] = set()
        for fac in self.facilities:
            if fac.id in facility_ids:
                raise ValueError(
                    f"Scenario '{self.id}' contains duplicate facility ID: '{fac.id}'."
                )
            facility_ids.add(fac.id)

        # 2. Unique Route IDs & Valid Endpoints
        route_ids: Set[str] = set()
        seen_directed_edges: Set[tuple] = set()

        for r in self.routes:
            if r.id in route_ids:
                raise ValueError(
                    f"Scenario '{self.id}' contains duplicate route ID: '{r.id}'."
                )
            route_ids.add(r.id)

            if r.source_id not in facility_ids:
                raise ValueError(
                    f"Route '{r.id}' specifies unknown source facility ID: '{r.source_id}'."
                )

            if r.target_id not in facility_ids:
                raise ValueError(
                    f"Route '{r.id}' specifies unknown target facility ID: '{r.target_id}'."
                )

            edge_key = (r.source_id, r.target_id)
            if edge_key in seen_directed_edges:
                raise ValueError(
                    f"Duplicate directed route lane between '{r.source_id}' and '{r.target_id}' "
                    f"in route '{r.id}'. Parallel edges must be combined into one lane or distinctly handled."
                )
            seen_directed_edges.add(edge_key)

        # 3. Disruption targets must exist (either facility or route)
        valid_targets = facility_ids | route_ids
        for d in self.initial_disruptions:
            if d.target_id not in valid_targets:
                raise ValueError(
                    f"Disruption '{d.id}' specifies non-existent target ID: '{d.target_id}'."
                )

        return self

    def to_summary(self) -> ScenarioSummary:
        from app.models.common import FacilityType

        total_supply = sum(
            f.supply_capacity for f in self.facilities if f.facility_type == FacilityType.SUPPLIER
        )
        total_demand = sum(
            f.demand for f in self.facilities if f.facility_type == FacilityType.RETAILER
        )
        return ScenarioSummary(
            id=self.id,
            name=self.name,
            description=self.description,
            industry=self.industry,
            node_count=len(self.facilities),
            route_count=len(self.routes),
            planning_horizon_periods=self.planning_horizon_periods,
            period_unit=self.period_unit,
            total_supply_capacity=total_supply,
            total_demand=total_demand,
        )
