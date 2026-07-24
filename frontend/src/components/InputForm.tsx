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
  const [roleArn, setRoleArn] = useState('');
  const [showHelp, setShowHelp] = useState(false);

  const isValidRoleArn = (arn: string) =>
    /^arn:aws:iam::\d{12}:role\/.+$/.test(arn.trim());

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!stackName.trim() || !roleArn.trim()) return;
    if (!isValidRoleArn(roleArn)) return;
    onSubmit({
      stackName: stackName.trim(),
      region,
      roleArn: roleArn.trim(),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="input-form">
      <h2>CloudFormation Stack Diagnostics</h2>
      <p className="form-description">
        Analyze nested stack failures across any AWS account.
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
        <label htmlFor="role-arn">
          Cross-Account Role ARN *
          <button
            type="button"
            className="help-toggle"
            onClick={() => setShowHelp(!showHelp)}
            aria-label="Show setup instructions"
          >
            ?
          </button>
        </label>
        <input
          id="role-arn"
          type="text"
          value={roleArn}
          onChange={(e) => setRoleArn(e.target.value)}
          placeholder="arn:aws:iam::123456789012:role/CfnDiagnosticsReadRole"
          required
          disabled={isLoading}
          aria-describedby="role-arn-help"
        />
        {roleArn && !isValidRoleArn(roleArn) && (
          <span className="field-error">
            Must be a valid IAM Role ARN (arn:aws:iam::ACCOUNT_ID:role/ROLE_NAME)
          </span>
        )}
      </div>

      {showHelp && (
        <div className="help-panel" id="role-arn-help">
          <h3>Setup Instructions</h3>
          <p>
            To use this tool, deploy the provided CloudFormation template in
            your target AWS account. It creates a read-only role that this
            application can assume.
          </p>
          <ol>
            <li>
              Download the <code>cross-account-role.yaml</code> template from
              this project's repository.
            </li>
            <li>
              Deploy it in your AWS account:
              <code className="code-block">
                aws cloudformation deploy \<br />
                &nbsp;&nbsp;--template-file cross-account-role.yaml \<br />
                &nbsp;&nbsp;--stack-name cfn-diagnostics-role \<br />
                &nbsp;&nbsp;--capabilities CAPABILITY_NAMED_IAM \<br />
                &nbsp;&nbsp;--parameter-overrides \<br />
                &nbsp;&nbsp;&nbsp;&nbsp;TrustedAccountId=DIAGNOSTICS_ACCOUNT_ID
              </code>
            </li>
            <li>
              Copy the Role ARN from the stack outputs and paste it above.
            </li>
          </ol>
          <p className="help-note">
            The role grants only <code>cloudformation:Describe*</code> and{' '}
            <code>cloudformation:List*</code> permissions — read-only access.
          </p>
        </div>
      )}

      <button
        type="submit"
        disabled={isLoading || !stackName.trim() || !isValidRoleArn(roleArn)}
      >
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
