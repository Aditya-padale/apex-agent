# ⚡ Apex Agent — Autonomous Agentic Coding & Debugging Platform

<div align="center">

[![Vercel Deployment](https://img.shields.io/badge/Vercel-Serverless_Ready-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://vercel.com)
[![Gemini Powered](https://img.shields.io/badge/Powered_by-Google_Gemini_2.5_Flash-8E75FF?style=for-the-badge&logo=google&logoColor=white)](https://ai.google.dev/)
[![FastAPI](https://img.shields.io/badge/Backend-FastAPI_Python_3.11-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React + Vite](https://img.shields.io/badge/Frontend-React_18_+_Vite-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://vitejs.dev)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](LICENSE)

<br />

**Apex Agent** is an state-of-the-art autonomous AI coding & debugging assistant designed to automatically inspect codebases, execute unit tests in isolated sandboxes, analyze tracebacks, auto-correct code errors, and verify fixes in real-time via Server-Sent Events (SSE).

[🚀 Deploy to Vercel](#-vercel-deployment-guide) • [✨ Features](#-key-features) • [🏗️ Architecture](#%EF%B8%8F-architecture) • [💻 Local Setup](#-local-development-setup) • [📖 API Reference](#-api-endpoints)

</div>

---

## 📌 Overview

Traditional AI coding assistants suggest raw snippets, leaving developers to manually test, debug tracebacks, and copy-paste code back and forth. **Apex Agent** eliminates this manual friction by implementing a full **ReAct (Reasoning + Acting)** autonomous loop:

```
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│   Agent Thought │ ───► │    Tool Call    │ ───► │ Sandbox Execution│ ───► │ Self-Correction │
│ (Gemini 2.5)    │      │  (Read/Write)   │      │ (Pytest/Run)    │      │  & Verification │
└─────────────────┘      └─────────────────┘      └─────────────────┘      └─────────────────┘
```

1. **Reason**: Analyzes the problem prompt and inspects workspace code structure.
2. **Act**: Writes/edits code files or executes pytest / custom validation scripts.
3. **Observe**: Captures stdout, stderr, and Python stack tracebacks.
4. **Self-Correct & Verify**: Automatically adjusts implementation until all test suites pass clean.

---

## ✨ Key Features

- 🧠 **Gemini 2.5 Flash Engine**: Leverages Google's high-speed, long-context Gemini models for deep multi-turn code reasoning and function calling.
- ⚡ **Serverless-Native Architecture**: Fully configured for 1-click deployment on **Vercel** with a unified monorepo structure (FastAPI Python Serverless Functions + React SPA).
- 📡 **Real-Time Event Streaming (SSE)**: Streams step-by-step agent trajectories, tool invocations, stdout logs, and status updates directly to the UI.
- 🧪 **Isolated Execution Sandbox**: Safely run Python scripts, unit test suites (pytest), search code patterns, and modify workspace files.
- 🎯 **Benchmark Scenarios**: Built-in debugging benchmarks ranging from algorithmic edge cases (Binary Search) to corrupted log processing pipelines and async HTTP backoff retries.
- 📂 **Custom Workspace Importer**: Upload and debug your own multi-file Python projects directly inside the web interface.
- 🔐 **Secure & Flexible API Keys**: Bring your own `GEMINI_API_KEY` via HTTP headers or use backend environment variables securely.

---

## 🏗️ Architecture

Apex Agent is engineered as a monorepo combining a modern React client with a serverless FastAPI backend engine.

```mermaid
flowchart TD
    subgraph Client ["Frontend (React 18 + Vite + Tailwind)"]
        UI[User Interface & Workspace]
        TS[Trajectory Stream Visualizer]
        API_CLIENT[API Client / SSE Reader]
    end

    subgraph Vercel ["Vercel Serverless Edge Platform"]
        VERCEL_REWRITE[Vercel Route Rewriter]
        API_FUNC["Python Serverless Function (/api/index.py)"]
    end

    subgraph Backend ["Backend Engine (FastAPI)"]
        CORE[ApexAgentEngine]
        SANDBOX[SandboxEnvironment]
        SCENARIOS[Scenario Loader]
    end

    subgraph Gemini ["Google AI Studio"]
        LLM[Gemini 2.5 Flash Model]
    end

    UI -->|1. Submit Task / Scenario| API_CLIENT
    API_CLIENT -->|2. POST /api/run-agent| VERCEL_REWRITE
    VERCEL_REWRITE --> API_FUNC
    API_FUNC --> CORE
    CORE <-->|3. ReAct Function Call Loop| LLM
    CORE <-->|4. Exec Script / Run Pytest| SANDBOX
    CORE -->|5. Stream Events (SSE)| API_CLIENT
    API_CLIENT -->|6. Render Live Trajectory| TS
```

---

## 📂 Project Structure

```
apex-agent/
├── api/
│   └── index.py             # Serverless bridge for Vercel Python Functions
├── backend/
│   ├── agent/               # Autonomous ReAct Agent core & tool definitions
│   │   ├── core.py          # ApexAgentEngine (Gemini client & event stream)
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
├── requirements.txt         # Root Python requirements for Vercel build
├── package.json             # Root monorepo scripts & metadata
└── README.md                # Project documentation
```

---

## 🚀 Vercel Deployment Guide

Deploy Apex Agent to Vercel in less than 2 minutes:

### Option A: 1-Click Deployment (Recommended)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FAditya-padale%2Fapex-agent&env=GEMINI_API_KEY)

1. Click the **Deploy with Vercel** button above.
2. Link your GitHub repository.
3. In the **Environment Variables** section, configure:
   - `GEMINI_API_KEY`: Your Google Gemini API Key ([Get an API key here](https://aistudio.google.com/app/apikey)).
4. Click **Deploy**. Vercel will build the frontend and deploy the Python serverless API functions automatically!

### Option B: Deploy via Vercel CLI

```bash
# 1. Install Vercel CLI
npm i -g vercel

# 2. Login to Vercel
vercel login

# 3. Deploy to production
vercel --prod
```

> [!NOTE]
> Ensure you add your `GEMINI_API_KEY` in the Vercel Dashboard under **Project Settings > Environment Variables**.

---

## 💻 Local Development Setup

### Prerequisites

- **Python**: `3.10` or higher
- **Node.js**: `18.0` or higher
- **Gemini API Key**: From [Google AI Studio](https://aistudio.google.com/)

### 1. Clone Repository

```bash
git clone https://github.com/Aditya-padale/apex-agent.git
cd apex-agent
```

### 2. Configure Environment Variables

Create a `.env` file inside the `backend` directory (or set it in your environment):

```bash
cp backend/.env.example backend/.env 2>/dev/null || echo "GEMINI_API_KEY=your_gemini_api_key_here" > backend/.env
```

### 3. Backend Setup

```bash
# Create and activate virtual environment
python3 -m venv venv
source venv/bin/activate   # On Windows: venv\Scripts\activate

# Install dependencies
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

---

## 📖 API Endpoints

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
  "model_name": "gemini-2.5-flash",
  "max_turns": 12
}
```

---

## 🎯 Benchmark Scenarios

Apex Agent includes pre-built benchmark scenarios to test autonomous debugging capabilities:

| Scenario | Difficulty | Description | Target Fix |
| :--- | :---: | :--- | :--- |
| 🔍 **Binary Search Algorithm** | `Easy` | Fixing `IndexError` and off-by-one edge cases in empty arrays. | Correct bounds (`high = len(arr) - 1`), prevent infinite loops. |
| 📊 **Log Parser Pipeline** | `Medium` | Crashes with `TypeError` on null response times and malformed JSON lines. | Add defensive JSON decoding, null checks, and error aggregation. |
| 🔄 **Exponential Backoff Client** | `Hard` | Implement an async HTTP retry client with backoff delay. | Write retry mechanism with delay calculation `(initial * 2^attempt)`. |

---

## 🛡️ Security & Sandbox Safety

- **Path Escape Prevention**: All file paths are strictly sanitized against path traversal (`..` attacks) using `pathlib.Path.relative_to`.
- **Command Whitelisting**: Execution inside the sandbox is restricted to allowed development tools (`python`, `pytest`, `node`, etc.).
- **Sensitive File Exclusion**: Direct upload of credential files (`.env`, `.pem`, `.key`) is automatically rejected.
- **Resource Limits**: Enforces per-file memory limits and execution timeouts to prevent resource starvation.

---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome!
Feel free to check out the [issues page](https://github.com/Aditya-padale/apex-agent/issues).

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

Distributed under the MIT License. See [`LICENSE`](LICENSE) for more information.

<div align="center">
  <sub>Built with ❤️ by <a href="https://github.com/Aditya-padale">Aditya Padale</a></sub>
</div>
