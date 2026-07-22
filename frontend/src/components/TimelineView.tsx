import { ResourceTiming } from '../types';
import { formatDuration, getRelativeSeconds } from '../utils/format';

interface TimelineViewProps {
  failures: ResourceTiming[];
  operationStart: string;
  operationEnd: string;
}

export function TimelineView({
  failures,
  operationStart,
  operationEnd,
}: TimelineViewProps) {
  if (failures.length === 0) {
    return null;
  }

  const totalDuration = getRelativeSeconds(operationEnd, operationStart);

  // Sort failures by start time
  const sorted = [...failures].sort(
    (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
  );

  return (
    <div className="timeline-view">
      <h2>Failure Timeline</h2>
      <p className="timeline-description">
        Shows when each failure occurred relative to the operation start.
        Total operation duration: <strong>{formatDuration(totalDuration)}</strong>
      </p>

      <div className="timeline-container" role="img" aria-label="Timeline of resource failures">
        {/* Time axis markers */}
        <div className="timeline-axis">
          <span className="axis-label start">0s</span>
          <span className="axis-label quarter">
            {formatDuration(totalDuration * 0.25)}
          </span>
          <span className="axis-label half">
            {formatDuration(totalDuration * 0.5)}
          </span>
          <span className="axis-label three-quarter">
            {formatDuration(totalDuration * 0.75)}
          </span>
          <span className="axis-label end">
            {formatDuration(totalDuration)}
          </span>
        </div>

        <div className="timeline-track">
          {sorted.map((failure, index) => {
            const startOffset = getRelativeSeconds(
              failure.startTime,
              operationStart
            );
            const endOffset = failure.endTime
              ? getRelativeSeconds(failure.endTime, operationStart)
              : totalDuration;

            const leftPercent = (startOffset / totalDuration) * 100;
            const widthPercent =
              ((endOffset - startOffset) / totalDuration) * 100;

            return (
              <div key={index} className="timeline-row">
                <div className="timeline-label" title={failure.logicalId}>
                  <span className="timeline-depth-indicator">
                    {'  '.repeat(failure.depth)}
                  </span>
                  {failure.logicalId}
                </div>
                <div className="timeline-bar-container">
                  <div
                    className="timeline-bar"
                    style={{
                      left: `${Math.max(0, leftPercent)}%`,
                      width: `${Math.max(0.5, widthPercent)}%`,
                    }}
                    title={`${failure.logicalId}: started at +${formatDuration(startOffset)}, failed at +${formatDuration(endOffset)} (${formatDuration(failure.durationSeconds)})`}
                  >
                    <span className="timeline-bar-duration">
                      {formatDuration(failure.durationSeconds)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
