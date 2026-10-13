# ResilienceSim 3D — Phase 7 Engineering & Architecture Report

## Enterprise Landing Page, Login, Branded Loading Experience, and Workspace Identity

**Project:** ResilienceSim 3D
**Phase:** 7 (Enterprise Landing, Authentication Experience, Pre-flight Diagnostics, and Workspace Identity)
**Status:** Completed & Fully Verified
**Date:** October 2026
**Stack:** React 19, TypeScript, Vite, Three.js, React Three Fiber, Drei, Lucide React, FastAPI, NetworkX, SimPy, Google OR-Tools

---

## 1. Executive Summary

Phase 7 elevates **ResilienceSim 3D** from a raw engineering simulation console into a cohesive, judge-ready, enterprise-grade decision support platform. Prior to this phase, the application opened directly into the simulation workbench without executive context, corporate positioning, user onboarding, or role-based identity.

Phase 7 introduces:
1. **Executive Enterprise Landing Page:** Clearly communicates the platform's mission (*"Anticipate Disruptions. Optimize Recovery. Protect Your Supply Chain."*), technical stack, 4 core value pillars, an interactive multi-tier supply chain SVG preview, 4-stage operational workflow, and benchmark scenario showcases.
2. **Official Enterprise Login Experience with Explicit Demo Mode:** A modern split-screen enterprise authentication interface featuring pre-configured one-click demo credentials (`demo.analyst@resiliencesim.internal`), clear transparency disclaimers, remember-me persistence, and responsive mobile adaptation.
3. **Branded Pre-Flight Workspace Loading Experience:** An animated transition screen displaying real-time engine initialization stages while executing live HTTP probes against the FastAPI backend (`/api/health` and `/api/scenarios`), complete with error recovery and offline fallbacks.
4. **Unified Workspace Navigation & User Identity Header:** Seamless integration into the existing digital twin dashboard featuring user avatar initials (`DO`), role badge, an explicit `[DEMO MODE]` safety tag, and one-click session logout / return to landing.
5. **Zero Feature Regressions:** All existing digital twin capabilities—including the 3D NetworkX WebGL canvas, SimPy discrete-event simulation, Google OR-Tools linear programming solver, Disruption Control Center, playback timeline, and 3-way KPI dashboard—remain 100% operational.

---

## 2. Architecture & Design Principles

### 2.1 Lightweight Client-Side Routing (`useNavigation.ts`)
To prevent heavy external dependency bloat and avoid routing issues on static file servers or Vite development servers, a robust URL hash router was implemented in `frontend/src/hooks/useNavigation.ts`:
- **Hash States:** `#landing` (default/empty), `#login`, `#loading`, and `#workspace`.
- **Browser History Support:** Responds to both `hashchange` and `popstate` events, enabling smooth browser Forward/Back navigation and direct deep linking.
- **Client-Side Auth Guard:** Accessing `#workspace` directly redirects to `#login` if no active session is detected.
- **Scroll Restoration:** Automatically scrolls to viewport top on view transitions.

### 2.2 Enterprise Visual Aesthetic & Compliance
- **Palette:** Built upon deep slate navy (`#0B132B`, `#0F1E36`), corporate ocean blue (`#1D4ED8`, `#2563EB`), and operational cyan/teal accents (`#0EA5E9`, `#06B6D4`). No non-enterprise neon or pink tones.
- **Typography & Surfaces:** Premium sans-serif typography (`Inter`), clean border contrasts (`#E2E8F0` / dark navy borders), subtle box-shadows, and structured CSS grids.
- **Motion Accessibility:** All CSS animations (ambient pulses, progress bars, SVG flow corridors) include `@media (prefers-reduced-motion: reduce)` overrides to ensure full accessibility compliance.

### 2.3 Transparent Demo Authentication Model
Per strict engineering requirements, the application does not fake server-side cryptography:
- **Client-Side Demo Session:** Clearly marks all created sessions with `isDemo: true`.
- **Storage Strategy:** Supports `localStorage` when "Remember this device" is selected and `sessionStorage` for single-session use.
- **Production Roadmap:** Clearly documented in the UI and codebase, showing where JWT tokens, HTTP-only cookies, and bcrypt/argon2 hashing will be connected.

---

## 3. Component & Service Inventory

| File Path | Type | Key Responsibilities |
|---|---|---|
| `frontend/src/types/auth.ts` | TypeScript Definitions | Defines `User`, `Session`, `LoginCredentials`, and `AppView` union types. |
| `frontend/src/services/authService.ts` | Service / State | Manages session storage, demo credential validation, active user profile retrieval, and logout. |
| `frontend/src/hooks/useNavigation.ts` | Custom React Hook | Hash-based router (`#landing`, `#login`, `#loading`, `#workspace`) with auth guard. |
| `frontend/src/components/landing/LandingPage.tsx` | View Component | Enterprise landing page with hero, interactive SVG preview, capability cards, workflow, and benchmarks. |
| `frontend/src/components/landing/LandingPage.css` | Stylesheet | Responsive styling, grid layouts, and animated flow tracks for the landing page. |
| `frontend/src/components/auth/LoginPage.tsx` | View Component | Split desktop login screen, demo pre-fill, one-click access button, forgot password dialog. |
| `frontend/src/components/auth/LoginPage.css` | Stylesheet | Enterprise styling for login cards, form inputs, status tags, and responsive breakpoints. |
| `frontend/src/components/loading/WorkspaceLoadingScreen.tsx` | View Component | Pre-flight diagnostics screen, progress bar, rotating status text, live backend API probes, offline bypass. |
| `frontend/src/components/loading/WorkspaceLoadingScreen.css` | Stylesheet | Glowing radial halo, progress meter, connection failure warning banners. |
| `frontend/src/components/NavigationHeader.tsx` | Header Component | Updated with company branding, user identity badge, demo indicator, and logout action. |
| `frontend/src/App.tsx` | Orchestrator | Seamlessly switches between Landing, Login, Loading, and the full Workspace Digital Twin. |

---

## 4. Verification & Validation Evidence

### 4.1 Frontend Build Verification
The React + TypeScript Vite build was executed in `frontend/`:
```bash
npm run build
```
**Result:**
- 2,477 modules transformed without errors or lint warnings.
- Zero TypeScript typecheck errors (`tsc -b` passed).
- Output bundles generated in `frontend/dist/`.

### 4.2 Backend Automated Test Suite
The full backend test suite was executed using the project Python virtual environment in `backend/`:
```powershell
.\venv\Scripts\python.exe -m pytest -v
```
**Result:**
- **63 tests collected, 63 tests passed, 0 failed** in 1.11 seconds.
- Validated modules:
  - `tests/test_api.py` (FastAPI endpoints)
  - `tests/test_domain_models.py` (Pydantic models, conservation constraints)
  - `tests/test_graph_builder.py` (NetworkX topological builder, 3D coordinate mapping)
  - `tests/test_scenarios_api.py` (Electronics & Pharma benchmark catalogs)
  - `tests/test_simulation.py` (SimPy discrete-event simulation mechanics)
  - `tests/test_optimization.py` (Google OR-Tools GLOP solver, rerouting constraints)
  - `tests/test_e2e_resilience.py` (Full 3-way evaluation invariants & regression tests)

---

## 5. Security & Production Roadmap

For future enterprise production deployments, the following server-side authentication roadmap is outlined:

1. **Server-Side Password Hashing:** Implement `passlib` with Argon2id or bcrypt (work factor $\ge 12$) inside the FastAPI backend.
2. **Stateless JWT with Refresh Rotation:** Issue short-lived access tokens (15 minutes) and HTTP-only, SameSite=Strict refresh cookies (7 days).
3. **Enterprise Single Sign-On (SSO):** Integrate OAuth2 / OpenID Connect (OIDC) endpoints for Okta, Microsoft Entra ID (Azure AD), and Google Workspace.
4. **Role-Based Access Control (RBAC):** Restrict disruption staging and solver execution based on user permissions (`Viewer`, `SupplyChainAnalyst`, `ExecutiveAdmin`).
5. **Rate Limiting & Audit Logging:** Protect the login and solver endpoints with IP-based rate limiting (`slowapi`) and immutable audit logs.

---

## 6. How to Run and Inspect the Application

### 6.1 Backend API Server
Open PowerShell in the workspace root:
```powershell
cd "C:\Users\Dhanush\OneDrive\Desktop\ai supply chain resilience simulator\backend"
.\venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```
- Interactive Swagger UI: `http://127.0.0.1:8000/docs`
- Health check: `http://127.0.0.1:8000/api/health`

### 6.2 Frontend Client
In a second PowerShell terminal:
```powershell
cd "C:\Users\Dhanush\OneDrive\Desktop\ai supply chain resilience simulator\frontend"
npm run dev
```
- Open browser at: `http://localhost:5173/`

### 6.3 Demo Login Credentials
- **Email / Username:** `demo.analyst@resiliencesim.internal`
- **Password:** `Resilience2026!`
- Or simply click **"One-Click Demo Access"** on the login page.
