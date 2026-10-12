"""SimPy-powered discrete-event supply chain simulation engine."""
import copy
from typing import Any, Dict, List, Optional, Set, Tuple
import simpy

from app.models.common import FacilityType, OperationalStatus, RouteStatus
from app.models.disruption import Disruption, DisruptionType
from app.models.facility import Facility
from app.models.optimization import ExecutionDeviation, RecoveryPlan
from app.models.route import TransportRoute
from app.models.scenario import Scenario
from app.models.simulation import (
    DisruptionEventRecord,
    PeriodMetrics,
    ShipmentRecord,
    ShipmentStatus,
    SimulationMode,
    SimulationResult,
)


class SupplyChainSimulationEngine:
    """
    Discrete-event simulation engine powered by SimPy.
    Models multi-tier material replenishment, route traversal with lead times,
    facility processing limits, and simultaneous time-stepped disruptions.
    """

    def __init__(
        self,
        scenario: Scenario,
        mode: SimulationMode = SimulationMode.BASELINE,
        disruptions: Optional[List[Disruption]] = None,
        horizon_periods: Optional[int] = None,
        random_seed: int = 42,
        recovery_plan: Optional[RecoveryPlan] = None,
    ):
        # Deepcopy to prevent any mutation of the benchmark scenario
        self.scenario: Scenario = copy.deepcopy(scenario)
        self.mode: SimulationMode = mode
        self.recovery_plan: Optional[RecoveryPlan] = recovery_plan
        self.execution_deviations: List[ExecutionDeviation] = []
        self.disruptions: List[Disruption] = (
            [copy.deepcopy(d) for d in disruptions] if (mode == SimulationMode.DISRUPTED and disruptions) else []
        )
        self.horizon: int = horizon_periods or self.scenario.planning_horizon_periods
        self.random_seed: int = random_seed


        # Internal state
        self.facilities: Dict[str, Facility] = {f.id: f for f in self.scenario.facilities}
        self.routes: Dict[str, TransportRoute] = {r.id: r for r in self.scenario.routes}
        self.incoming_routes: Dict[str, List[TransportRoute]] = {f.id: [] for f in self.scenario.facilities}
        self.outgoing_routes: Dict[str, List[TransportRoute]] = {f.id: [] for f in self.scenario.facilities}

        for r in self.scenario.routes:
            self.outgoing_routes[r.source_id].append(r)
            self.incoming_routes[r.target_id].append(r)

        # Inventory levels
        self.current_inventory: Dict[str, float] = {
            f.id: float(f.inventory) for f in self.scenario.facilities
        }

        # SimPy environment
        self.env: simpy.Environment = simpy.Environment()

        # Audit logs and tracking
        self.shipment_records: List[ShipmentRecord] = []
        self.shipment_counter: int = 0
        self.disruption_events: List[DisruptionEventRecord] = []
        self.inventory_snapshots: Dict[str, Dict[int, float]] = {f.id: {} for f in self.scenario.facilities}
        self.period_metrics: List[PeriodMetrics] = []
        self.warnings: List[str] = []

        # Running totals
        self.total_requested_demand: float = 0.0
        self.total_delivered_units: float = 0.0
        self.total_transport_cost: float = 0.0

        # Pending demand backlog per retailer
        self.retailer_backlog: Dict[str, float] = {
            f.id: 0.0 for f in self.scenario.facilities if f.facility_type == FacilityType.RETAILER
        }
        # Period-by-period delivered tracking
        self.period_delivered: Dict[int, float] = {p: 0.0 for p in range(self.horizon)}

    def run(self) -> SimulationResult:
        """Executes the SimPy simulation run until the horizon ends."""
        # Register period simulation master clock process
        self.env.process(self._master_simulation_process())

        # Run SimPy event engine until horizon (small epsilon allows processing arrivals at exactly horizon boundary)
        self.env.run(until=self.horizon + 1e-6)


        # Final audit of in-transit shipments
        in_transit_units = 0.0
        for rec in self.shipment_records:
            if rec.status == ShipmentStatus.DISPATCHED:
                rec.status = ShipmentStatus.IN_TRANSIT
                in_transit_units += rec.quantity

        total_unmet = max(0.0, self.total_requested_demand - self.total_delivered_units)
        service_level = (
            (self.total_delivered_units / self.total_requested_demand * 100.0)
            if self.total_requested_demand > 0.0
            else 100.0
        )
        service_level = max(0.0, min(100.0, service_level))

        dispatched_count = len(self.shipment_records)
        delivered_count = sum(1 for r in self.shipment_records if r.status == ShipmentStatus.DELIVERED)
        in_transit_count = sum(1 for r in self.shipment_records if r.status == ShipmentStatus.IN_TRANSIT)

        return SimulationResult(
            scenario_id=self.scenario.id,
            simulation_mode=self.mode,
            planning_horizon_periods=self.horizon,
            period_unit=self.scenario.period_unit,
            total_requested_demand=round(self.total_requested_demand, 3),
            total_delivered_units=round(self.total_delivered_units, 3),
            total_unmet_demand=round(total_unmet, 3),
            service_level_pct=round(service_level, 2),
            total_transport_cost=round(self.total_transport_cost, 2),
            shipments_dispatched_count=dispatched_count,
            shipments_delivered_count=delivered_count,
            shipments_in_transit_count=in_transit_count,
            in_transit_units=round(in_transit_units, 3),
            period_metrics=self.period_metrics,
            shipment_records=self.shipment_records,
            inventory_snapshots=self.inventory_snapshots,
            disruption_events=self.disruption_events,
            status="completed",
            warnings=self.warnings,
        )

    def _master_simulation_process(self):
        """SimPy process stepping through each planning period."""
        for p in range(self.horizon):
            self._step_period(p)
            yield self.env.timeout(1.0)

    def _step_period(self, period: int):
        """Executes operations for a discrete period tick."""
        # 1. Resolve active disruptions for this period
        active_disruptions = self._get_active_disruptions(period)
        active_ids = [d.id for d in active_disruptions]

        # 2. Compute dynamic operational factors
        facility_disabled, facility_cap_multiplier = self._compute_facility_disruptions(active_disruptions)
        route_closed, route_cap_multiplier, route_lead_added = self._compute_route_disruptions(active_disruptions)
        demand_multipliers = self._compute_demand_disruptions(active_disruptions)

        # 3. Snapshot inventory at period start
        for f_id, inv in self.current_inventory.items():
            self.inventory_snapshots[f_id][period] = round(inv, 3)

        # 4. Generate customer demand at retailers
        period_requested_demand = 0.0
        for f in self.scenario.facilities:
            if f.facility_type == FacilityType.RETAILER:
                surge = demand_multipliers.get(f.id, 1.0)
                dem = f.demand * surge
                self.retailer_backlog[f.id] += dem
                period_requested_demand += dem
        self.total_requested_demand += period_requested_demand

        # 5. Suppliers produce new supply
        for f in self.scenario.facilities:
            if f.facility_type == FacilityType.SUPPLIER:
                if not facility_disabled.get(f.id, False):
                    multiplier = facility_cap_multiplier.get(f.id, 1.0)
                    new_supply = f.supply_capacity * multiplier
                    self.current_inventory[f.id] += new_supply

        # 6. Material Dispatch: Recovery Plan Guided OR Default Heuristic Allocation
        period_dispatches = 0
        period_cost = 0.0

        if self.recovery_plan is not None:
            # Execute optimizer-guided recovery plan
            decisions = self.recovery_plan.dispatches_by_period.get(period, [])
            for dec in decisions:
                r = self.routes[dec.route_id]
                source_fac = self.facilities[r.source_id]

                is_route_closed = route_closed.get(r.id, False)
                is_src_disabled = facility_disabled.get(source_fac.id, False)

                if is_route_closed or is_src_disabled:
                    actual_qty = 0.0
                    deviation_reason = "Route closed or facility shut down by active disruption"
                else:
                    avail_stock = max(0.0, self.current_inventory[source_fac.id])
                    r_eff_cap = r.capacity * route_cap_multiplier.get(r.id, 1.0)
                    if source_fac.facility_type in (FacilityType.FACTORY, FacilityType.DISTRIBUTION_CENTER):
                        f_eff_cap = source_fac.processing_capacity * facility_cap_multiplier.get(source_fac.id, 1.0)
                    else:
                        f_eff_cap = float("inf")
                    actual_qty = min(dec.planned_quantity, avail_stock, r_eff_cap, f_eff_cap)
                    deviation_reason = "Dynamic inventory or throughput limitation"

                if actual_qty > 0.0:
                    self.current_inventory[source_fac.id] -= actual_qty
                    if self.facilities[r.target_id].facility_type == FacilityType.RETAILER:
                        self.retailer_backlog[r.target_id] = max(
                            0.0, self.retailer_backlog[r.target_id] - actual_qty
                        )

                    eff_lead = r.lead_time_periods + route_lead_added.get(r.id, 0.0)
                    cost = actual_qty * r.cost_per_unit
                    self.total_transport_cost += cost
                    period_cost += cost
                    period_dispatches += 1

                    self._dispatch_shipment(
                        route=r,
                        quantity=actual_qty,
                        lead_time=eff_lead,
                        cost=cost,
                        period=period,
                    )

                if actual_qty < dec.planned_quantity - 1e-3:
                    from app.models.optimization import ExecutionDeviation

                    self.execution_deviations.append(
                        ExecutionDeviation(
                            period=period,
                            route_id=r.id,
                            source_id=r.source_id,
                            target_id=r.target_id,
                            planned_quantity=dec.planned_quantity,
                            actual_dispatched_quantity=round(actual_qty, 3),
                            deviation=round(dec.planned_quantity - actual_qty, 3),
                            reason=deviation_reason,
                        )
                    )
        else:
            # Default Heuristic Echelon Allocation
            # 6a. DCs fulfill Retailer demand
            for ret in [f for f in self.scenario.facilities if f.facility_type == FacilityType.RETAILER]:
                needed = self.retailer_backlog[ret.id]
                if needed <= 0.0:
                    continue

                candidate_routes = [
                    r for r in self.incoming_routes[ret.id]
                    if not route_closed.get(r.id, False) and not facility_disabled.get(r.source_id, False)
                ]
                candidate_routes.sort(key=lambda r: (r.lead_time_periods, r.cost_per_unit, r.id))

                for r in candidate_routes:
                    if needed <= 0.0:
                        break
                    dc = self.facilities[r.source_id]
                    dc_avail = self.current_inventory[dc.id]
                    if dc_avail <= 0.0:
                        continue

                    r_eff_cap = r.capacity * route_cap_multiplier.get(r.id, 1.0)
                    dc_eff_cap = dc.processing_capacity * facility_cap_multiplier.get(dc.id, 1.0)
                    send_qty = min(needed, dc_avail, r_eff_cap, dc_eff_cap)

                    if send_qty > 0.0:
                        self.current_inventory[dc.id] -= send_qty
                        needed -= send_qty
                        self.retailer_backlog[ret.id] -= send_qty

                        eff_lead = r.lead_time_periods + route_lead_added.get(r.id, 0.0)
                        cost = send_qty * r.cost_per_unit
                        self.total_transport_cost += cost
                        period_cost += cost
                        period_dispatches += 1

                        self._dispatch_shipment(
                            route=r,
                            quantity=send_qty,
                            lead_time=eff_lead,
                            cost=cost,
                            period=period,
                        )

            # 6b. Factories ship to DCs
            for dc in [f for f in self.scenario.facilities if f.facility_type == FacilityType.DISTRIBUTION_CENTER]:
                if facility_disabled.get(dc.id, False):
                    continue
                dc_target_stock = dc.processing_capacity
                dc_needed = max(0.0, dc_target_stock - self.current_inventory[dc.id])
                if dc_needed <= 0.0:
                    continue

                candidate_routes = [
                    r for r in self.incoming_routes[dc.id]
                    if not route_closed.get(r.id, False) and not facility_disabled.get(r.source_id, False)
                ]
                candidate_routes.sort(key=lambda r: (r.lead_time_periods, r.cost_per_unit, r.id))

                for r in candidate_routes:
                    if dc_needed <= 0.0:
                        break
                    fac = self.facilities[r.source_id]
                    fac_avail = self.current_inventory[fac.id]
                    if fac_avail <= 0.0:
                        continue

                    r_eff_cap = r.capacity * route_cap_multiplier.get(r.id, 1.0)
                    fac_eff_cap = fac.processing_capacity * facility_cap_multiplier.get(fac.id, 1.0)
                    send_qty = min(dc_needed, fac_avail, r_eff_cap, fac_eff_cap)

                    if send_qty > 0.0:
                        self.current_inventory[fac.id] -= send_qty
                        dc_needed -= send_qty

                        eff_lead = r.lead_time_periods + route_lead_added.get(r.id, 0.0)
                        cost = send_qty * r.cost_per_unit
                        self.total_transport_cost += cost
                        period_cost += cost
                        period_dispatches += 1

                        self._dispatch_shipment(
                            route=r,
                            quantity=send_qty,
                            lead_time=eff_lead,
                            cost=cost,
                            period=period,
                        )

            # 6c. Suppliers ship to Factories
            for fac in [f for f in self.scenario.facilities if f.facility_type == FacilityType.FACTORY]:
                if facility_disabled.get(fac.id, False):
                    continue
                fac_target = fac.processing_capacity
                fac_needed = max(0.0, fac_target - self.current_inventory[fac.id])
                if fac_needed <= 0.0:
                    continue

                candidate_routes = [
                    r for r in self.incoming_routes[fac.id]
                    if not route_closed.get(r.id, False) and not facility_disabled.get(r.source_id, False)
                ]
                candidate_routes.sort(key=lambda r: (r.lead_time_periods, r.cost_per_unit, r.id))

                for r in candidate_routes:
                    if fac_needed <= 0.0:
                        break
                    sup = self.facilities[r.source_id]
                    sup_avail = self.current_inventory[sup.id]
                    if sup_avail <= 0.0:
                        continue

                    r_eff_cap = r.capacity * route_cap_multiplier.get(r.id, 1.0)
                    send_qty = min(fac_needed, sup_avail, r_eff_cap)

                    if send_qty > 0.0:
                        self.current_inventory[sup.id] -= send_qty
                        fac_needed -= send_qty

                        eff_lead = r.lead_time_periods + route_lead_added.get(r.id, 0.0)
                        cost = send_qty * r.cost_per_unit
                        self.total_transport_cost += cost
                        period_cost += cost
                        period_dispatches += 1

                        self._dispatch_shipment(
                            route=r,
                            quantity=send_qty,
                            lead_time=eff_lead,
                            cost=cost,
                            period=period,
                        )


        # 9. Record period metrics
        p_delivered = self.period_delivered[period]
        p_unmet = max(0.0, period_requested_demand - p_delivered)
        p_sla = (
            (p_delivered / period_requested_demand * 100.0)
            if period_requested_demand > 0.0
            else 100.0
        )
        p_sla = max(0.0, min(100.0, p_sla))

        self.period_metrics.append(
            PeriodMetrics(
                period=period,
                requested_demand=round(period_requested_demand, 3),
                delivered_units=round(p_delivered, 3),
                unmet_demand=round(p_unmet, 3),
                service_level_pct=round(p_sla, 2),
                transport_cost=round(period_cost, 2),
                shipments_dispatched=period_dispatches,
                shipments_delivered=0,  # Updated dynamically when SimPy arrivals trigger
                active_disruptions=active_ids,
            )
        )

    def _dispatch_shipment(
        self,
        route: TransportRoute,
        quantity: float,
        lead_time: float,
        cost: float,
        period: int,
    ):
        """Creates a shipment record and initiates a SimPy transit process."""
        self.shipment_counter += 1
        shipment_id = f"ship_{self.shipment_counter:04d}"

        record = ShipmentRecord(
            shipment_id=shipment_id,
            route_id=route.id,
            source_id=route.source_id,
            target_id=route.target_id,
            quantity=round(quantity, 3),
            dispatch_period=float(period),
            expected_arrival_period=round(period + lead_time, 3),
            actual_arrival_period=None,
            status=ShipmentStatus.DISPATCHED,
            cost=round(cost, 2),
        )
        self.shipment_records.append(record)

        # Launch SimPy timeout process for material movement
        self.env.process(
            self._shipment_transit_process(
                record=record,
                target_id=route.target_id,
                lead_time=lead_time,
                quantity=quantity,
            )
        )

    def _shipment_transit_process(
        self,
        record: ShipmentRecord,
        target_id: str,
        lead_time: float,
        quantity: float,
    ):
        """SimPy process modeling transit delay and arrival."""
        yield self.env.timeout(lead_time)

        arrival_time = self.env.now
        # Check if shipment arrived within the horizon
        if arrival_time <= self.horizon:
            record.status = ShipmentStatus.DELIVERED
            record.actual_arrival_period = round(arrival_time, 3)

            dest_fac = self.facilities[target_id]
            if dest_fac.facility_type == FacilityType.RETAILER:
                # Fulfills customer demand!
                self.total_delivered_units += quantity
                arrival_period_idx = min(int(arrival_time), self.horizon - 1)
                if 0 <= arrival_period_idx < self.horizon:
                    self.period_delivered[arrival_period_idx] += quantity
            else:
                # Arrives into DC or Factory inventory
                self.current_inventory[target_id] += quantity

            # Increment period metrics shipments_delivered
            arrival_p = min(int(arrival_time), len(self.period_metrics) - 1)
            if 0 <= arrival_p < len(self.period_metrics):
                self.period_metrics[arrival_p].shipments_delivered += 1

        else:
            record.status = ShipmentStatus.IN_TRANSIT

    def _get_active_disruptions(self, period: int) -> List[Disruption]:
        """Returns disruptions active at the specified period."""
        active = []
        for d in self.disruptions:
            is_active = False
            if d.duration_periods is None:
                is_active = period >= d.start_period
            else:
                is_active = d.start_period <= period < (d.start_period + d.duration_periods)

            if is_active:
                active.append(d)
                # Log activation on first tick
                if period == d.start_period:
                    self.disruption_events.append(
                        DisruptionEventRecord(
                            disruption_id=d.id,
                            disruption_type=d.disruption_type.value,
                            target_id=d.target_id,
                            period=period,
                            event="activated",
                            details={"magnitude": d.magnitude},
                        )
                    )
            elif period == (d.start_period + (d.duration_periods or 0)):
                self.disruption_events.append(
                    DisruptionEventRecord(
                        disruption_id=d.id,
                        disruption_type=d.disruption_type.value,
                        target_id=d.target_id,
                        period=period,
                        event="expired",
                    )
                )

        return active

    def _compute_facility_disruptions(
        self, active: List[Disruption]
    ) -> Tuple[Dict[str, bool], Dict[str, float]]:
        disabled = {}
        multipliers = {}

        for d in active:
            if d.disruption_type == DisruptionType.FACILITY_SHUTDOWN:
                disabled[d.target_id] = True
            elif d.disruption_type == DisruptionType.CAPACITY_REDUCTION and d.target_id in self.facilities:
                # Compound capacity reduction: 1 - m
                cur = multipliers.get(d.target_id, 1.0)
                multipliers[d.target_id] = cur * (1.0 - d.magnitude)

        return disabled, multipliers

    def _compute_route_disruptions(
        self, active: List[Disruption]
    ) -> Tuple[Dict[str, bool], Dict[str, float], Dict[str, float]]:
        closed = {}
        cap_mult = {}
        lead_added = {}

        for d in active:
            if d.disruption_type == DisruptionType.ROUTE_CLOSURE:
                closed[d.target_id] = True
            elif d.disruption_type == DisruptionType.CAPACITY_REDUCTION and d.target_id in self.routes:
                cur = cap_mult.get(d.target_id, 1.0)
                cap_mult[d.target_id] = cur * (1.0 - d.magnitude)
            elif d.disruption_type == DisruptionType.LEAD_TIME_INCREASE:
                lead_added[d.target_id] = lead_added.get(d.target_id, 0.0) + d.magnitude

        return closed, cap_mult, lead_added

    def _compute_demand_disruptions(self, active: List[Disruption]) -> Dict[str, float]:
        multipliers = {}
        for d in active:
            if d.disruption_type == DisruptionType.DEMAND_SURGE:
                cur = multipliers.get(d.target_id, 1.0)
                multipliers[d.target_id] = cur * d.magnitude
        return multipliers
