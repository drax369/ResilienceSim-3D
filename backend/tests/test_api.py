"""Tests for ResilienceSim 3D API health and dependencies."""
import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_read_root():
    """Verify root endpoint returns service metadata."""
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["service"] == "ResilienceSim 3D API"
    assert "health" in data


def test_health_check_endpoint():
    """Verify /api/health returns 200 and expected schema."""
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["service"] == "ResilienceSim 3D API"
    assert data["version"] == "0.1.0"
    assert "timestamp" in data


def test_critical_dependencies_import():
    """Verify that SimPy, NetworkX, and Google OR-Tools are functional."""
    import simpy
    import networkx as nx
    from ortools.linear_solver import pywraplp

    # SimPy environment sanity check
    env = simpy.Environment()
    assert env.now == 0

    # NetworkX directed graph sanity check
    graph = nx.DiGraph()
    graph.add_edge("Supplier", "Factory", capacity=100)
    assert graph.number_of_nodes() == 2
    assert graph.number_of_edges() == 1

    # OR-Tools linear solver creation sanity check
    solver = pywraplp.Solver.CreateSolver("GLOP")
    assert solver is not None, "GLOP solver could not be initialized"
