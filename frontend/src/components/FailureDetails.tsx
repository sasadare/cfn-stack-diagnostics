import { useState } from 'react';
import { ResourceTiming } from '../types';
import { formatTimestamp, formatDuration, getStatusColor } from '../utils/format';

interface FailureDetailsProps {
  failures: ResourceTiming[];
  selectedStack: string | null;
}

export function FailureDetails({ failures, selectedStack }: FailureDetailsProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const filteredFailures = selectedStack
    ? failures.filter((f) => f.stackPath === selectedStack)
    : failures;

  if (filteredFailures.length === 0) {
    return (
      <div className="failure-details">
        <h2>Failed Resources</h2>
        <p className="no-failures">
          {selectedStack
            ? 'No failures in the selected stack.'
            : 'No resource failures detected.'}
        </p>
      </div>
    );
  }

  return (
    <div className="failure-details">
      <h2>
        Failed Resources
        {selectedStack && (
          <span className="filter-label">
            {' '}
            — filtered to {selectedStack.split('/').pop()}
          </span>
        )}
      </h2>

      <div className="failure-list">
        {filteredFailures.map((failure, index) => {
          const isExpanded = expandedIndex === index;
          return (
            <div
              key={`${failure.stackPath}-${failure.logicalId}-${index}`}
              className="failure-item"
            >
              <button
                className="failure-header"
                onClick={() =>
                  setExpandedIndex(isExpanded ? null : index)
                }
                aria-expanded={isExpanded}
              >
                <span className="failure-index">{index + 1}</span>
                <span className="failure-name">{failure.logicalId}</span>
                <span className="failure-type-badge">
                  {failure.resourceType.split('::').pop()}
                </span>
                <span className="failure-duration">
                  {formatDuration(failure.durationSeconds)}
                </span>
                <span className="failure-expand-icon">
                  {isExpanded ? '−' : '+'}
                </span>
              </button>

              {isExpanded && (
                <div className="failure-body">
                  <div className="failure-detail-grid">
                    <div className="failure-detail">
                      <span className="detail-label">Resource Type</span>
                      <span className="detail-value">
                        {failure.resourceType}
                      </span>
                    </div>
                    <div className="failure-detail">
                      <span className="detail-label">In Stack</span>
                      <span className="detail-value">
                        {failure.stackPath.split('/').pop() || '(root)'}
                      </span>
                    </div>
                    <div className="failure-detail">
                      <span className="detail-label">Stack Path</span>
                      <span className="detail-value">{failure.stackPath}</span>
                    </div>
                    <div className="failure-detail">
                      <span className="detail-label">Started</span>
                      <span className="detail-value">
                        {formatTimestamp(failure.startTime)}
                      </span>
                    </div>
                    <div className="failure-detail">
                      <span className="detail-label">Failed At</span>
                      <span className="detail-value" style={{ color: '#ef4444' }}>
                        {failure.endTime
                          ? formatTimestamp(failure.endTime)
                          : 'N/A'}
                      </span>
                    </div>
                    <div className="failure-detail">
                      <span className="detail-label">Duration</span>
                      <span className="detail-value">
                        {formatDuration(failure.durationSeconds)}
                      </span>
                    </div>
                    <div className="failure-detail">
                      <span className="detail-label">Status</span>
                      <span
                        className="detail-value"
                        style={{ color: getStatusColor(failure.finalStatus) }}
                      >
                        {failure.finalStatus}
                      </span>
                    </div>
                    {failure.physicalId && (
                      <div className="failure-detail full-width">
                        <span className="detail-label">Physical ID</span>
                        <span className="detail-value mono">
                          {failure.physicalId}
                        </span>
                      </div>
                    )}
                    <div className="failure-detail full-width">
                      <span className="detail-label">Error</span>
                      <span className="detail-value error-message">
                        {failure.statusReason || 'No error message'}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
