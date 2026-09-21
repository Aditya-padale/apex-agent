/**
 * API client for interacting with the ApexAgent FastAPI backend.
 */

export async function fetchHealth() {
  const res = await fetch('/api/health');
  if (!res.ok) throw new Error('Health check failed');
  return res.json();
}

export async function fetchScenarios() {
  const res = await fetch('/api/scenarios');
  if (!res.ok) throw new Error('Failed to fetch scenarios');
  const data = await res.json();
  return data.scenarios || [];
}

export async function runSandboxTest({
  code,
  scriptName = 'main.py',
  workspaceFiles,
  command,
  setupCommand,
}) {
  const res = await fetch('/api/test-sandbox', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code,
      script_name: scriptName,
      workspace_files: workspaceFiles,
      command: command || undefined,
      setup_command: setupCommand || undefined,
    }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || 'Sandbox execution failed');
  }
  return res.json();
}

/**
 * Streams real-time ReAct agent events using SSE via POST request.
 */
export async function streamAgentRun(params, onEvent, onError, onDone, signal) {
  try {
    const headers = { 'Content-Type': 'application/json' };
    if (params.api_key) {
      headers['X-API-Key'] = params.api_key;
    }

    const response = await fetch('/api/run-agent', {
      method: 'POST',
      headers,
    body: JSON.stringify({
      scenario_id: params.scenario_id,
      workspace_files: params.workspace_files,
      project_name: params.project_name,
      custom_prompt: params.custom_prompt || undefined,
      validation_command: params.validation_command || undefined,
      setup_command: params.setup_command || undefined,
      model_name: params.model_name || 'gemini-3.5-flash',
      api_key: params.api_key || undefined,
      max_turns: params.max_turns,
    }),
      signal,
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Server returned ${response.status}: ${errText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let currentEvent = 'message';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop(); // keep partial line in buffer

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        if (trimmed.startsWith('event: ')) {
          currentEvent = trimmed.substring(7).trim();
        } else if (trimmed.startsWith('data: ')) {
          const rawData = trimmed.substring(6).trim();
          try {
            const parsedData = JSON.parse(rawData);
            onEvent(currentEvent, parsedData);
          } catch (e) {
            onEvent(currentEvent, rawData);
          }
          currentEvent = 'message';
        }
      }
    }

    if (onDone) onDone();
  } catch (err) {
    if (err.name === 'AbortError') {
      console.log('Stream aborted by user.');
    } else {
      if (onError) onError(err);
    }
  }
}
