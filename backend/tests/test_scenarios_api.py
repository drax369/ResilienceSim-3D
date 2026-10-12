"""Integration tests for scenarios and graph API endpoints."""
from fastapi.testclient import TestClient

from app.main import app
from app.scenarios.benchmark_scenarios import get_scenario_library

client = TestClient(app)


def test_scenario_library_benchmarks():
    library = get_scenario_library()
    assert "global_electronics" in library
    assert "pharma_cold_chain" in library

    # Verify Electronics network metrics
    s_elec = library["global_electronics"]
    assert len(s_elec.facilities) == 13
    assert len(s_elec.routes) == 22
    assert s_elec.industry == "Electronics"

    # Verify Pharma network metrics
    s_pharma = library["pharma_cold_chain"]
    assert len(s_pharma.facilities) == 11
    assert len(s_pharma.routes) == 18
    assert s_pharma.industry == "Pharmaceuticals"


def test_list_scenarios_endpoint():
    response = client.get("/api/scenarios")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2

    ids = {item["id"] for item in data}
    assert "global_electronics" in ids
    assert "pharma_cold_chain" in ids

    # Check summary schema fields
    first = data[0]
    for key in (
        "id",
        "name",
        "description",
        "industry",
        "node_count",
        "route_count",
        "planning_horizon_periods",
        "period_unit",
        "total_supply_capacity",
        "total_demand",
    ):
        assert key in first


def test_get_scenario_detail_electronics():
    response = client.get("/api/scenarios/global_electronics")
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == "global_electronics"
    assert len(data["facilities"]) == 13
    assert len(data["routes"]) == 22

    # Check that positions are populated and finite
    for fac in data["facilities"]:
        pos = fac["position"]
        assert pos is not None
        assert "x" in pos and "y" in pos and "z" in pos


def test_get_scenario_detail_pharma():
    response = client.get("/api/scenarios/pharma_cold_chain")
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == "pharma_cold_chain"
    assert len(data["facilities"]) == 11
    assert len(data["routes"]) == 18


def test_get_scenario_graph_endpoint():
    response = client.get("/api/scenarios/global_electronics/graph")
    assert response.status_code == 200
    data = response.json()
    assert data["scenario_id"] == "global_electronics"
    assert len(data["nodes"]) == 13
    assert len(data["edges"]) == 22

    summary = data["summary"]
    assert summary["total_nodes"] == 13
    assert summary["total_edges"] == 22
    assert summary["is_weakly_connected"] is True
    assert summary["unreachable_demand_nodes"] == []
    assert summary["nodes_by_type"]["supplier"] == 3
    assert summary["nodes_by_type"]["factory"] == 3
    assert summary["nodes_by_type"]["distribution_center"] == 3
    assert summary["nodes_by_type"]["retailer"] == 4


def test_get_scenario_not_found():
    response = client.get("/api/scenarios/non_existent_scenario")
    assert response.status_code == 404
    detail = response.json()["detail"]
    assert "non_existent_scenario" in detail
    assert "Available scenarios" in detail


def test_get_scenario_graph_not_found():
    response = client.get("/api/scenarios/non_existent_scenario/graph")
    assert response.status_code == 404
    detail = response.json()["detail"]
    assert "non_existent_scenario" in detail


def test_health_check_endpoint_unaffected():
    """Verify that existing Phase 1 health endpoint still passes."""
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"
