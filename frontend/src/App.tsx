import { useState } from 'react';
import { InputForm } from './components/InputForm';
import { OperationSummary } from './components/OperationSummary';
import { StackTree } from './components/StackTree';
import { FailureDetails } from './components/FailureDetails';
import { TimelineView } from './components/TimelineView';
import { fetchDiagnostics } from './utils/api';
import { DiagnosticsRequest, DiagnosticsResponse, AppState } from './types';

export default function App() {
  const [appState, setAppState] = useState<AppState>('idle');
  const [data, setData] = useState<DiagnosticsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedStack, setSelectedStack] = useState<string | null>(null);

  const handleSubmit = async (request: DiagnosticsRequest) => {
    setAppState('loading');
    setError(null);
    setData(null);
    setSelectedStack(null);

    try {
      const result = await fetchDiagnostics(request);
      setData(result);
      setAppState('success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
      setAppState('error');
    }
  };

  const handleSelectStack = (stackPath: string) => {
    setSelectedStack(selectedStack === stackPath ? null : stackPath);
  };

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <h1>
            <span className="header-icon" aria-hidden="true">☁️</span>
            CFN Stack Diagnostics
          </h1>
          <span className="header-subtitle">
            Nested Stack Failure Analysis
          </span>
        </div>
      </header>

      <main className="app-main">
        <section className="input-section">
          <InputForm onSubmit={handleSubmit} isLoading={appState === 'loading'} />
        </section>

        {appState === 'error' && error && (
          <div className="error-banner" role="alert">
            <span className="error-icon" aria-hidden="true">⚠️</span>
            <div>
              <strong>Error</strong>
              <p>{error}</p>
            </div>
          </div>
        )}

        {appState === 'success' && data && (
          <div className="results-section">
            <OperationSummary data={data} />

            <div className="results-layout">
              <aside className="tree-panel">
                <StackTree
                  tree={data.tree}
                  failedResources={data.failedResources}
                  onSelectStack={handleSelectStack}
                  selectedStack={selectedStack}
                />
              </aside>

              <div className="details-panel">
                <TimelineView
                  failures={data.failedResources}
                  operationStart={data.operation.startTime}
                  operationEnd={data.operation.endTime}
                />

                <FailureDetails
                  failures={data.failedResources}
                  selectedStack={selectedStack}
                />
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
