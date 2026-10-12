"""API package."""
from app.api.routes_optimization import router as optimization_router
from app.api.routes_scenarios import router as scenarios_router
from app.api.routes_simulation import router as simulation_router

__all__ = ["scenarios_router", "simulation_router", "optimization_router"]
