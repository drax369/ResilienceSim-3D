"""Unit tests for domain models validation and consistency checks."""
import pytest
from pydantic import ValidationError

from app.models.common import Coordinate3D, FacilityType, OperationalStatus, RouteStatus
from app.models.disruption import Disruption, DisruptionType
from app.models.facility import Facility
from app.models.route import TransportRoute
from app.models.scenario import Scenario


def test_valid_facility_creation():
    fac = Facility(
        id="fac_1",
        name="Factory Alpha",
        facility_type=FacilityType.FACTORY,
        processing_capacity=100.0,
        inventory=20.0,
    )
    assert fac.id == "fac_1"
    assert fac.processing_capacity == 100.0
    assert fac.inventory == 20.0
    assert fac.status == OperationalStatus.OPERATIONAL


def test_facility_negative_capacity_rejected():
    with pytest.raises(ValidationError):
        Facility(
            id="fac_1",
            name="Factory Alpha",
            facility_type=FacilityType.FACTORY,
            processing_capacity=-10.0,
        )


def test_facility_empty_id_rejected():
    with pytest.raises(ValidationError):
        Facility(
            id="   ",
            name="Factory Alpha",
            facility_type=FacilityType.FACTORY,
        )


def test_valid_transport_route_creation():
    route = TransportRoute(
        id="r_1",
        source_id="sup_1",
        target_id="fac_1",
        capacity=50.0,
        lead_time_periods=2.0,
        cost_per_unit=3.5,
    )
    assert route.id == "r_1"
    assert route.capacity == 50.0
    assert route.lead_time_periods == 2.0
    assert route.cost_per_unit == 3.5
    assert route.status == RouteStatus.ACTIVE


def test_transport_route_self_loop_rejected():
    with pytest.raises(ValidationError) as excinfo:
        TransportRoute(
            id="r_self",
            source_id="fac_1",
            target_id="fac_1",
            capacity=50.0,
            lead_time_periods=1.0,
            cost_per_unit=1.0,
        )
    assert "Self-loop detected" in str(excinfo.value)


def test_transport_route_non_positive_lead_time_rejected():
    with pytest.raises(ValidationError):
        TransportRoute(
            id="r_1",
            source_id="sup_1",
            target_id="fac_1",
            capacity=50.0,
            lead_time_periods=0.0,
            cost_per_unit=1.0,
        )


def test_disruption_magnitude_validation():
    # Valid capacity reduction
    d_cap = Disruption(
        id="d1",
        disruption_type=DisruptionType.CAPACITY_REDUCTION,
        target_id="fac_1",
        magnitude=0.4,
    )
    assert d_cap.magnitude == 0.4

    # Invalid capacity reduction > 1.0
    with pytest.raises(ValidationError):
        Disruption(
            id="d1_inv",
            disruption_type=DisruptionType.CAPACITY_REDUCTION,
            target_id="fac_1",
            magnitude=1.5,
        )

    # Valid demand surge
    d_surge = Disruption(
        id="d2",
        disruption_type=DisruptionType.DEMAND_SURGE,
        target_id="ret_1",
        magnitude=1.3,
    )
    assert d_surge.magnitude == 1.3

    # Invalid demand surge < 1.0
    with pytest.raises(ValidationError):
        Disruption(
            id="d2_inv",
            disruption_type=DisruptionType.DEMAND_SURGE,
            target_id="ret_1",
            magnitude=0.8,
        )

    # Valid lead time increase
    d_lead = Disruption(
        id="d3",
        disruption_type=DisruptionType.LEAD_TIME_INCREASE,
        target_id="r_1",
        magnitude=3.0,
    )
    assert d_lead.magnitude == 3.0

    # Invalid lead time increase <= 0
    with pytest.raises(ValidationError):
        Disruption(
            id="d3_inv",
            disruption_type=DisruptionType.LEAD_TIME_INCREASE,
            target_id="r_1",
            magnitude=0.0,
        )


def test_scenario_duplicate_facility_rejected():
    f1 = Facility(id="node_1", name="N1", facility_type=FacilityType.SUPPLIER, supply_capacity=100)
    f2 = Facility(id="node_1", name="N2", facility_type=FacilityType.FACTORY)

    with pytest.raises(ValidationError) as exc:
        Scenario(
            id="sc_test",
            name="Test",
            description="Test",
            industry="Test",
            facilities=[f1, f2],
            routes=[],
        )
    assert "duplicate facility ID" in str(exc.value)


def test_scenario_unknown_route_endpoint_rejected():
    f1 = Facility(id="sup_1", name="Supplier", facility_type=FacilityType.SUPPLIER, supply_capacity=100)
    r = TransportRoute(
        id="r_bad",
        source_id="sup_1",
        target_id="unknown_dest",
        capacity=50,
        lead_time_periods=1,
        cost_per_unit=1,
    )

    with pytest.raises(ValidationError) as exc:
        Scenario(
            id="sc_test",
            name="Test",
            description="Test",
            industry="Test",
            facilities=[f1],
            routes=[r],
        )
    assert "unknown target facility ID" in str(exc.value)


def test_scenario_duplicate_directed_routes_rejected():
    f1 = Facility(id="sup_1", name="S1", facility_type=FacilityType.SUPPLIER, supply_capacity=100)
    f2 = Facility(id="fac_1", name="F1", facility_type=FacilityType.FACTORY)
    r1 = TransportRoute(id="r_1", source_id="sup_1", target_id="fac_1", capacity=50, lead_time_periods=1, cost_per_unit=1)
    r2 = TransportRoute(id="r_2", source_id="sup_1", target_id="fac_1", capacity=30, lead_time_periods=1, cost_per_unit=2)

    with pytest.raises(ValidationError) as exc:
        Scenario(
            id="sc_test",
            name="Test",
            description="Test",
            industry="Test",
            facilities=[f1, f2],
            routes=[r1, r2],
        )
    assert "Duplicate directed route lane" in str(exc.value)
