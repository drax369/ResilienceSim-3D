"""Disruption domain models and validation."""
from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field, field_validator, model_validator


class DisruptionType(str, Enum):
    FACILITY_SHUTDOWN = "facility_shutdown"
    ROUTE_CLOSURE = "route_closure"
    CAPACITY_REDUCTION = "capacity_reduction"
    LEAD_TIME_INCREASE = "lead_time_increase"
    DEMAND_SURGE = "demand_surge"


class Disruption(BaseModel):
    id: str = Field(..., min_length=1, description="Unique disruption identifier")
    disruption_type: DisruptionType = Field(..., description="Category of disruption event")
    target_id: str = Field(..., min_length=1, description="Affected facility ID or route ID")
    magnitude: float = Field(
        default=1.0,
        description=(
            "Magnitude parameter: capacity_reduction in [0.0, 1.0], "
            "lead_time_increase > 0.0 (added periods), demand_surge >= 1.0 (multiplier), "
            "facility_shutdown / route_closure = 1.0"
        ),
    )
    start_period: int = Field(
        default=0,
        ge=0,
        description="Planning period index when disruption becomes active",
    )
    duration_periods: Optional[int] = Field(
        None,
        gt=0,
        description="Duration in planning periods. None implies persistence for remainder of horizon.",
    )
    description: Optional[str] = Field(
        None,
        description="Human-readable scenario context explaining the disruption event",
    )

    @field_validator("id", "target_id")
    @classmethod
    def validate_non_empty(cls, v: str) -> str:
        trimmed = v.strip()
        if not trimmed:
            raise ValueError("ID fields cannot be empty or whitespace only")
        return trimmed

    @model_validator(mode="after")
    def validate_magnitude_by_type(self) -> "Disruption":
        t = self.disruption_type
        m = self.magnitude

        if t == DisruptionType.CAPACITY_REDUCTION:
            if not (0.0 <= m <= 1.0):
                raise ValueError(
                    f"Disruption '{self.id}': capacity_reduction magnitude must be a fraction "
                    f"between 0.0 and 1.0 (got {m})."
                )
        elif t == DisruptionType.LEAD_TIME_INCREASE:
            if m <= 0.0:
                raise ValueError(
                    f"Disruption '{self.id}': lead_time_increase magnitude must be positive (got {m})."
                )
        elif t == DisruptionType.DEMAND_SURGE:
            if m < 1.0:
                raise ValueError(
                    f"Disruption '{self.id}': demand_surge magnitude must be a multiplier >= 1.0 (got {m})."
                )
        elif t in (DisruptionType.FACILITY_SHUTDOWN, DisruptionType.ROUTE_CLOSURE):
            if m <= 0.0:
                raise ValueError(
                    f"Disruption '{self.id}': shutdown/closure magnitude must be positive (typically 1.0, got {m})."
                )

        return self
