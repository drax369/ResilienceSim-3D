"""Common domain enums and basic value objects."""
from enum import Enum
from pydantic import BaseModel, Field


class FacilityType(str, Enum):
    SUPPLIER = "supplier"
    FACTORY = "factory"
    DISTRIBUTION_CENTER = "distribution_center"
    WAREHOUSE = "warehouse"
    RETAILER = "retailer"


class OperationalStatus(str, Enum):
    OPERATIONAL = "operational"
    DEGRADED = "degraded"
    OFFLINE = "offline"


class RouteStatus(str, Enum):
    ACTIVE = "active"
    CONGESTED = "congested"
    BLOCKED = "blocked"


class Coordinate3D(BaseModel):
    x: float = Field(..., description="X coordinate in 3D scene (typically tier depth)")
    y: float = Field(..., description="Y coordinate in 3D scene (vertical/horizontal spread)")
    z: float = Field(..., description="Z coordinate in 3D scene (depth offset)")

    model_config = {"frozen": True}
