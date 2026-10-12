"""Graph response models for frontend consumption."""
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

from app.models.common import Coordinate3D, FacilityType, OperationalStatus, RouteStatus


class GraphNode(BaseModel):
    id: str
    name: str
    facility_type: FacilityType
    location: Optional[str] = None
    position: Coordinate3D
    supply_capacity: float = 0.0
    processing_capacity: float = 0.0
    inventory: float = 0.0
    demand: float = 0.0
    status: OperationalStatus
    metadata: Dict[str, Any] = Field(default_factory=dict)


class GraphEdge(BaseModel):
    id: str
    source: str
    target: str
    capacity: float
    lead_time_periods: float
    cost_per_unit: float
    status: RouteStatus
    distance_km: Optional[float] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)


class GraphSummary(BaseModel):
    total_nodes: int
    total_edges: int
    nodes_by_type: Dict[str, int]
    total_supply_capacity: float
    total_demand: float
    is_weakly_connected: bool
    is_strongly_connected: bool
    unreachable_demand_nodes: List[str] = Field(
        default_factory=list,
        description="Retailer demand nodes not reachable via directed paths from any supplier",
    )
    isolated_nodes: List[str] = Field(
        default_factory=list,
        description="Nodes with zero in-degree and zero out-degree",
    )


class GraphResponse(BaseModel):
    scenario_id: str
    nodes: List[GraphNode]
    edges: List[GraphEdge]
    summary: GraphSummary
