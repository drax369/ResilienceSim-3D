# Contributing to ResilienceSim 3D

Thank you for contributing to **ResilienceSim 3D**! This guide outlines our development workflow, standards, testing protocols, and branch conventions to ensure smooth collaboration.

---

## 🛠️ Required Development Environment

Before contributing, ensure your development workstation meets the following prerequisites:

- **Operating System:** Windows 10/11 (or macOS / Linux with Bash equivalents)
- **Shell:** Windows PowerShell 5.1+ or PowerShell 7+
- **Python:** Python 3.11+ (verified on Python 3.11.9)
  - Ensure the Python Launcher (`py`) or `python` is accessible in your terminal.
- **Node.js & npm:** Node.js v18.0.0+ (verified on v24.14.1) and npm 9.0.0+ (verified on 11.11.0)
- **Version Control:** Git 2.30+
- **Recommended IDE:** Visual Studio Code with the following extensions:
  - Python (`ms-python.python`)
  - Pylance (`ms-python.vscode-pylance`)
  - ESLint / Oxlint
  - Even Better TOML / Markdown All in One

---

## 🚀 Local Development Setup

To run both backend and frontend concurrently:

### 1. Terminal 1 — FastAPI Backend

```powershell
# Navigate to backend directory
cd "backend"

# Create a virtual environment (if not already created)
py -3.11 -m venv venv
# Alternatively: python -m venv venv

# Activate the virtual environment
.\venv\Scripts\Activate.ps1
# If PowerShell script execution policy blocks activation, run:
# Set-ExecutionPolicy -Scope Process -ExecutionPolicy RemoteSigned

# Install required packages
pip install -r requirements.txt

# Start the FastAPI server with auto-reload
uvicorn app.main:app --reload --port 8000
```

Verify backend health at: [http://127.0.0.1:8000/api/health](http://127.0.0.1:8000/api/health)
Interactive OpenAPI documentation: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)

### 2. Terminal 2 — React + Vite Frontend

```powershell
# Navigate to frontend directory
cd "frontend"

# Install Node dependencies
npm install

# Start Vite development server
npm run dev
```

Open your browser at: [http://localhost:5173](http://localhost:5173)
The Vite dev server automatically proxies `/api` calls to `http://127.0.0.1:8000`.

---

## 🧪 Verification & Quality Standards

Before opening any Pull Request or committing changes, all automated tests and type checks must pass.

### Running Backend Tests
From the `backend` directory with the virtual environment activated:

```powershell
# Run the complete test suite
pytest -v

# Run a specific test module
pytest tests/test_e2e_resilience.py -v
```

*Criteria:* All 63 backend tests must pass with 0 failures.

### Running Frontend Validation
From the `frontend` directory:

```powershell
# Type check and production build
npm run build

# Run Oxlint linter
npm run lint
```

*Criteria:* Zero TypeScript compilation errors and zero lint errors.

---

## 🌿 Branch Naming & Commit Conventions

### Branch Naming Convention
Create a focused branch from `main`:

```bash
git checkout -b <type>/<short-description>
```

Accepted `<type>` prefixes:
- `feat/` — A new user-facing feature or algorithmic extension (e.g., `feat/stochastic-lead-times`)
- `fix/` — A bug fix in simulation, optimization, or UI (e.g., `fix/retailer-inventory-balance`)
- `docs/` — Documentation updates, README refinements, guides (e.g., `docs/add-api-examples`)
- `refactor/` — Code cleanup without altering behavior (e.g., `refactor/threejs-scene-cleanup`)
- `test/` — Adding or refining test suites (e.g., `test/multi-tier-bottleneck-cases`)
- `perf/` — Performance tuning for simulation or WebGL rendering (e.g., `perf/instanced-mesh-rendering`)

### Commit Message Format
We follow the [Conventional Commits](https://www.conventionalcommits.org/) standard:

```text
<type>(<scope>): <short imperative description>

[optional body explaining rationale and constraints]
```

Examples:
- `feat(optimization): introduce multi-echelon safety stock constraint`
- `fix(simpy): prevent negative inventory on simultaneous disruption trigger`
- `docs(readme): add Windows PowerShell installation walkthrough`

---

## 🛡️ Git & Security Safety Rules

1. **Never commit secrets:** Never commit API keys, private passwords, authorization tokens, or internal credentials.
2. **Never commit virtual environments or node modules:** Ensure `backend/venv` and `frontend/node_modules` remain untracked.
3. **No hardcoded paths:** Avoid absolute filesystem paths (e.g., `C:\Users\...`) in source files or documentation. Use relative paths or configuration settings.
4. **Conservation of Flow:** If modifying simulation or optimizer code, ensure material conservation invariants hold across all periods ($I_t = I_{t-1} + \text{Inflow}_t - \text{Outflow}_t$). Never hardcode metrics or fabricate artificial recovery throughput.

---

## 🐛 Bug Reports & Feature Proposals

- **Bug Reports:** When filing an issue or reporting a simulation mismatch, include:
  1. Selected scenario (`global_electronics` or `pharma_cold_chain`)
  2. Staged disruptions (entity ID, type, start period, magnitude, duration)
  3. Baseline vs Disrupted vs Recovered metric numbers
  4. Terminal stack trace or browser console errors
- **Feature Requests:** Detail the supply-chain operations rationale, affected equations, and test criteria before proposing major architectural shifts.
