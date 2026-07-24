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
            Create a read-only IAM role in the account that contains the stacks
            you want to diagnose. Run these commands with the AWS CLI:
          </p>
          <ol>
            <li>
              Create the role (replace <code>DIAGNOSTICS_ACCOUNT_ID</code> with
              the account where this app is hosted):
              <code className="code-block">
                aws iam create-role \<br />
                &nbsp;&nbsp;--role-name CfnDiagnosticsReadRole \<br />
                &nbsp;&nbsp;--assume-role-policy-document '&#123;"Version":"2012-10-17","Statement":[&#123;"Effect":"Allow","Principal":&#123;"AWS":"arn:aws:iam::DIAGNOSTICS_ACCOUNT_ID:root"&#125;,"Action":"sts:AssumeRole","Condition":&#123;"StringEquals":&#123;"sts:ExternalId":"cfn-diagnostics"&#125;&#125;&#125;]&#125;'
              </code>
            </li>
            <li>
              Attach read-only permissions:
              <code className="code-block">
                aws iam put-role-policy \<br />
                &nbsp;&nbsp;--role-name CfnDiagnosticsReadRole \<br />
                &nbsp;&nbsp;--policy-name CloudFormationReadOnly \<br />
                &nbsp;&nbsp;--policy-document '&#123;"Version":"2012-10-17","Statement":[&#123;"Effect":"Allow","Action":["cloudformation:Describe*","cloudformation:List*","cloudformation:GetTemplate"],"Resource":"*"&#125;]&#125;'
              </code>
            </li>
            <li>
              Get the Role ARN:
              <code className="code-block">
                aws iam get-role --role-name CfnDiagnosticsReadRole --query "Role.Arn" --output text
              </code>
            </li>
          </ol>
          <p className="help-note">
            The role grants only read-only CloudFormation access. It cannot
            create, modify, or delete any resources.
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
