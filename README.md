# Apex Agent — Autonomous Agentic Coding & Debugging Platform

<div align="center">

[![Vercel Deployment](https://img.shields.io/badge/Vercel-Serverless_Ready-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://vercel.com)
[![Groq Powered](https://img.shields.io/badge/Powered_by-Groq_API-f55036?style=for-the-badge&logo=fastapi&logoColor=white)](https://groq.com/)
[![FastAPI](https://img.shields.io/badge/Backend-FastAPI_Python_3.11-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React + Vite](https://img.shields.io/badge/Frontend-React_18_+_Vite-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://vitejs.dev)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](LICENSE)

<br />

**Apex Agent** is an state-of-the-art autonomous AI coding & debugging assistant designed to automatically inspect codebases, execute unit tests in isolated sandboxes, analyze tracebacks, auto-correct code errors, and verify fixes in real-time via Server-Sent Events (SSE).

[Deploy to Vercel](#vercel-deployment-guide) • [Features](#key-features) • [Architecture](#architecture) • [Local Setup](#local-development-setup) • [API Reference](#api-endpoints)

</div>

---

## Overview

Traditional AI coding assistants suggest raw snippets, leaving developers to manually test, debug tracebacks, and copy-paste code back and forth. **Apex Agent** eliminates this manual friction by implementing a full **ReAct (Reasoning + Acting)** autonomous loop:

```
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│   Agent Thought │ ───► │    Tool Call    │ ───► │ Sandbox Execution│ ───► │ Self-Correction │
│(openai/gpt-oss) │      │  (Read/Write)   │      │ (Pytest/Run)    │      │  & Verification │
└─────────────────┘      └─────────────────┘      └─────────────────┘      └─────────────────┘
```

1. **Reason**: Analyzes the problem prompt and inspects workspace code structure.
2. **Act**: Writes/edits code files or executes pytest / custom validation scripts.
3. **Observe**: Captures stdout, stderr, and Python stack tracebacks.
4. **Self-Correct & Verify**: Automatically adjusts implementation until all test suites pass clean.

---

## Key Features

- **Groq LPU Engine**: Leverages high-speed Groq inference with the `openai/gpt-oss-20b` model for deep multi-turn code reasoning and function calling.
- **Serverless-Native Architecture**: Fully configured for a single Vercel deployment: a Vite SPA and a FastAPI serverless service share one domain, with `/api/*` routed to FastAPI.
- **Real-Time Event Streaming (SSE)**: Streams step-by-step agent trajectories, tool invocations, stdout logs, and status updates directly to the UI.
- **Isolated Execution Sandbox**: Safely run Python scripts, unit test suites (pytest), search code patterns, and modify workspace files.
- **Benchmark Scenarios**: Built-in debugging benchmarks ranging from algorithmic edge cases (Binary Search) to corrupted log processing pipelines and async HTTP backoff retries.
- **Scripted Demo (no API key)**: Without an API key, the platform replays a pre-written fix for built-in scenarios while running real pytest in the sandbox. Add a Groq API key to activate the live autonomous agent.
- **Custom Workspace Importer**: Upload and debug your own multi-file Python projects directly inside the web interface.
- **Secure & Flexible API Keys**: Bring your own `GROQ_API_KEY` via `X-API-Key` HTTP headers or use backend environment variables securely. Keys are never logged or echoed.

---

## Architecture

Apex Agent combines a modern React client with an asynchronous FastAPI engine, deployable either as a serverless monorepo on Vercel or with a persistent containerized backend on platforms like Railway, Render, or Fly.io.

```mermaid
flowchart TD
    subgraph Client ["Frontend (React 18 + Vite + Tailwind)"]
        UI["User Interface & Workspace Viewer"]
        TS["Trajectory Stream Visualizer (Demo/Live Badge)"]
        API_CLIENT["API Client (SSE Reader, VITE_API_BASE_URL)"]
    end

    subgraph Hosting ["Deployment Tier (Vercel Serverless OR Dedicated Docker)"]
        GATEWAY["HTTP Gateway / Reverse Proxy"]
        AUTH_RL["API Protection (Rate Limiting, CORS, X-Access-Token)"]
    end

    subgraph Backend ["Backend Engine (FastAPI + Async Python 3.11)"]
        CORE["ApexAgentEngine (_react_loop, Budget & Retry)"]
        SANDBOX["SandboxEnvironment (POSIX rlimits, bwrap/unshare, pgid kill)"]
        SCENARIOS["Benchmark Scenarios Loader"]
    end

    subgraph Groq ["Groq Cloud Inference"]
        LLM["openai/gpt-oss-20b (AsyncGroq Client)"]
    end

    UI -->|1. Run scenario or custom workspace| API_CLIENT
    API_CLIENT -->|2. POST /api/run-agent with X-API-Key| GATEWAY
    GATEWAY --> AUTH_RL
    AUTH_RL --> CORE
    CORE <-->|3. Async Tool Calling ReAct Loop| LLM
    CORE <-->|4. Threaded Sandbox Exec & Pytest| SANDBOX
    CORE -->|5. Real-Time SSE Stream (agent_start, tool_call, observation)| API_CLIENT
    API_CLIENT -->|6. Render Live Trajectory & Code Updates| TS
```

---

## Project Structure

```
apex-agent/
├── backend/
│   ├── agent/               # Autonomous ReAct Agent core & tool definitions
│   │   ├── core.py          # ApexAgentEngine (Groq client & event stream)
│   │   └── tools.py         # Agent tool schema & function execution
│   ├── sandbox/             # Subprocess sandbox & isolated runner
│   │   └── runner.py        # SandboxEnvironment for code & test execution
│   ├── scenarios/           # Benchmark scenarios suite
│   │   └── loader.py        # Pre-configured test scenarios
│   ├── main.py              # FastAPI application & route definitions
│   └── requirements.txt     # Backend Python dependencies
├── frontend/
│   ├── src/                 # React frontend application source
│   │   ├── components/      # UI Components (TrajectoryStream, WorkspaceViewer, etc.)
│   │   ├── api.js           # API client & SSE stream listener
│   │   └── App.jsx          # Main dashboard view
│   ├── package.json         # Frontend Node.js dependencies
│   └── vite.config.js       # Vite configuration & proxy settings
├── vercel.json              # Vercel deployment configuration
├── .python-version           # Python runtime selected for Vercel
├── requirements.txt         # Root Python requirements for Vercel build
├── package.json             # Root monorepo scripts & metadata
└── README.md                # Project documentation
```

---

## Vercel Deployment Guide

The included `vercel.json` uses Vercel Services: Vite is built from `frontend/`,
FastAPI is built from `backend/`, and both are deployed to the same domain.
Requests to `/api/*` reach FastAPI without a separate backend URL or CORS setup.

### Option A: 1-Click Deployment (Recommended)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FAditya-padale%2Fapex-agent&env=GROQ_API_KEY)

1. Click the **Deploy with Vercel** button above.
2. Link your GitHub repository.
3. In the **Environment Variables** section, configure:
   - `GROQ_API_KEY`: Your Groq API Key ([Get an API key here](https://console.groq.com/keys)).
   - `MAX_RUN_SECONDS=50`: Keeps the agent below the configured 60-second
     serverless function duration.
   - `ALLOW_CODE_EXECUTION=false`: Required for a public deployment. The
     built-in scenarios still work; do not execute user-supplied projects in a
     Vercel Function.
4. Click **Deploy**. Vercel builds and deploys the frontend and FastAPI service together.

### Option B: Deploy via Vercel CLI

```bash
# 1. Install Vercel CLI
npm i -g vercel

# 2. Login to Vercel
vercel login

# 3. Start both services locally with Vercel routing (optional)
vercel dev -L

# 4. Deploy to production
vercel --prod
```

> [!NOTE]
> Add `GROQ_API_KEY`, `MAX_RUN_SECONDS`, and `ALLOW_CODE_EXECUTION` under
> **Project Settings > Environment Variables**, then redeploy. Keep secrets
> server-side; never use a `VITE_`-prefixed variable for them.

> [!WARNING]
> **Serverless limitations**: The FastAPI service is capped at 60 seconds per
> request and has an ephemeral filesystem. SSE is supported, but a long agent
> trajectory may end at the timeout. This project defaults agent runs to 50
> seconds so it can send a clean completion event first. For untrusted code or
> longer jobs, use a dedicated sandbox/worker service instead of enabling code
> execution in Vercel.

---

## Dedicated Backend Deployment (Railway, Render, Fly.io, Docker)

To run without serverless timeout constraints, deploy the backend container on a persistent platform (such as Railway, Render, Fly.io, or any Docker host) while keeping the React frontend hosted on Vercel:

1. **Build and run the Docker image**:
   ```bash
   docker build -t apex-agent-backend .
   docker run -p 8000:8000 \
     -e GROQ_API_KEY="your_key" \
     -e ALLOW_CODE_EXECUTION="false" \
     -e CORS_ORIGINS="https://your-frontend.vercel.app" \
     apex-agent-backend
   ```
   The included `Dockerfile` uses `python:3.11-slim`, installs system dependencies (including `bubblewrap` for process isolation), and runs as a non-root `apexuser`.

2. **Connect the Vercel frontend**:
   In your Vercel project settings, set:
   ```env
   VITE_API_BASE_URL=https://your-backend-domain.com/api
   ```
   The frontend API client will direct all requests to your dedicated backend instead of local serverless routes.

---

## Local Development Setup

### Prerequisites

- **Python**: `3.11`
- **Node.js**: `18.0` or higher
- **Groq API Key**: From [Groq Console](https://console.groq.com/keys)

### 1. Clone Repository

```bash
git clone https://github.com/Aditya-padale/apex-agent.git
cd apex-agent
```

### 2. Configure Environment Variables

Create a `.env` file inside the `backend` directory (or set it in your environment):

```bash
cp backend/.env.example backend/.env
```

#### Environment Variables Reference

| Variable | Default | Description |
| :--- | :--- | :--- |
| `GROQ_API_KEY` | *(None)* | Groq API key. Required for autonomous tool use and live fixes. Can also be supplied per-request via `X-API-Key` header. |
| `ALLOW_CODE_EXECUTION` | `false` | When `false`, endpoints running user-imported workspace code return HTTP 403 Forbidden. Keep `false` on public deployments. |
| `ALLOW_PACKAGE_INSTALL` | `false` | When `false`, blocks `pip install`, `npm install`, and `yarn add` commands inside the sandbox. |
| `CORS_ORIGINS` | `http://localhost:5173` | Comma-separated list of allowed web origins for CORS headers (`allow_credentials=False`). |
| `APEX_ACCESS_TOKEN` | *(None)* | Optional server secret. When configured, callers must pass this exact token in the `X-Access-Token` header. |
| `MAX_RUN_SECONDS` | `50` | Hard wall-clock budget in seconds for an agent run before emitting a clean timeout event. Keep at `50` or less on Vercel. |
| `RATE_LIMIT_RPM` | `5` | In-memory sliding-window per-IP rate limit on `/api/run-agent` and `/api/test-sandbox`. Set to `0` to disable. |
| `VITE_API_BASE_URL` | `/api` | Frontend API base URL. Configure when deploying backend on a separate domain (e.g. Railway/Render). |

### 3. Backend Setup

```bash
# Create and activate virtual environment
python3 -m venv venv
source venv/bin/activate   # On Windows: venv\Scripts\activate

# Install production dependencies
pip install -r requirements.txt

# Start backend FastAPI server (Port 8000)
npm run dev:backend
```

### 4. Frontend Setup

In a new terminal window:

```bash
# Navigate to frontend and install dependencies
cd frontend
npm install

# Start Vite development server (Port 5173)
npm run dev
```

Open your browser and navigate to `http://localhost:5173`.

### 5. Running Tests

#### Backend Test Suite (Pytest)

Install the development dependencies and run pytest from the repository root:

```bash
# Install test requirements
pip install -r backend/requirements-dev.txt

# Execute test suite
pytest
```

The 33 automated tests cover:
- **Workspace Validation**: Path traversal attempts, absolute paths, sensitive file patterns (`.env`, `.pem`, `.key`), file size limits, and file count limits.
- **Sandbox Security & Flags**: Allowed compiler/runtime commands, blocked inline code execution flags (`-c`, `-e`, `-p`, `--print`, `--eval`), combined short flags (`-Sc`), network servers (`-m http.server`), package installs, and symlinks pointing outside the workspace.
- **Benchmark Scenarios**: Scenario metadata integrity, loader resolution, and fallback handling.
- **FastAPI Endpoints**: Health checks, scenario listings, 403 responses when `ALLOW_CODE_EXECUTION=false`, and `X-Access-Token` auth gating.
- **Autonomous Agent Loop**: Simulated ReAct loop with fake Groq async client verifying event ordering (`agent_start` → `thought` → `tool_call` → `observation` → `finished`), turn limits, and wall-clock timeout budgets.

#### Frontend Build & Type Check

```bash
cd frontend
npm ci
npm run build
```

---

## API Endpoints

Apex Agent exposes clean REST and SSE streaming endpoints:

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Health check & service status verification. |
| `GET` | `/api/scenarios` | List all available benchmark scenarios. |
| `GET` | `/api/scenarios/{id}` | Fetch details & code for a specific benchmark scenario. |
| `POST` | `/api/run-agent` | **SSE Stream**: Execute ReAct agent loop for a scenario or custom workspace. |
| `POST` | `/api/test-sandbox` | Execute single python scripts or pytest commands directly in the sandbox. |

### SSE Event Stream Payload (`POST /api/run-agent`)

Example JSON request body:

```json
{
  "scenario_id": "scenario_1_binary_search",
  "project_name": "Binary Search Debugging",
  "custom_prompt": "Fix the IndexError and edge case bug in binary_search.py",
  "model_name": "openai/gpt-oss-20b",
  "max_turns": 12
}
```

---

## Benchmark Scenarios

Apex Agent includes pre-built benchmark scenarios to test autonomous debugging capabilities:

| Scenario | Difficulty | Description | Target Fix |
| :--- | :---: | :--- | :--- |
| **Binary Search Algorithm** | `Easy` | Fixing `IndexError` and off-by-one edge cases in empty arrays. | Correct bounds (`high = len(arr) - 1`), prevent infinite loops. |
| **Log Parser Pipeline** | `Medium` | Crashes with `TypeError` on null response times and malformed JSON lines. | Add defensive JSON decoding, null checks, and error aggregation. |
| **Exponential Backoff Client** | `Hard` | Implement an async HTTP retry client with backoff delay. | Write retry mechanism with delay calculation `(initial * 2^attempt)`. |

---

## Security Model & Limitations

> [!CAUTION]
> **Subprocess isolation is NOT a security boundary.**
> The built-in sandbox applies POSIX resource limits, command allowlisting, and namespace wrapping (when available), but it is designed only to mitigate accidental damage (such as disk fills or runaway test loops). It cannot protect against a determined attacker executing arbitrary malicious code. For untrusted code execution, use a dedicated virtual machine or gVisor / Firecracker container.

### Key Security Controls

1. **`ALLOW_CODE_EXECUTION` Flag (Default: `false`)**:
   - Public deployments should keep `ALLOW_CODE_EXECUTION=false`.
   - When `false`, all endpoints that run user-supplied code (`workspace_files` on `/api/run-agent` and `/api/test-sandbox`) immediately return HTTP 403 Forbidden.
   - Built-in benchmark scenarios remain fully functional because their initial files and test suites are statically known and safe.

2. **POSIX Resource Limits (`preexec_fn`)**:
   - Child processes run in isolated process groups (`start_new_session=True`).
   - Hard limits are applied on process creation: CPU time (`RLIMIT_CPU`: 120s), memory (`RLIMIT_AS`: 512MB), process count (`RLIMIT_NPROC`: 64), max file size (`RLIMIT_FSIZE`: 50MB), and open descriptors (`RLIMIT_NOFILE`: 256).
   - If a command times out, the entire process group is terminated with `os.killpg(pid, SIGKILL)`.

3. **Filesystem Boundary & Symlink Traversal Protection**:
   - All workspace paths are resolved with `pathlib.Path.resolve()` and verified against `workspace_dir.relative_to(...)`.
   - Symlinks inside the workspace pointing outside the temporary directory are rejected with `PermissionError`.
   - Sensitive credential files (`.env`, `.pem`, `.key`, `.p12`) are blocked from workspace imports.

4. **Command Allowlist & Flag Filtering**:
   - Commands are parsed via `shlex.split` and executed without a shell (`shell=False`).
   - Only pre-approved developer binaries (`python`, `pytest`, `node`, `npm`, `cargo`, `go`, etc.) can be called.
   - Inline execution flags (`-c`, `-e`, `-p`, `--print`, `--eval`, and combined short flags like `-Sc`) are strictly rejected.
   - Network servers (`python -m http.server`, `SimpleHTTPServer`) are blocked.
   - Package managers (`pip`, `npm`, `yarn`) cannot install packages unless `ALLOW_PACKAGE_INSTALL=true`.

5. **Namespace Isolation (`bwrap` / `unshare`)**:
   - If `bwrap` or `unshare` is present and functional, commands run with read-only root mounts, isolated PID/network namespaces, and a temporary writable workspace.
   - If namespace creation is unsupported by the host environment, a one-time degraded-isolation warning is logged.

---

## Contributing

Contributions, issues, and feature requests are welcome!
Feel free to check out the [issues page](https://github.com/Aditya-padale/apex-agent/issues).

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## License

Distributed under the MIT License. See [`LICENSE`](LICENSE) for more information.

<div align="center">
  <sub>Built by <a href="https://github.com/Aditya-padale">Aditya Padale</a></sub>
</div>
