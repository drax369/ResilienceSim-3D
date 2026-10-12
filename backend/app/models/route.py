"""Transport route domain model."""
from typing import Any, Dict, Optional
from pydantic import BaseModel, Field, field_validator, model_validator

from app.models.common import RouteStatus


class TransportRoute(BaseModel):
    id: str = Field(..., min_length=1, description="Unique route identifier")
    source_id: str = Field(..., min_length=1, description="Origin facility ID")
    target_id: str = Field(..., min_length=1, description="Destination facility ID")
    capacity: float = Field(
        ...,
        ge=0.0,
        description="Maximum transport shipment capacity per planning period",
    )
    lead_time_periods: float = Field(
        ...,
        gt=0.0,
        description="Positive transit duration in planning periods",
    )
    cost_per_unit: float = Field(
        ...,
        ge=0.0,
        description="Transportation cost per physical unit moved along route",
    )
    status: RouteStatus = Field(
        default=RouteStatus.ACTIVE,
        description="Current operational status of route lane",
    )
    distance_km: Optional[float] = Field(
        None,
        ge=0.0,
        description="Physical transport distance in kilometers",
    )
    metadata: Dict[str, Any] = Field(
        default_factory=dict,
        description="Additional route characteristics (e.g. carrier, modal type)",
    )

    @field_validator("id", "source_id", "target_id")
    @classmethod
    def validate_non_empty(cls, v: str) -> str:
        trimmed = v.strip()
        if not trimmed:
            raise ValueError("ID fields cannot be empty or whitespace only")
        return trimmed

    @model_validator(mode="after")
    def reject_self_loops(self) -> "TransportRoute":
        if self.source_id == self.target_id:
            raise ValueError(
                f"Self-loop detected on route '{self.id}': source '{self.source_id}' "
                f"matches target '{self.target_id}'."
            )
        return self
