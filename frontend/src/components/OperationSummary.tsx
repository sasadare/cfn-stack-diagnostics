import { DiagnosticsResponse } from '../types';
import { formatTimestamp, getStatusColor } from '../utils/format';

interface OperationSummaryProps {
  data: DiagnosticsResponse;
}

export function OperationSummary({ data }: OperationSummaryProps) {
  const { operation, stackName, region, stackStatus, failedResources } = data;

  return (
    <div className="operation-summary">
      <h2>Stack Overview</h2>
      <div className="summary-grid">
        <div className="summary-item">
          <span className="summary-label">Stack</span>
          <span className="summary-value">{stackName}</span>
        </div>
        <div className="summary-item">
          <span className="summary-label">Region</span>
          <span className="summary-value">{region}</span>
        </div>
        <div className="summary-item">
          <span className="summary-label">Status</span>
          <span
            className="summary-value status-badge"
            style={{ color: getStatusColor(stackStatus) }}
          >
            {stackStatus}
          </span>
        </div>
        <div className="summary-item">
          <span className="summary-label">Operation</span>
          <span
            className="summary-value"
            style={{ color: getStatusColor(operation.operationType) }}
          >
            {operation.operationType}
          </span>
        </div>
        <div className="summary-item">
          <span className="summary-label">Result</span>
          <span
            className="summary-value"
            style={{ color: getStatusColor(operation.finalStatus) }}
          >
            {operation.finalStatus}
          </span>
        </div>
        <div className="summary-item">
          <span className="summary-label">Started</span>
          <span className="summary-value">
            {formatTimestamp(operation.startTime)}
          </span>
        </div>
        <div className="summary-item">
          <span className="summary-label">Ended</span>
          <span className="summary-value">
            {formatTimestamp(operation.endTime)}
          </span>
        </div>
        <div className="summary-item">
          <span className="summary-label">Duration</span>
          <span className="summary-value">{operation.durationFormatted}</span>
        </div>
        <div className="summary-item highlight">
          <span className="summary-label">Failed Resources</span>
          <span
            className="summary-value"
            style={{
              color: failedResources.length > 0 ? '#ef4444' : '#22c55e',
              fontWeight: 700,
              fontSize: '1.25rem',
            }}
          >
            {failedResources.length}
          </span>
        </div>
      </div>
    </div>
  );
}
