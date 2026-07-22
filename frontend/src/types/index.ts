export interface DiagnosticsRequest {
  stackName: string;
  region: string;
  profile?: string;
}

export interface OperationInfo {
  startTime: string;
  endTime: string;
  operationType: string;
  finalStatus: string;
  durationFormatted: string;
}

export interface ResourceTiming {
  logicalId: string;
  resourceType: string;
  physicalId: string;
  startTime: string;
  endTime: string | null;
  durationSeconds: number;
  durationFormatted: string;
  finalStatus: string;
  statusReason: string | null;
  isFailed: boolean;
  isNestedStack: boolean;
  depth: number;
  stackPath: string;
}

export interface StackSummary {
  stack: string;
  stackPath: string;
  depth: number;
  totalResources: number;
  failed: number;
}

export interface StackTreeNode {
  name: string;
  stackPath: string;
  depth: number;
  totalResources: number;
  failedCount: number;
  children: StackTreeNode[];
}

export interface DiagnosticsResponse {
  stackName: string;
  region: string;
  stackStatus: string;
  operation: OperationInfo;
  stackSummary: StackSummary[];
  failedResources: ResourceTiming[];
  allTimings: ResourceTiming[];
  tree: StackTreeNode;
}

export type AppState = 'idle' | 'loading' | 'success' | 'error';
