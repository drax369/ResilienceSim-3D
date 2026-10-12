"""Pydantic models for SimPy discrete-event simulation and comparison."""
from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

from app.models.disruption import Disruption


class SimulationMode(str, Enum):
    BASELINE = "baseline"
    DISRUPTED = "disrupted"


class ShipmentStatus(str, Enum):
    DISPATCHED = "dispatched"
    DELIVERED = "delivered"
    IN_TRANSIT = "in_transit"
    BLOCKED = "blocked"


class ShipmentRecord(BaseModel):
    shipment_id: str
    route_id: str
    source_id: str
    target_id: str
    quantity: float = Field(..., ge=0.0)
    dispatch_period: float = Field(..., ge=0.0)
    expected_arrival_period: float = Field(..., ge=0.0)
    actual_arrival_period: Optional[float] = None
    status: ShipmentStatus
    cost: float = Field(..., ge=0.0)


class PeriodMetrics(BaseModel):
    period: int = Field(..., ge=0)
    requested_demand: float = Field(..., ge=0.0)
    delivered_units: float = Field(..., ge=0.0)
    unmet_demand: float = Field(..., ge=0.0)
    service_level_pct: float = Field(..., ge=0.0, le=100.0)
    transport_cost: float = Field(..., ge=0.0)
    shipments_dispatched: int = Field(..., ge=0)
    shipments_delivered: int = Field(..., ge=0)
    active_disruptions: List[str] = Field(default_factory=list)


class DisruptionEventRecord(BaseModel):
    disruption_id: str
    disruption_type: str
    target_id: str
    period: int
    event: str  # "activated", "expired", "impact_applied"
    details: Dict[str, Any] = Field(default_factory=dict)


class SimulationRequest(BaseModel):
    scenario_id: str = Field(..., description="ID of scenario to simulate")
    mode: SimulationMode = Field(
        default=SimulationMode.DISRUPTED,
        description="Simulation mode: baseline (healthy) or disrupted",
    )
    disruptions: List[Disruption] = Field(
        default_factory=list,
        description="List of disruptions to apply (ignored if mode is baseline)",
    )
    horizon_periods: Optional[int] = Field(
        None,
        gt=0,
        description="Optional horizon length override in periods",
    )
    random_seed: Optional[int] = Field(
        42,
        description="Deterministic seed for simulation run",
    )


class SimulationResult(BaseModel):
    scenario_id: str
    simulation_mode: SimulationMode
    planning_horizon_periods: int
    period_unit: str
    total_requested_demand: float = Field(..., ge=0.0)
    total_delivered_units: float = Field(..., ge=0.0)
    total_unmet_demand: float = Field(..., ge=0.0)
    service_level_pct: float = Field(..., ge=0.0, le=100.0)
    total_transport_cost: float = Field(..., ge=0.0)
    shipments_dispatched_count: int = Field(..., ge=0)
    shipments_delivered_count: int = Field(..., ge=0)
    shipments_in_transit_count: int = Field(..., ge=0)
    in_transit_units: float = Field(
        default=0.0,
        ge=0.0,
        description="Total quantity still traveling on routes when horizon concluded",
    )
    period_metrics: List[PeriodMetrics]
    shipment_records: List[ShipmentRecord]
    inventory_snapshots: Dict[str, Dict[int, float]] = Field(
        description="Mapping of facility_id -> {period: inventory_level}"
    )
    disruption_events: List[DisruptionEventRecord] = Field(default_factory=list)
    status: str = "completed"
    warnings: List[str] = Field(default_factory=list)


class SimulationDeltaMetrics(BaseModel):
    delivered_units_delta: float = Field(
        ..., description="disrupted delivered - baseline delivered"
    )
    delivered_units_pct_change: float = Field(
        ..., description="% change in delivered units relative to baseline"
    )
    unmet_demand_delta: float = Field(
        ..., description="disrupted unmet - baseline unmet"
    )
    unmet_demand_pct_change: float = Field(
        ..., description="% change in unmet demand relative to baseline"
    )
    service_level_delta_pct_points: float = Field(
        ..., description="disrupted service level % - baseline service level %"
    )
    transport_cost_delta: float = Field(
        ..., description="disrupted cost - baseline cost"
    )
    transport_cost_pct_change: float = Field(
        ..., description="% change in cost relative to baseline"
    )
    in_transit_units_delta: float = Field(
        ..., description="disrupted in-transit - baseline in-transit"
    )


class ComparisonRequest(BaseModel):
    scenario_id: str
    disruptions: List[Disruption] = Field(
        default_factory=list,
        description="Disruptions to inject into the counterfactual disrupted run",
    )
    horizon_periods: Optional[int] = Field(None, gt=0)
    random_seed: Optional[int] = 42


class ComparisonResult(BaseModel):
    scenario_id: str
    planning_horizon_periods: int
    period_unit: str
    baseline: SimulationResult
    disrupted: SimulationResult
    deltas: SimulationDeltaMetrics
    disruptions_applied_count: int
