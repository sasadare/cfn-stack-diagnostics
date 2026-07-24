import { DiagnosticsRequest, DiagnosticsResponse } from '../types';

// In production, this will be the API Gateway URL from Amplify outputs
const API_URL = import.meta.env.VITE_API_URL || '/api';

export async function fetchDiagnostics(
  request: DiagnosticsRequest
): Promise<DiagnosticsResponse> {
  const response = await fetch(`${API_URL}/diagnose`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      stack_name: request.stackName,
      region: request.region,
      role_arn: request.roleArn,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(
      errorBody.message || `Request failed with status ${response.status}`
    );
  }

  return response.json();
}
