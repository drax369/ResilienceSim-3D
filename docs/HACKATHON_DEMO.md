# ResilienceSim 3D: Hackathon Demonstration & Judge Guide

## 1. Project Overview & Motivation

Global supply chains face sudden shocks: geopolitical corridor closures, maritime blockades, factory blackouts, component lead time spikes, and downstream hospital demand surges. 

Traditional enterprise supply chain dashboards are **static post-mortems**—they display past inventory without showing how disruptions ripple through time or whether recovery decisions are mathematically feasible.

**ResilienceSim 3D** is an interactive supply chain resilience digital twin and decision-support prototype. It connects:
1. **NetworkX Graph Topology**: Multi-tier directed graph data structures with deterministic 3D spatial positioning.
2. **SimPy Discrete-Event Simulation Engine**: Temporal simulation modeling daily material dispatch, conservation of flow, inventory balances, and transit latencies.
3. **Google OR-Tools Mathematical Optimization**: A time-expanded linear programming (LP) solver using the GLOP engine to calculate optimal flow rerouting and recovery dispatches.
4. **Three.js & React Three Fiber Command Center**: A clean, responsive 3D visualization showing physical topology, animated in-flight shipments, interactive disruption controls, time-series analytics, and recovery explainability.

> **Project Status Disclosure**: ResilienceSim 3D is a functional simulation and decision-support prototype. It is built for benchmark testing and evaluation rather than live operational deployment or direct ERP/SAP production integration.

---

## 2. System Architecture & Computational Pipeline

```
                                  +------------------------------------+
                                  |     Vite / React 19 Frontend       |
                                  |  - Three.js / R3F 3D Canvas        |
                                  |  - Disruption Control Center       |
                                  |  - Simulation Playback Scrubber    |
                                  |  - 3-Way Comparative KPI Dashboard |
                                  +-----------------+------------------+
                                                    | JSON REST API
                                                    v
                                  +------------------------------------+
                                  |       FastAPI Python Backend       |
                                  +-----------------+------------------+
                                                    |
            +---------------------------------------+---------------------------------------+
            |                                       |                                       |
            v                                       v                                       v
+-----------------------+               +-----------------------+               +-----------------------+
|  NetworkX Core Model  |               |  SimPy Event Engine   |               |   Google OR-Tools     |
| - Multi-tier graphs   |               | - Clock-driven events |               | - Time-expanded LP    |
| - Spatial coordinates |               | - Lead time timeouts  |               | - GLOP linear solver  |
| - Connectivity audits |               | - Inventory balances  |               | - Minimum penalty obj |
+-----------------------+               +-----------------------+               +-----------------------+
```

### The 3 Evaluated States
1. **State 1: Baseline (Healthy)** — The undisturbed network operating under nominal supplier capacities and transit lead times.
2. **State 2: Unmitigated Disruption** — The network subjected to user-injected shocks (e.g., corridor closures, facility outages) without corrective intervention, exposing delivery shortfalls and SLA decay.
3. **State 3: OR-Tools Recovered** — The time-expanded LP solves continuous flow variables across all eligible alternative corridors, minimizing unmet demand penalties. The recovery plan is then ingested by SimPy and re-simulated to measure physical execution outcomes.

---

## 3. Mathematical Optimization Formulation

The recovery optimizer formulates a multi-period time-expanded flow problem solved via Google OR-Tools GLOP.

### Decision Variables
- $x_{r, t} \ge 0$: Material quantity dispatched on route $r$ at discrete period $t$.
- $I_{f, t} \ge 0$: Conserved inventory stored at facility $f$ at the end of period $t$.
- $s_{ret, t} \ge 0$: Unmet customer demand (shortage) at retailer node $ret$ at period $t$.
- $d_{ret, t} \ge 0$: Quantity delivered to retailer node $ret$ at period $t$.

### Objective Function
$$\min \sum_{r, t} c_r \cdot x_{r, t} + \sum_{ret, t} P_{\text{shortage}} \cdot s_{ret, t}$$
Where:
- $c_r$ is the transport cost per unit on route $r$.
- $P_{\text{shortage}} = \$1,000/\text{unit}$ represents the heavy penalty for unfulfilled demand.
- The solver prioritizes fulfilling demand over transport costs, but chooses the most cost-efficient feasible alternative corridor among available options.

### Key Constraints
1. **Capacity & Disruption Bounds**:
   $$0 \le x_{r, t} \le \text{Capacity}_r \cdot (1 - \text{DisruptionImpact}_{r, t})$$
2. **Facility Processing Limits**:
   $$\sum_{r \in \text{Out}(f)} x_{r, t} \le \text{ProcessingCapacity}_f \cdot (1 - \text{FacilityOutage}_{f, t})$$
3. **Flow Conservation & Lead-Time Delays**:
   $$I_{f, t} = I_{f, t-1} + \sum_{r \in \text{In}(f)} x_{r, t - L_r} - \sum_{r \in \text{Out}(f)} x_{r, t}$$
   Where $L_r$ is the integer transit lead time of route $r$. Material dispatched at period $t - L_r$ arrives into destination inventory at period $t$.

---

## 4. Reproducible 3–5 Minute Demonstration Script

### Act 1: Network Topology & Baseline Inspection (1 Minute)
1. **Launch the Application**: Open `http://localhost:5173` in your browser.
2. **Inspect the 3D Network**:
   - Point out the 4 tiers: **Suppliers** (Blue cylinders, Tier 0), **Factories** (Indigo cubes, Tier 1), **Distribution Centers** (Teal wide hubs, Tier 2), and **Retailers** (Green octahedrons, Tier 3).
   - Use the mouse to rotate, pan, and zoom. Click **Reset Camera** in the 3D overlay controls.
   - Click **Rotterdam European Gateway DC** (`dc_rotterdam`) to open the **Element Inspector** dock on the right. Note its initial stock (60 units), processing capacity (500 units/day), and connected transport lanes.
3. **Execute Baseline Simulation**:
   - In the workflow stepper, click **Run Discrete Simulation** (with 0 staged disruptions).
   - The KPI dashboard loads **State 1: Baseline** showing nominal service level (~37–100% depending on horizon pipeline lag), delivered volume, and zero unmet demand backlog.

### Act 2: Injecting Disruptions & Unmitigated Impact (1.5 Minutes)
1. **Stage Benchmark Disruption**:
   - In the right-hand **Disruption Control Center**, click the quick scenario preset: **Strait Blockade + Cap Cut**.
   - This stages 2 concurrent shocks:
     - Route Closure on `r_singapore_rotterdam` (Malacca Strait maritime corridor, $t=2 \dots 7$).
     - Capacity Throttling on `fac_shenzhen` (60% cut, $t=3 \dots 7$).
   - Point out that the 3D scene immediately renders red highlight rings around the affected facility and a red tube on the closed maritime corridor.
2. **Simulate the Disrupted Network**:
   - Click **Run Discrete Simulation**.
   - Point out **State 2: Unmitigated Disruption** on the KPI scorecard:
     - Service Level drops significantly.
     - Unmet Shortage increases.
   - Use the **Timeline Scrubber** below the 3D canvas:
     - Drag the slider to $t = 3$. Point out the active shock badge showing active disruptions at period 3.
     - Click **Play** at $1\times$ or $2\times$ speed to observe dynamic deliveries and shipment flow pulses.

### Act 3: Google OR-Tools Recovery & 3-Way Evaluation (1.5 Minutes)
1. **Solve Constrained Recovery**:
   - Click the prominent button: **Optimize Recovery (Google OR-Tools)**.
   - In ~5–10 milliseconds, the GLOP solver formulates the time-expanded LP, solves the continuous flow allocation, and passes the dispatch plan to SimPy for physical re-simulation.
2. **Inspect State 3 Scorecard**:
   - Note the **Service Level Recovery** (+percentage points gain vs Disrupted).
   - Point out the **Operational Trade-Off**: Notice that transportation costs increase modestly because the optimizer diverted cargo away from the blocked sea route into alternative corridors (e.g., via Chicago or inter-DC links).
3. **Examine Explainability**:
   - Scroll down to the **OR-Tools Recovery Optimization & Explainability** panel.
   - Point out the **Grounding Pillars**: Optimizer proposal $\rightarrow$ SimPy physical execution $\rightarrow$ Measurable delivered units.
   - Review the **Actions Table**: Shows exact periods, rerouted corridors, and operational rationale.
   - Check the **SimPy Execution Deviations**: Confirms whether 100% of planned dispatches were physically executable within dynamic inventory bounds.

---

## 5. Benchmark Scenarios Summary

| Scenario ID | Name | Facilities | Routes | Horizon | Key Bottlenecks / Alternate Corridors |
|---|---|---|---|---|---|
| `global_electronics` | Global High-Tech Electronics | 13 nodes (3 tiers) | 18 routes | 14 days | Multi-sourcing from Taiwan, Korea, Japan; alternative air corridors via Chicago and Rotterdam. |
| `pharma_cold_chain` | Cold-Chain Pharmaceutical | 11 nodes (3 tiers) | 16 routes | 21 days | Deep-freeze biologics (-70°C); alternative emergency routes from Memphis to European hospitals. |

---

## 6. How to Run Locally on Windows

### Prerequisites
- Python 3.11+
- Node.js 18+ and npm

### Terminal 1: Python FastAPI Backend
```powershell
cd "C:\Users\Dhanush\OneDrive\Desktop\ai supply chain resilience simulator\backend"
.\venv\Scripts\Activate.ps1
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```
- Health Check: [http://127.0.0.1:8000/api/health](http://127.0.0.1:8000/api/health)
- Interactive API Documentation: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)

### Terminal 2: React Vite Frontend
```powershell
cd "C:\Users\Dhanush\OneDrive\Desktop\ai supply chain resilience simulator\frontend"
npm run dev
```
- Web Application: [http://localhost:5173](http://localhost:5173)

---

## 7. Troubleshooting Common Local Issues

| Symptom | Cause | Solution |
|---|---|---|
| Frontend shows red "Backend Offline" badge | FastAPI server is not running on port 8000. | Start Terminal 1 using `uvicorn app.main:app --reload`. |
| Port 8000 or 5173 already in use | Another application or previous zombie process holds the port. | Run `netstat -ano \| findstr :8000` and `taskkill /F /PID <pid>`. |
| PowerShell script execution disabled error | Windows ExecutionPolicy prevents running `Activate.ps1`. | Run `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned` in PowerShell. |
| 3D canvas renders black or blank | WebGL acceleration disabled in browser. | Enable Hardware Acceleration in Chrome/Edge settings (`chrome://settings/system`). |
