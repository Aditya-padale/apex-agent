import React, { useEffect, useRef, useState } from 'react';
import Header from './components/Header';
import ProjectSetupPanel from './components/ProjectSetupPanel';
import ScenarioSelector from './components/ScenarioSelector';
import TrajectoryStream from './components/TrajectoryStream';
import WorkspaceViewer from './components/WorkspaceViewer';
import ApiKeyModal from './components/ApiKeyModal';
import { fetchScenarios, streamAgentRun } from './api';

export default function App() {
  const [scenarios, setScenarios] = useState([]);
  const [selectedScenario, setSelectedScenario] = useState(null);
  const [benchmarkPrompt, setBenchmarkPrompt] = useState('');
  const [loadingScenarios, setLoadingScenarios] = useState(true);
  const [workspaceMode, setWorkspaceMode] = useState('benchmark');

  const [workspaceFiles, setWorkspaceFiles] = useState({});
  const [customWorkspaceFiles, setCustomWorkspaceFiles] = useState({});
  const [projectName, setProjectName] = useState('My workspace');
  const [projectGoal, setProjectGoal] = useState('');
  const [validationCommand, setValidationCommand] = useState('');
  const [setupCommand, setSetupCommand] = useState('');

  const [events, setEvents] = useState([]);
  const [status, setStatus] = useState('idle');
  const [runSucceeded, setRunSucceeded] = useState(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [maxTurns, setMaxTurns] = useState(12);

  const [modelName, setModelName] = useState('gemini-3.5-flash');
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('gemini_api_key') || '');
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);
  const abortControllerRef = useRef(null);

  useEffect(() => {
    async function loadScenarios() {
      setLoadingScenarios(true);
      try {
        const list = await fetchScenarios();
        setScenarios(list);
        if (list.length) {
          setSelectedScenario(list[0]);
          setWorkspaceFiles(list[0].initial_files || {});
        }
      } catch (error) {
        console.error('Failed to load scenarios:', error);
      } finally {
        setLoadingScenarios(false);
      }
    }
    loadScenarios();
  }, []);

  const resetRun = () => {
    setEvents([]);
    setStatus('idle');
    setRunSucceeded(null);
    setCurrentStep(0);
  };

  const handleSelectScenario = (scenario) => {
    if (status === 'running') return;
    setSelectedScenario(scenario);
    setBenchmarkPrompt('');
    setWorkspaceFiles(scenario.initial_files || {});
    resetRun();
  };

  const handleModeChange = (mode) => {
    if (status === 'running' || mode === workspaceMode) return;
    setWorkspaceMode(mode);
    setWorkspaceFiles(mode === 'custom' ? customWorkspaceFiles : selectedScenario?.initial_files || {});
    resetRun();
  };

  const handleImportFiles = (files) => {
    setCustomWorkspaceFiles(files);
    setWorkspaceFiles(files);
    resetRun();
  };

  const handleCustomFileChange = (filePath, content) => {
    setCustomWorkspaceFiles((previous) => {
      const next = { ...previous, [filePath]: content };
      if (workspaceMode === 'custom') setWorkspaceFiles(next);
      return next;
    });
  };

  const handleAddCustomFile = (filePath, content) => handleCustomFileChange(filePath, content);

  const handleClearWorkspace = () => {
    if (status === 'running') return;
    setCustomWorkspaceFiles({});
    setWorkspaceFiles({});
    resetRun();
  };

  const handleSaveApiKey = (newKey) => {
    setApiKey(newKey);
    if (newKey) localStorage.setItem('gemini_api_key', newKey);
    else localStorage.removeItem('gemini_api_key');
  };

  const startAgentStream = (params, initialFiles, isCustomRun) => {
    setEvents([]);
    setStatus('running');
    setRunSucceeded(null);
    setCurrentStep(0);
    setWorkspaceFiles(initialFiles);
    abortControllerRef.current = new AbortController();

    streamAgentRun(
      params,
      (eventName, data) => {
        setEvents((previous) => [...previous, { event: eventName, data }]);
        if (eventName === 'workspace_update') {
          const { file_path: filePath, content } = data;
          if (filePath && content !== undefined) {
            setWorkspaceFiles((previous) => ({ ...previous, [filePath]: content }));
            if (isCustomRun) {
              setCustomWorkspaceFiles((previous) => ({ ...previous, [filePath]: content }));
            }
          }
        } else if (eventName === 'step_start') {
          setCurrentStep(data.step || 1);
          if (data.max_turns) setMaxTurns(data.max_turns);
        } else if (eventName === 'finished') {
          setRunSucceeded(data.success !== false);
          setStatus('finished');
        } else if (eventName === 'error') {
          setRunSucceeded(false);
          setStatus('error');
        }
      },
      (error) => {
        console.error('Stream error:', error);
        setEvents((previous) => [...previous, { event: 'error', data: { error: error.message || 'Stream disconnected' } }]);
        setRunSucceeded(false);
        setStatus('error');
      },
      () => setStatus((previous) => (previous === 'running' ? 'finished' : previous)),
      abortControllerRef.current.signal,
    );
  };

  const handleRunBenchmark = () => {
    if (!selectedScenario) return;
    startAgentStream({
      scenario_id: selectedScenario.id,
      custom_prompt: benchmarkPrompt || undefined,
      model_name: modelName,
      api_key: apiKey || undefined,
      max_turns: 10,
    }, selectedScenario.initial_files || {}, false);
  };

  const handleRunCustomWorkspace = () => {
    if (!Object.keys(customWorkspaceFiles).length || !projectGoal.trim()) return;
    startAgentStream({
      workspace_files: customWorkspaceFiles,
      project_name: projectName.trim() || 'My workspace',
      custom_prompt: projectGoal.trim(),
      validation_command: validationCommand.trim() || undefined,
      setup_command: setupCommand.trim() || undefined,
      model_name: modelName,
      api_key: apiKey || undefined,
      max_turns: 12,
    }, customWorkspaceFiles, true);
  };

  const handleCancelAgent = () => {
    abortControllerRef.current?.abort();
    setStatus('idle');
    setRunSucceeded(null);
  };

  const isCustomWorkspace = workspaceMode === 'custom';

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-slate-950 text-slate-100 font-sans">
      <Header
        status={status}
        runSucceeded={runSucceeded}
        hasApiKey={Boolean(apiKey)}
        modelName={modelName}
        setModelName={setModelName}
        onOpenApiKeyModal={() => setIsApiKeyModalOpen(true)}
      />

      <main className="flex-1 grid grid-cols-12 gap-4 p-4 overflow-hidden">
        <div className="col-span-12 lg:col-span-3 h-full overflow-hidden flex flex-col gap-2">
          <div className="grid grid-cols-2 rounded-lg bg-slate-900 border border-slate-800 p-1 shrink-0">
            <button
              onClick={() => handleModeChange('benchmark')}
              disabled={status === 'running'}
              className={`py-1.5 rounded-md text-xs font-medium transition-colors disabled:opacity-50 ${!isCustomWorkspace ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
            >
              Demo scenarios
            </button>
            <button
              onClick={() => handleModeChange('custom')}
              disabled={status === 'running'}
              className={`py-1.5 rounded-md text-xs font-medium transition-colors disabled:opacity-50 ${isCustomWorkspace ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
            >
              My project
            </button>
          </div>

          <div className="flex-1 min-h-0 overflow-hidden">
            {isCustomWorkspace ? (
              <ProjectSetupPanel
                workspaceFiles={customWorkspaceFiles}
                projectName={projectName}
                setProjectName={setProjectName}
                goal={projectGoal}
                setGoal={setProjectGoal}
                validationCommand={validationCommand}
                setValidationCommand={setValidationCommand}
                setupCommand={setupCommand}
                setSetupCommand={setSetupCommand}
                onImportFiles={handleImportFiles}
                onAddFile={handleAddCustomFile}
                onClearWorkspace={handleClearWorkspace}
                onRunAgent={handleRunCustomWorkspace}
                onCancelAgent={handleCancelAgent}
                status={status}
              />
            ) : (
              <ScenarioSelector
                scenarios={scenarios}
                selectedScenario={selectedScenario}
                onSelectScenario={handleSelectScenario}
                customPrompt={benchmarkPrompt}
                setCustomPrompt={setBenchmarkPrompt}
                onRunAgent={handleRunBenchmark}
                onCancelAgent={handleCancelAgent}
                status={status}
                loadingScenarios={loadingScenarios}
              />
            )}
          </div>
        </div>

        <div className="col-span-12 lg:col-span-5 h-full overflow-hidden">
          <TrajectoryStream events={events} status={status} currentStep={currentStep} maxTurns={maxTurns} />
        </div>

        <div className="col-span-12 lg:col-span-4 h-full overflow-hidden">
          <WorkspaceViewer
            workspaceFiles={workspaceFiles}
            onFileChange={handleCustomFileChange}
            isEditable={isCustomWorkspace && status !== 'running'}
            validationCommand={validationCommand}
            setupCommand={setupCommand}
          />
        </div>
      </main>

      <ApiKeyModal
        isOpen={isApiKeyModalOpen}
        onClose={() => setIsApiKeyModalOpen(false)}
        apiKey={apiKey}
        onSaveApiKey={handleSaveApiKey}
      />
    </div>
  );
}
