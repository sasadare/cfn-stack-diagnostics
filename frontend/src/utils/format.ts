export function formatDuration(seconds: number): string {
  if (seconds < 0) return '0s';
  seconds = Math.ceil(seconds);
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}m ${secs}s`;
  }
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
}

export function formatTimestamp(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'short',
  });
}

export function getStatusColor(status: string): string {
  if (status.includes('FAILED') || status.includes('ROLLBACK')) return '#ef4444';
  if (status.includes('COMPLETE') && !status.includes('ROLLBACK')) return '#22c55e';
  if (status.includes('IN_PROGRESS')) return '#eab308';
  return '#6b7280';
}

export function getRelativeSeconds(
  timestamp: string,
  operationStart: string
): number {
  const ts = new Date(timestamp).getTime();
  const start = new Date(operationStart).getTime();
  return (ts - start) / 1000;
}
