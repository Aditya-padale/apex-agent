import json
import asyncio
import os
import time
import re
from pathlib import PurePosixPath
from typing import Dict, Optional, List
from fastapi import FastAPI, HTTPException, Header, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from scenarios.loader import SCENARIOS, get_scenario
from agent.core import ApexAgentEngine, DEFAULT_MODEL
from sandbox.runner import SandboxEnvironment, ALLOW_CODE_EXECUTION

app = FastAPI(
    title="ApexAgent API",
    description="Agentic Coding & Debugging Agent with Real Tool-Use Loops and Sandbox Feedback",
    version="1.0.0"
)

# CORS configuration: origin list from env, allow_credentials=False (no cookies)
cors_origins_env = os.environ.get("CORS_ORIGINS", "http://localhost:5173")
cors_origins = [orig.strip() for orig in cors_origins_env.split(",") if orig.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

MAX_WORKSPACE_FILES = 300
MAX_FILE_BYTES = 1_000_000
MAX_WORKSPACE_BYTES = 8_000_000
SENSITIVE_WORKSPACE_FILE = re.compile(r"(^|/)\.env(?:\.|$)|\.(pem|key|p12|pfx)$", re.IGNORECASE)

# Rate limiting and access token settings
RATE_LIMIT_RPM = int(os.environ.get("RATE_LIMIT_RPM", "5"))
APEX_ACCESS_TOKEN = os.environ.get("APEX_ACCESS_TOKEN", "").strip()

# Note: In-memory rate limiting is per-instance and resets across cold starts on serverless platforms.
_rate_limit_history: Dict[str, List[float]] = {}


def check_rate_limit(request: Request):
    """Enforce per-IP sliding window rate limiting."""
    if RATE_LIMIT_RPM <= 0:
        return
    # Vercel terminates the client connection at its edge. Prefer the first
    # forwarding address so all visitors do not share the function proxy IP.
    forwarded_for = request.headers.get("x-forwarded-for", "")
    client_ip = forwarded_for.split(",", 1)[0].strip() or (
        request.client.host if request.client else "unknown"
    )
    now = time.time()
    window = 60.0
    history = _rate_limit_history.setdefault(client_ip, [])
    history = [t for t in history if now - t < window]
    _rate_limit_history[client_ip] = history
    if len(history) >= RATE_LIMIT_RPM:
        raise HTTPException(
            status_code=429,
            detail=f"Rate limit exceeded: maximum {RATE_LIMIT_RPM} requests per minute.",
        )
    history.append(now)


def verify_access_token(x_access_token: Optional[str] = Header(None)):
    """If APEX_ACCESS_TOKEN is configured, require matching X-Access-Token header."""
    if APEX_ACCESS_TOKEN:
        if not x_access_token or x_access_token != APEX_ACCESS_TOKEN:
            raise HTTPException(
                status_code=401,
                detail="Unauthorized: invalid or missing X-Access-Token header.",
            )


def validate_workspace_files(workspace_files: Dict[str, str]) -> Dict[str, str]:
    """Reject oversized imports and paths that could escape the temporary workspace."""
    if not workspace_files:
        raise HTTPException(status_code=422, detail="Add at least one workspace file.")
    if len(workspace_files) > MAX_WORKSPACE_FILES:
        raise HTTPException(status_code=422, detail=f"A workspace can contain at most {MAX_WORKSPACE_FILES} files.")

    total_bytes = 0
    cleaned_files: Dict[str, str] = {}
    for raw_path, content in workspace_files.items():
        file_path = str(raw_path).replace("\\", "/")
        path = PurePosixPath(file_path)
        if (
            not file_path
            or path.is_absolute()
            or file_path.startswith("/")
            or ".." in path.parts
            or any(part in {"", "."} for part in path.parts)
            or "\x00" in file_path
        ):
            raise HTTPException(status_code=422, detail=f"Invalid workspace file path: {raw_path!r}")
        if SENSITIVE_WORKSPACE_FILE.search(file_path):
            raise HTTPException(status_code=422, detail=f"Sensitive file {file_path!r} cannot be imported. Use test-safe configuration instead.")
        if not isinstance(content, str):
            raise HTTPException(status_code=422, detail=f"Workspace file {file_path!r} must be text.")
        content_bytes = len(content.encode("utf-8"))
        if content_bytes > MAX_FILE_BYTES:
            raise HTTPException(status_code=422, detail=f"{file_path!r} exceeds the 1 MB per-file limit.")
        total_bytes += content_bytes
        cleaned_files[file_path] = content

    if total_bytes > MAX_WORKSPACE_BYTES:
        raise HTTPException(status_code=422, detail="The workspace exceeds the 8 MB text limit.")
    return cleaned_files


class RunAgentRequest(BaseModel):
    scenario_id: Optional[str] = None
    workspace_files: Optional[Dict[str, str]] = None
    project_name: Optional[str] = "My workspace"
    custom_prompt: Optional[str] = None
    validation_command: Optional[str] = None
    setup_command: Optional[str] = None
    model_name: Optional[str] = DEFAULT_MODEL
    api_key: Optional[str] = Field(
        default=None,
        deprecated=True,
        description="Deprecated: Provide API key via X-API-Key header instead.",
    )
    max_turns: int = Field(default=12, ge=1, le=30)

class TestSandboxRequest(BaseModel):
    code: Optional[str] = None
    script_name: str = "main.py"
    workspace_files: Optional[Dict[str, str]] = None
    command: Optional[str] = None
    setup_command: Optional[str] = None

@app.get("/")
@app.get("/api")
def api_root():
    return {"status": "ok", "message": "ApexAgent Backend Core API", "version": "1.0.0"}

@app.get("/api/health")
def health_check():
    return {
        "status": "ok",
        "service": "ApexAgent Backend Core",
        "code_execution_enabled": ALLOW_CODE_EXECUTION,
    }

@app.get("/api/scenarios")
def list_scenarios():
    return {"scenarios": SCENARIOS}

@app.get("/api/scenarios/{scenario_id}")
def get_scenario_details(scenario_id: str):
    sc = get_scenario(scenario_id)
    return {"scenario": sc}

@app.post("/api/run-agent")
async def run_agent_stream(
    request: Request,
    req: RunAgentRequest,
    x_api_key: Optional[str] = Header(None),
    x_access_token: Optional[str] = Header(None),
):
    """
    Server-Sent Events (SSE) endpoint streaming real-time ReAct loop iterations:
    Thought -> Tool Call -> Sandbox Observation -> Self-Correction -> Verification.
    """
    verify_access_token(x_access_token)
    check_rate_limit(request)

    # API key accepted strictly via X-API-Key header (or server-side env)
    effective_api_key = x_api_key or os.environ.get("GROQ_API_KEY") or os.environ.get("GEMINI_API_KEY")

    engine = ApexAgentEngine(
        api_key=effective_api_key,
        model_name=req.model_name or DEFAULT_MODEL
    )

    if req.workspace_files is not None:
        if not ALLOW_CODE_EXECUTION:
            raise HTTPException(
                status_code=403,
                detail="Execution of user-supplied workspace code is disabled on this server. Set ALLOW_CODE_EXECUTION=true to enable it.",
            )
        workspace_files = validate_workspace_files(req.workspace_files)
        run = engine.run_workspace(
            workspace_files=workspace_files,
            title=(req.project_name or "My workspace").strip()[:120],
            goal=req.custom_prompt or "",
            validation_command=req.validation_command,
            setup_command=req.setup_command,
            max_turns=req.max_turns,
        )
    else:
        if not req.scenario_id:
            raise HTTPException(status_code=422, detail="Choose a benchmark scenario or provide workspace_files.")
        run = engine.run_scenario(
            scenario_id=req.scenario_id,
            custom_prompt=req.custom_prompt,
            max_turns=req.max_turns,
        )

    async def event_generator():
        try:
            async for sse_item in run:
                if await request.is_disconnected():
                    break
                event_name = sse_item["event"]
                data_str = json.dumps(sse_item["data"])
                yield f"event: {event_name}\ndata: {data_str}\n\n"
        except Exception as e:
            err_str = json.dumps({"error": str(e)})
            yield f"event: error\ndata: {err_str}\n\n"
        finally:
            await run.aclose()

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )

@app.post("/api/test-sandbox")
async def test_sandbox(
    request: Request,
    req: TestSandboxRequest,
    x_access_token: Optional[str] = Header(None),
):
    """Run a single file (legacy) or an imported project validation command."""
    verify_access_token(x_access_token)
    check_rate_limit(request)

    if not ALLOW_CODE_EXECUTION:
        raise HTTPException(
            status_code=403,
            detail="Execution of user-supplied workspace code is disabled on this server. Set ALLOW_CODE_EXECUTION=true to enable it.",
        )
    if req.workspace_files is not None:
        workspace_files = validate_workspace_files(req.workspace_files)
    elif req.code is not None:
        workspace_files = validate_workspace_files({req.script_name: req.code})
    else:
        raise HTTPException(status_code=422, detail="Provide a file or workspace_files to test.")

    sandbox = SandboxEnvironment()
    try:
        for file_path, content in workspace_files.items():
            write_result = await asyncio.to_thread(sandbox.write_file, file_path, content)
            if not write_result.get("success"):
                raise HTTPException(status_code=422, detail=write_result.get("error", "Could not create workspace file."))

        setup_result = None
        if req.setup_command:
            setup_result = await asyncio.to_thread(sandbox.run_command, req.setup_command)
            if not setup_result.get("success"):
                return {
                    "success": False,
                    "sandbox_result": setup_result,
                    "setup_result": setup_result,
                    "workspace_files": await asyncio.to_thread(sandbox.list_dir),
                }

        result = await asyncio.to_thread(
            sandbox.run_command, req.command
        ) if req.command else await asyncio.to_thread(
            sandbox.run_python_script, req.script_name
        )
        return {
            "success": result.get("success", False),
            "sandbox_result": result,
            "setup_result": setup_result,
            "workspace_files": await asyncio.to_thread(sandbox.list_dir),
        }
    finally:
        sandbox.cleanup()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
