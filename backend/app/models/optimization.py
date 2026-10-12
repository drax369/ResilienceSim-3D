"""Pydantic models for Google OR-Tools recovery optimization and 3-way evaluation."""
from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

from app.models.disruption import Disruption
from app.models.simulation import SimulationDeltaMetrics, SimulationResult


class OptimizationSolverStatus(str, Enum):
    OPTIMAL = "optimal"
    FEASIBLE = "feasible"
    INFEASIBLE = "infeasible"
    UNBOUNDED = "unbounded"
    ABNORMAL = "abnormal"
    SOLVER_UNAVAILABLE = "solver_unavailable"


class RouteDispatchDecision(BaseModel):
    period: int = Field(..., ge=0)
    route_id: str
    source_id: str
    target_id: str
    planned_quantity: float = Field(..., ge=0.0)
    unit_cost: float = Field(..., ge=0.0)
    total_cost: float = Field(..., ge=0.0)

    @property
    def planned_dispatch_quantity(self) -> float:
        """Alias for planned_quantity for backwards compatibility with tests and callers."""
        return self.planned_quantity


class RecoveryAction(BaseModel):
    action_type: str = Field(..., description="e.g. 'REROUTE', 'INCREASE_THROUGHPUT', 'EMERGENCY_BUFFER'")
    facility_or_route_id: str
    period: int
    description: str
    quantity: float


class ExecutionDeviation(BaseModel):
    period: int
    route_id: str
    source_id: str
    target_id: str
    planned_quantity: float
    actual_dispatched_quantity: float
    deviation: float
    reason: str


class RecoveryPlan(BaseModel):
    scenario_id: str
    planning_horizon_periods: int
    solver_status: OptimizationSolverStatus
    objective_value: float
    total_planned_dispatches: float
    total_planned_transport_cost: float
    dispatches_by_period: Dict[int, List[RouteDispatchDecision]] = Field(
        default_factory=dict,
        description="Period-by-period dispatch actions for SimPy execution",
    )
    summary_flow_by_route: Dict[str, float] = Field(
        default_factory=dict,
        description="Total units allocated across each route over the horizon",
    )
    rerouted_routes: List[str] = Field(
        default_factory=list,
        description="Alternative routes activated by the recovery optimizer",
    )
    bottlenecks: List[str] = Field(
        default_factory=list,
        description="Active constraints binding max flow or causing unavoidable shortages",
    )

    @property
    def decisions(self) -> List[RouteDispatchDecision]:
        """Convenience accessor returning a flat list of all dispatch decisions across all periods."""
        flattened: List[RouteDispatchDecision] = []
        for period_decisions in self.dispatches_by_period.values():
            flattened.extend(period_decisions)
        return flattened


class OptimizationRequest(BaseModel):
    scenario_id: str = Field(..., description="ID of scenario to optimize recovery for")
    disruptions: List[Disruption] = Field(
        default_factory=list,
        description="Injected disruptions (outages, capacity cuts, surges)",
    )
    horizon_periods: Optional[int] = Field(
        None,
        gt=0,
        description="Planning horizon override",
    )
    shortage_penalty_per_unit: float = Field(
        default=1000.0,
        gt=0.0,
        description="Penalty weight for unmet demand in optimizer objective function",
    )
    random_seed: Optional[int] = Field(default=42)


class OptimizationRecoveryResponse(BaseModel):
    scenario_id: str
    planning_horizon_periods: int
    period_unit: str
    solver_name: str
    solver_status: OptimizationSolverStatus
    is_feasible: bool
    objective_value: float
    solve_runtime_ms: float
    recovery_plan: RecoveryPlan
    recovery_actions: List[RecoveryAction]
    execution_deviations: List[ExecutionDeviation] = Field(
        default_factory=list,
        description="Discrepancies between optimizer planned flows and physical SimPy simulation dispatches",
    )
    baseline: SimulationResult
    disrupted: SimulationResult
    recovered: Optional[SimulationResult] = None
    baseline_to_disrupted: SimulationDeltaMetrics
    disrupted_to_recovered: Optional[SimulationDeltaMetrics] = None
    baseline_to_recovered: Optional[SimulationDeltaMetrics] = None
    bottlenecks_and_shortages: List[str] = Field(default_factory=list)
    warnings: List[str] = Field(default_factory=list)
