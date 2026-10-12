/**
 * API client for ResilienceSim 3D backend.
 */
import type {
  ComparisonRequest,
  ComparisonResult,
  GraphResponse,
  HealthStatus,
  OptimizationRecoveryResponse,
  OptimizationRequest,
  Scenario,
  ScenarioSummary,
  SimulationRequest,
  SimulationResult,
} from '../types/models';

const API_BASE_URL = '/api';

export class ApiError extends Error {
  status?: number;
  details?: unknown;

  constructor(message: string, status?: number, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      ...options,
    });

    if (!response.ok) {
      let detailMsg = `HTTP ${response.status}: ${response.statusText}`;
      try {
        const errorJson = await response.json();
        if (errorJson && errorJson.detail) {
          detailMsg = errorJson.detail;
        }
      } catch {
        // Fallback to status text
      }
      throw new ApiError(detailMsg, response.status);
    }

    const data: T = await response.json();
    return data;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    const message = error instanceof Error ? error.message : 'Unknown network error';
    throw new ApiError(`Failed to fetch from ${url}: ${message}`);
  }
}

/**
 * Checks the health status of the FastAPI backend.
 */
export async function checkBackendHealth(): Promise<HealthStatus> {
  return request<HealthStatus>('/health');
}

/**
 * Fetches all available benchmark supply chain scenarios.
 */
export async function listScenarios(): Promise<ScenarioSummary[]> {
  return request<ScenarioSummary[]>('/scenarios');
}

/**
 * Fetches complete scenario definition by scenario ID.
 */
export async function getScenario(scenarioId: string): Promise<Scenario> {
  return request<Scenario>(`/scenarios/${encodeURIComponent(scenarioId)}`);
}

/**
 * Fetches NetworkX-processed graph nodes, edges, and connectivity diagnostics.
 */
export async function getScenarioGraph(scenarioId: string): Promise<GraphResponse> {
  return request<GraphResponse>(`/scenarios/${encodeURIComponent(scenarioId)}/graph`);
}

/**
 * Runs a discrete-event SimPy simulation run (baseline or disrupted).
 */
export async function runSimulation(req: SimulationRequest): Promise<SimulationResult> {
  return request<SimulationResult>('/simulation/run', {
    method: 'POST',
    body: JSON.stringify(req),
  });
}

/**
 * Compares healthy baseline against counterfactual disrupted simulation.
 */
export async function compareSimulation(req: ComparisonRequest): Promise<ComparisonResult> {
  return request<ComparisonResult>('/simulation/compare', {
    method: 'POST',
    body: JSON.stringify(req),
  });
}

/**
 * Solves constrained recovery optimization with Google OR-Tools,
 * re-simulates in SimPy, and returns 3-way evaluation metrics.
 */
export async function optimizeRecovery(
  req: OptimizationRequest
): Promise<OptimizationRecoveryResponse> {
  return request<OptimizationRecoveryResponse>('/optimization/recover', {
    method: 'POST',
    body: JSON.stringify(req),
  });
}

