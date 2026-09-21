import json
import asyncio
import re
from pathlib import PurePosixPath
from typing import Dict, Optional
from fastapi import FastAPI, HTTPException, Header, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from scenarios.loader import SCENARIOS, get_scenario
from agent.core import ApexAgentEngine, DEFAULT_MODEL
from sandbox.runner import SandboxEnvironment

app = FastAPI(
    title="ApexAgent API",
    description="Agentic Coding & Debugging Agent with Real Tool-Use Loops and Sandbox Feedback",
    version="1.0.0"
)

# Enable CORS for local Vite dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MAX_WORKSPACE_FILES = 300
MAX_FILE_BYTES = 1_000_000
MAX_WORKSPACE_BYTES = 8_000_000
SENSITIVE_WORKSPACE_FILE = re.compile(r"(^|/)\.env(?:\.|$)|\.(pem|key|p12|pfx)$", re.IGNORECASE)


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
    api_key: Optional[str] = None
    max_turns: int = Field(default=12, ge=1, le=30)

class TestSandboxRequest(BaseModel):
    # code/script_name are retained for the original single-file test button.
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
    return {"status": "ok", "service": "ApexAgent Backend Core"}

@app.get("/api/scenarios")
def list_scenarios():
    return {"scenarios": SCENARIOS}

@app.get("/api/scenarios/{scenario_id}")
def get_scenario_details(scenario_id: str):
    sc = get_scenario(scenario_id)
    return {"scenario": sc}

@app.post("/api/run-agent")
async def run_agent_stream(req: RunAgentRequest, x_api_key: Optional[str] = Header(None)):
    """
    Server-Sent Events (SSE) endpoint streaming real-time ReAct loop iterations:
    Thought -> Tool Call -> Sandbox Observation -> Self-Correction -> Verification.
    """
    effective_api_key = req.api_key or x_api_key

    engine = ApexAgentEngine(
        api_key=effective_api_key,
        model_name=req.model_name or DEFAULT_MODEL
    )

    if req.workspace_files is not None:
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
                event_name = sse_item["event"]
                data_str = json.dumps(sse_item["data"])
                yield f"event: {event_name}\ndata: {data_str}\n\n"
        except Exception as e:
            err_str = json.dumps({"error": str(e)})
            yield f"event: error\ndata: {err_str}\n\n"

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
def test_sandbox(req: TestSandboxRequest):
    """Run a single file (legacy) or an imported project validation command."""
    if req.workspace_files is not None:
        workspace_files = validate_workspace_files(req.workspace_files)
    elif req.code is not None:
        workspace_files = validate_workspace_files({req.script_name: req.code})
    else:
        raise HTTPException(status_code=422, detail="Provide a file or workspace_files to test.")

    sandbox = SandboxEnvironment()
    try:
        for file_path, content in workspace_files.items():
            write_result = sandbox.write_file(file_path, content)
            if not write_result.get("success"):
                raise HTTPException(status_code=422, detail=write_result.get("error", "Could not create workspace file."))

        setup_result = None
        if req.setup_command:
            setup_result = sandbox.run_command(req.setup_command)
            if not setup_result.get("success"):
                return {
                    "success": False,
                    "sandbox_result": setup_result,
                    "setup_result": setup_result,
                    "workspace_files": sandbox.list_dir(),
                }

        result = (
            sandbox.run_command(req.command)
            if req.command
            else sandbox.run_python_script(req.script_name)
        )
        return {
            "success": result.get("success", False),
            "sandbox_result": result,
            "setup_result": setup_result,
            "workspace_files": sandbox.list_dir()
        }
    finally:
        sandbox.cleanup()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
