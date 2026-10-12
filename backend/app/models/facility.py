"""Facility / Node domain model."""
from typing import Any, Dict, Optional
from pydantic import BaseModel, Field, field_validator

from app.models.common import Coordinate3D, FacilityType, OperationalStatus


class Facility(BaseModel):
    id: str = Field(..., min_length=1, description="Unique facility identifier")
    name: str = Field(..., min_length=1, description="Human-readable facility name")
    facility_type: FacilityType = Field(..., description="Tier category within supply chain")
    location: Optional[str] = Field(None, description="Geographic/regional identifier")
    position: Optional[Coordinate3D] = Field(
        None, description="3D scene visualization coordinates"
    )
    supply_capacity: float = Field(
        default=0.0,
        ge=0.0,
        description="Max raw material / supply units produced per period (Suppliers)",
    )
    processing_capacity: float = Field(
        default=0.0,
        ge=0.0,
        description="Max throughput units processable per period (Factories & DCs)",
    )
    inventory: float = Field(
        default=0.0,
        ge=0.0,
        description="Current or initial physical stock on-hand",
    )
    demand: float = Field(
        default=0.0,
        ge=0.0,
        description="Required customer demand units per period (Retailers)",
    )
    status: OperationalStatus = Field(
        default=OperationalStatus.OPERATIONAL,
        description="Operational health status of facility",
    )
    metadata: Dict[str, Any] = Field(
        default_factory=dict,
        description="Extensible metadata attributes",
    )

    @field_validator("id")
    @classmethod
    def validate_id_whitespace(cls, v: str) -> str:
        trimmed = v.strip()
        if not trimmed:
            raise ValueError("Facility id cannot be empty or whitespace only")
        return trimmed
