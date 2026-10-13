"""Google OR-Tools constrained recovery optimization engine."""
import math
import time
from typing import Dict, List, Optional, Set, Tuple
from ortools.linear_solver import pywraplp

from app.models.common import FacilityType
from app.models.disruption import Disruption, DisruptionType
from app.models.facility import Facility
from app.models.optimization import (
    OptimizationSolverStatus,
    RecoveryAction,
    RecoveryPlan,
    RouteDispatchDecision,
)
from app.models.route import TransportRoute
from app.models.scenario import Scenario


class SupplyChainRecoveryOptimizer:
    """
    Formulates and solves a multi-period time-expanded linear optimization problem
    using Google OR-Tools to determine recovery flows across the supply chain.
    """

    def __init__(
        self,
        scenario: Scenario,
        disruptions: Optional[List[Disruption]] = None,
        horizon_periods: Optional[int] = None,
        shortage_penalty: float = 1000.0,
        solver_name: str = "GLOP",
    ):
        self.scenario = scenario
        self.disruptions = disruptions or []
        self.horizon: int = horizon_periods or scenario.planning_horizon_periods
        self.shortage_penalty: float = shortage_penalty
        self.solver_name: str = solver_name

        self.facilities: Dict[str, Facility] = {f.id: f for f in scenario.facilities}
        self.routes: Dict[str, TransportRoute] = {r.id: r for r in scenario.routes}
        self.incoming_routes: Dict[str, List[TransportRoute]] = {f.id: [] for f in scenario.facilities}
        self.outgoing_routes: Dict[str, List[TransportRoute]] = {f.id: [] for f in scenario.facilities}

        for r in scenario.routes:
            self.outgoing_routes[r.source_id].append(r)
            self.incoming_routes[r.target_id].append(r)

    def solve(self) -> Tuple[RecoveryPlan, List[RecoveryAction], float, OptimizationSolverStatus, bool, float, List[str]]:
        """
        Builds the time-expanded recovery linear program, invokes OR-Tools,
        and extracts the optimal dispatch plan.
        """
        start_time = time.perf_counter()

        solver = pywraplp.Solver.CreateSolver(self.solver_name)
        if solver is None:
            # Fallback check
            solver = pywraplp.Solver.CreateSolver("GLOP")
            if solver is None:
                elapsed_ms = (time.perf_counter() - start_time) * 1000.0
                empty_plan = RecoveryPlan(
                    scenario_id=self.scenario.id,
                    planning_horizon_periods=self.horizon,
                    solver_status=OptimizationSolverStatus.SOLVER_UNAVAILABLE,
                    objective_value=0.0,
                    total_planned_dispatches=0.0,
                    total_planned_transport_cost=0.0,
                )
                return empty_plan, [], 0.0, OptimizationSolverStatus.SOLVER_UNAVAILABLE, False, elapsed_ms, ["OR-Tools linear solver unavailable"]

        # Precompute disruption factors per period
        facility_disabled, facility_cap_mult = self._compute_facility_disruption_matrices()
        route_closed, route_cap_mult, route_lead_added = self._compute_route_disruption_matrices()
        demand_matrix = self._compute_demand_matrix()

        # Decision Variables:
        # x[r_id, t]: dispatch on route r at period t
        x: Dict[Tuple[str, int], pywraplp.Variable] = {}
        # inv[f_id, t]: inventory at facility f at end of period t
        inv: Dict[Tuple[str, int], pywraplp.Variable] = {}
        # shortage[ret_id, t]: unmet demand at retailer ret at period t
        shortage: Dict[Tuple[str, int], pywraplp.Variable] = {}
        # delivered[ret_id, t]: delivered demand at retailer ret at period t
        delivered: Dict[Tuple[str, int], pywraplp.Variable] = {}

        infinity = solver.infinity()

        # 1. Create Route Dispatch Variables
        for r_id, route in self.routes.items():
            for t in range(self.horizon):
                is_closed = route_closed[r_id][t] or facility_disabled[route.source_id][t]
                if is_closed:
                    ub = 0.0
                else:
                    ub = route.capacity * route_cap_mult[r_id][t]
                x[r_id, t] = solver.NumVar(0.0, ub, f"x_{r_id}_{t}")

        # 2. Create Facility Inventory Variables
        for f_id in self.facilities:
            for t in range(self.horizon):
                inv[f_id, t] = solver.NumVar(0.0, infinity, f"inv_{f_id}_{t}")

        # 3. Create Retailer Demand, Backlog & Delivered Variables
        tot_dem_all = sum(
            sum(demand_matrix[f.id])
            for f in self.scenario.facilities
            if f.facility_type == FacilityType.RETAILER
        )
        for f in self.scenario.facilities:
            if f.facility_type == FacilityType.RETAILER:
                for t in range(self.horizon):
                    shortage[f.id, t] = solver.NumVar(0.0, tot_dem_all, f"backlog_{f.id}_{t}")
                    delivered[f.id, t] = solver.NumVar(0.0, tot_dem_all, f"deliv_{f.id}_{t}")

        # Constraints Construction

        # 4. Supplier Balance & Capacity
        for f in self.scenario.facilities:
            if f.facility_type == FacilityType.SUPPLIER:
                for t in range(self.horizon):
                    # Inflow from daily production
                    prod_cap = 0.0 if facility_disabled[f.id][t] else (f.supply_capacity * facility_cap_mult[f.id][t])
                    # Outbound sum
                    out_flow = [x[r.id, t] for r in self.outgoing_routes[f.id]]
                    prev_inv = inv[f.id, t - 1] if t > 0 else 0.0

                    # Balance: inv[t] - prev_inv + sum(out) == prod_cap
                    ct = solver.Constraint(prod_cap, prod_cap, f"sup_bal_{f.id}_{t}")
                    ct.SetCoefficient(inv[f.id, t], 1.0)
                    if t > 0:
                        ct.SetCoefficient(prev_inv, -1.0)
                    for var in out_flow:
                        ct.SetCoefficient(var, 1.0)

        # 5. Factory & DC Throughput & Inventory Balance
        for f in self.scenario.facilities:
            if f.facility_type in (FacilityType.FACTORY, FacilityType.DISTRIBUTION_CENTER):
                for t in range(self.horizon):
                    # Outbound throughput limit
                    max_proc = 0.0 if facility_disabled[f.id][t] else (f.processing_capacity * facility_cap_mult[f.id][t])
                    out_vars = [x[r.id, t] for r in self.outgoing_routes[f.id]]

                    ct_proc = solver.Constraint(-infinity, max_proc, f"proc_cap_{f.id}_{t}")
                    for var in out_vars:
                        ct_proc.SetCoefficient(var, 1.0)

                    # Inbound arrivals at period t based on effective lead time
                    # Shipment dispatched at dispatch_t arrives at dispatch_t + eff_lead
                    inbound_terms: List[Tuple[pywraplp.Variable, float]] = []
                    for in_r in self.incoming_routes[f.id]:
                        for dispatch_t in range(t + 1):
                            eff_lead = in_r.lead_time_periods + route_lead_added[in_r.id][dispatch_t]
                            # Integer arrival period approximation (ceil ensures no optimistic premature arrivals)
                            arrival_t = dispatch_t + int(math.ceil(eff_lead))
                            if arrival_t == t:
                                inbound_terms.append((x[in_r.id, dispatch_t], 1.0))

                    # Balance constraint:
                    # inv[t] - inv[t-1] + sum(out) - sum(in_arrivals) == 0 (with inv[-1] = initial_inv)
                    init_stock = float(f.inventory) if t == 0 else 0.0
                    ct_bal = solver.Constraint(init_stock, init_stock, f"trans_bal_{f.id}_{t}")
                    ct_bal.SetCoefficient(inv[f.id, t], 1.0)
                    if t > 0:
                        ct_bal.SetCoefficient(inv[f.id, t - 1], -1.0)
                    for var in out_vars:
                        ct_bal.SetCoefficient(var, 1.0)
                    for var, coeff in inbound_terms:
                        ct_bal.SetCoefficient(var, -coeff)

        # 6. Retailer Balance & Backlog Conservation
        for f in self.scenario.facilities:
            if f.facility_type == FacilityType.RETAILER:
                for t in range(self.horizon):
                    dem = demand_matrix[f.id][t]

                    # Total incoming arrivals at period t (including dispatches arriving at or before horizon boundary)
                    inbound_arrivals: List[pywraplp.Variable] = []
                    for in_r in self.incoming_routes[f.id]:
                        for dispatch_t in range(self.horizon):
                            eff_lead = in_r.lead_time_periods + route_lead_added[in_r.id][dispatch_t]
                            exact_arr = dispatch_t + eff_lead
                            if exact_arr <= self.horizon:
                                arr_idx = min(int(exact_arr), self.horizon - 1)
                                if arr_idx == t:
                                    inbound_arrivals.append(x[in_r.id, dispatch_t])

                    # Backlog conservation: backlog[t] - backlog[t-1] + delivered[t] == dem
                    # i.e. backlog[t] = backlog[t-1] + dem - delivered[t]
                    ct_backlog = solver.Constraint(dem, dem, f"ret_backlog_{f.id}_{t}")
                    ct_backlog.SetCoefficient(shortage[f.id, t], 1.0)
                    if t > 0:
                        ct_backlog.SetCoefficient(shortage[f.id, t - 1], -1.0)
                    ct_backlog.SetCoefficient(delivered[f.id, t], 1.0)

                    # Retailer inventory conservation:
                    # inv[t] - inv[t-1] + delivered[t] - sum(arrivals) == 0 (with inv[-1] = initial_inv)
                    init_stock = float(f.inventory) if t == 0 else 0.0
                    ct_bal = solver.Constraint(init_stock, init_stock, f"ret_bal_{f.id}_{t}")
                    ct_bal.SetCoefficient(inv[f.id, t], 1.0)
                    if t > 0:
                        ct_bal.SetCoefficient(inv[f.id, t - 1], -1.0)
                    ct_bal.SetCoefficient(delivered[f.id, t], 1.0)
                    for var in inbound_arrivals:
                        ct_bal.SetCoefficient(var, -1.0)

        # 7. Objective Function:
        # Minimize total unmet demand penalties + total transport costs
        objective = solver.Objective()
        for f in self.scenario.facilities:
            if f.facility_type == FacilityType.RETAILER:
                for t in range(self.horizon):
                    objective.SetCoefficient(shortage[f.id, t], self.shortage_penalty)

        for r_id, route in self.routes.items():
            for t in range(self.horizon):
                objective.SetCoefficient(x[r_id, t], route.cost_per_unit)

        objective.SetMinimization()

        # Solve!
        solver_status_code = solver.Solve()
        elapsed_ms = (time.perf_counter() - start_time) * 1000.0

        status_mapping = {
            pywraplp.Solver.OPTIMAL: OptimizationSolverStatus.OPTIMAL,
            pywraplp.Solver.FEASIBLE: OptimizationSolverStatus.FEASIBLE,
            pywraplp.Solver.INFEASIBLE: OptimizationSolverStatus.INFEASIBLE,
            pywraplp.Solver.UNBOUNDED: OptimizationSolverStatus.UNBOUNDED,
            pywraplp.Solver.ABNORMAL: OptimizationSolverStatus.ABNORMAL,
        }
        status = status_mapping.get(solver_status_code, OptimizationSolverStatus.ABNORMAL)
        is_feasible = status in (OptimizationSolverStatus.OPTIMAL, OptimizationSolverStatus.FEASIBLE)
        obj_val = solver.Objective().Value() if is_feasible else 0.0

        if not is_feasible:
            empty_plan = RecoveryPlan(
                scenario_id=self.scenario.id,
                planning_horizon_periods=self.horizon,
                solver_status=status,
                objective_value=0.0,
                total_planned_dispatches=0.0,
                total_planned_transport_cost=0.0,
            )
            return empty_plan, [], obj_val, status, False, elapsed_ms, ["Solver reported infeasibility or abnormal exit"]

        # Extract Solution Decisions & Plan
        dispatches_by_period: Dict[int, List[RouteDispatchDecision]] = {t: [] for t in range(self.horizon)}
        summary_flow_by_route: Dict[str, float] = {r_id: 0.0 for r_id in self.routes}
        total_planned_qty = 0.0
        total_planned_cost = 0.0
        recovery_actions: List[RecoveryAction] = []
        bottlenecks: List[str] = []

        # Identify disrupted targets for dynamic recovery action extraction
        disrupted_route_ids = {
            d.target_id for d in self.disruptions
            if d.target_id in self.routes or d.disruption_type in (DisruptionType.ROUTE_CLOSURE, DisruptionType.LEAD_TIME_INCREASE)
        }
        disrupted_facility_ids = {
            d.target_id for d in self.disruptions
            if d.target_id in self.facilities or d.disruption_type in (DisruptionType.FACILITY_SHUTDOWN, DisruptionType.DEMAND_SURGE)
        }

        for t in range(self.horizon):
            for r_id, route in self.routes.items():
                val = x[r_id, t].solution_value()
                if val > 1e-3:
                    rounded_qty = round(val, 2)
                    c = round(rounded_qty * route.cost_per_unit, 2)
                    dec = RouteDispatchDecision(
                        period=t,
                        route_id=r_id,
                        source_id=route.source_id,
                        target_id=route.target_id,
                        planned_quantity=rounded_qty,
                        unit_cost=route.cost_per_unit,
                        total_cost=c,
                    )
                    dispatches_by_period[t].append(dec)
                    summary_flow_by_route[r_id] += rounded_qty
                    total_planned_qty += rounded_qty
                    total_planned_cost += c

                    # Check if utilizing alternative backup routes or compensating disrupted siblings
                    r_id_lower = r_id.lower()
                    type_meta = str(route.metadata.get("type", "")).lower()
                    is_backup = "backup" in type_meta or "alt" in type_meta or "alternative" in r_id_lower or "alt" in r_id_lower or "backup" in r_id_lower
                    
                    # Sibling route check: another route from the same source or into the same target is disrupted
                    is_sibling_of_disrupted = any(
                        other_r.id in disrupted_route_ids
                        for other_r in self.outgoing_routes.get(route.source_id, [])
                        if other_r.id != r_id
                    ) or any(
                        other_r.id in disrupted_route_ids
                        for other_r in self.incoming_routes.get(route.target_id, [])
                        if other_r.id != r_id
                    )

                    if is_backup or is_sibling_of_disrupted:
                        recovery_actions.append(
                            RecoveryAction(
                                action_type="REROUTE",
                                facility_or_route_id=r_id,
                                period=t,
                                description=f"Rerouted {rounded_qty} units on alternative lane '{r_id}' ({route.source_id} -> {route.target_id})",
                                quantity=rounded_qty,
                            )
                        )
                    elif (route.source_id in disrupted_facility_ids or route.target_id in disrupted_facility_ids) and rounded_qty > 0:
                        recovery_actions.append(
                            RecoveryAction(
                                action_type="EXPEDITE_FLOW",
                                facility_or_route_id=r_id,
                                period=t,
                                description=f"Adjusted dispatch of {rounded_qty} units on lane '{r_id}' adjacent to disrupted facility",
                                quantity=rounded_qty,
                            )
                        )

        # Fallback: if disruptions were injected and solved, ensure top compensatory actions are logged
        if self.disruptions and len(recovery_actions) == 0 and total_planned_qty > 0:
            # Pick the top 3 highest-flow routes as active recovery corridors
            sorted_routes = sorted(summary_flow_by_route.items(), key=lambda kv: kv[1], reverse=True)
            for top_r_id, top_flow in sorted_routes[:3]:
                if top_flow > 0:
                    r_obj = self.routes[top_r_id]
                    recovery_actions.append(
                        RecoveryAction(
                            action_type="OPTIMIZED_DISPATCH",
                            facility_or_route_id=top_r_id,
                            period=0,
                            description=f"Optimal recovery throughput maintained {top_flow} units via lane '{top_r_id}' ({r_obj.source_id} -> {r_obj.target_id})",
                            quantity=top_flow,
                        )
                    )

        # Detect active bottlenecks (capacity tight bounds)
        for r_id, route in self.routes.items():
            tot_cap = route.capacity * self.horizon
            if summary_flow_by_route[r_id] >= 0.95 * tot_cap and summary_flow_by_route[r_id] > 0:
                bottlenecks.append(f"Route '{r_id}' operating near 100% capacity ({summary_flow_by_route[r_id]}/{tot_cap} units)")

        # Detect unmet demand shortages causing active bottleneck
        for f in self.scenario.facilities:
            if f.facility_type == FacilityType.RETAILER:
                final_shortage = shortage[f.id, self.horizon - 1].solution_value()
                if final_shortage > 1e-3:
                    bottlenecks.append(f"Unavoidable shortage of {round(final_shortage, 2)} units at '{f.name}' ({f.id})")

        rerouted_routes = [r_id for r_id, flow in summary_flow_by_route.items() if flow > 0]

        plan = RecoveryPlan(
            scenario_id=self.scenario.id,
            planning_horizon_periods=self.horizon,
            solver_status=status,
            objective_value=round(obj_val, 2),
            total_planned_dispatches=round(total_planned_qty, 2),
            total_planned_transport_cost=round(total_planned_cost, 2),
            dispatches_by_period=dispatches_by_period,
            summary_flow_by_route={k: round(v, 2) for k, v in summary_flow_by_route.items()},
            rerouted_routes=rerouted_routes,
            bottlenecks=bottlenecks,
        )

        return plan, recovery_actions, obj_val, status, is_feasible, elapsed_ms, bottlenecks

    def _compute_facility_disruption_matrices(self) -> Tuple[Dict[str, List[bool]], Dict[str, List[float]]]:
        disabled = {f_id: [False] * self.horizon for f_id in self.facilities}
        multiplier = {f_id: [1.0] * self.horizon for f_id in self.facilities}

        for d in self.disruptions:
            for t in range(self.horizon):
                is_active = (
                    t >= d.start_period
                    if d.duration_periods is None
                    else (d.start_period <= t < d.start_period + d.duration_periods)
                )
                if is_active:
                    if d.disruption_type == DisruptionType.FACILITY_SHUTDOWN and d.target_id in self.facilities:
                        disabled[d.target_id][t] = True
                    elif d.disruption_type == DisruptionType.CAPACITY_REDUCTION and d.target_id in self.facilities:
                        multiplier[d.target_id][t] *= (1.0 - d.magnitude)

        return disabled, multiplier

    def _compute_route_disruption_matrices(self) -> Tuple[Dict[str, List[bool]], Dict[str, List[float]], Dict[str, List[float]]]:
        closed = {r_id: [False] * self.horizon for r_id in self.routes}
        multiplier = {r_id: [1.0] * self.horizon for r_id in self.routes}
        lead_add = {r_id: [0.0] * self.horizon for r_id in self.routes}

        for d in self.disruptions:
            for t in range(self.horizon):
                is_active = (
                    t >= d.start_period
                    if d.duration_periods is None
                    else (d.start_period <= t < d.start_period + d.duration_periods)
                )
                if is_active:
                    if d.disruption_type == DisruptionType.ROUTE_CLOSURE and d.target_id in self.routes:
                        closed[d.target_id][t] = True
                    elif d.disruption_type == DisruptionType.CAPACITY_REDUCTION and d.target_id in self.routes:
                        multiplier[d.target_id][t] *= (1.0 - d.magnitude)
                    elif d.disruption_type == DisruptionType.LEAD_TIME_INCREASE and d.target_id in self.routes:
                        lead_add[d.target_id][t] += d.magnitude

        return closed, multiplier, lead_add

    def _compute_demand_matrix(self) -> Dict[str, List[float]]:
        demands = {
            f.id: [f.demand] * self.horizon
            for f in self.scenario.facilities
            if f.facility_type == FacilityType.RETAILER
        }

        for d in self.disruptions:
            if d.disruption_type == DisruptionType.DEMAND_SURGE and d.target_id in demands:
                for t in range(self.horizon):
                    is_active = (
                        t >= d.start_period
                        if d.duration_periods is None
                        else (d.start_period <= t < d.start_period + d.duration_periods)
                    )
                    if is_active:
                        demands[d.target_id][t] *= d.magnitude

        return demands
