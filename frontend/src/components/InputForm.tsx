import { useState } from 'react';
import { DiagnosticsRequest } from '../types';

const AWS_REGIONS = [
  'us-east-1', 'us-east-2', 'us-west-1', 'us-west-2',
  'eu-west-1', 'eu-west-2', 'eu-west-3', 'eu-central-1',
  'eu-north-1', 'ap-southeast-1', 'ap-southeast-2',
  'ap-northeast-1', 'ap-northeast-2', 'ap-south-1',
  'sa-east-1', 'ca-central-1',
];

interface InputFormProps {
  onSubmit: (request: DiagnosticsRequest) => void;
  isLoading: boolean;
}

export function InputForm({ onSubmit, isLoading }: InputFormProps) {
  const [stackName, setStackName] = useState('');
  const [region, setRegion] = useState('us-east-1');
  const [profile, setProfile] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!stackName.trim()) return;
    onSubmit({
      stackName: stackName.trim(),
      region,
      profile: profile.trim() || undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="input-form">
      <h2>CloudFormation Stack Diagnostics</h2>
      <p className="form-description">
        Analyze nested stack failures and visualize the hierarchy.
      </p>

      <div className="form-group">
        <label htmlFor="stack-name">Stack Name or ARN *</label>
        <input
          id="stack-name"
          type="text"
          value={stackName}
          onChange={(e) => setStackName(e.target.value)}
          placeholder="my-application-stack"
          required
          disabled={isLoading}
        />
      </div>

      <div className="form-group">
        <label htmlFor="region">AWS Region *</label>
        <select
          id="region"
          value={region}
          onChange={(e) => setRegion(e.target.value)}
          disabled={isLoading}
        >
          {AWS_REGIONS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </div>

      <div className="form-group">
        <label htmlFor="profile">AWS Profile (optional)</label>
        <input
          id="profile"
          type="text"
          value={profile}
          onChange={(e) => setProfile(e.target.value)}
          placeholder="default"
          disabled={isLoading}
        />
      </div>

      <button type="submit" disabled={isLoading || !stackName.trim()}>
        {isLoading ? (
          <>
            <span className="spinner" aria-hidden="true"></span>
            Analyzing...
          </>
        ) : (
          'Diagnose Stack'
        )}
      </button>
    </form>
  );
}
