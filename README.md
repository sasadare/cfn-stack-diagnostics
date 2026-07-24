# CloudFormation Stack Failure Diagnostics

A full-stack web application that diagnoses CloudFormation nested stack failures across AWS accounts. It walks the entire nested stack hierarchy, identifies failed resources, and presents them in a visual tree with timeline view.

## Architecture

```
┌─────────────────┐     ┌──────────────┐     ┌─────────────────┐     ┌──────────────────┐
│  React Frontend │────▶│ API Gateway  │────▶│  Lambda          │────▶│ Target Account   │
│  (Amplify Gen2) │◀────│              │◀────│  (AssumeRole)    │◀────│ (Read-Only Role) │
└─────────────────┘     └──────────────┘     └─────────────────┘     └──────────────────┘
```

---

## Prerequisites (For Users Requesting Diagnostics)

Before using this tool, you must create a read-only IAM role in the AWS account that contains the stacks you want to diagnose. This role allows the diagnostics Lambda to read your CloudFormation data without needing your credentials.

### Step 1: Create the cross-account role

Run this command in the AWS account where your stacks live:

```bash
aws iam create-role \
  --role-name CfnDiagnosticsReadRole \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [
      {
        "Effect": "Allow",
        "Principal": {
          "AWS": "arn:aws:iam::<DIAGNOSTICS_APP_ACCOUNT_ID>:root"
        },
        "Action": "sts:AssumeRole",
        "Condition": {
          "StringEquals": {
            "sts:ExternalId": "cfn-diagnostics"
          }
        }
      }
    ]
  }'
```

Replace `<DIAGNOSTICS_APP_ACCOUNT_ID>` with the 12-digit AWS Account ID where this diagnostics application is deployed.

### Step 2: Attach read-only CloudFormation permissions

```bash
aws iam put-role-policy \
  --role-name CfnDiagnosticsReadRole \
  --policy-name CloudFormationReadOnly \
  --policy-document '{
    "Version": "2012-10-17",
    "Statement": [
      {
        "Effect": "Allow",
        "Action": [
          "cloudformation:DescribeStacks",
          "cloudformation:DescribeStackEvents",
          "cloudformation:DescribeStackResources",
          "cloudformation:ListStackResources",
          "cloudformation:ListStacks",
          "cloudformation:GetTemplate"
        ],
        "Resource": "*"
      }
    ]
  }'
```

### Step 3: Get your Role ARN

```bash
aws iam get-role --role-name CfnDiagnosticsReadRole --query "Role.Arn" --output text
```

This will output something like:
```
arn:aws:iam::123456789012:role/CfnDiagnosticsReadRole
```

### Step 4: Use it in the web UI

Paste that Role ARN into the "Cross-Account Role ARN" field in the diagnostics app. Done.

### What this role can do

| Permission | Purpose |
|-----------|---------|
| `cloudformation:DescribeStacks` | Get stack status and metadata |
| `cloudformation:DescribeStackEvents` | Read event history to find failures |
| `cloudformation:DescribeStackResources` | List resources in a stack |
| `cloudformation:ListStackResources` | Walk nested stack hierarchy |
| `cloudformation:ListStacks` | Find deleted stacks |
| `cloudformation:GetTemplate` | Read template (for context) |

The role is **read-only** — it cannot create, modify, or delete any resources.

### Cleanup

To remove the role when you no longer need it:

```bash
aws iam delete-role-policy --role-name CfnDiagnosticsReadRole --policy-name CloudFormationReadOnly
aws iam delete-role --role-name CfnDiagnosticsReadRole
```

---

## Cross-Account Security Model

- **External ID**: Both the Lambda and the role require the same external ID (`cfn-diagnostics`), preventing confused deputy attacks
- **Scoped trust**: The role only trusts the specific account where this app is deployed
- **No stored credentials**: Uses temporary STS tokens (15 min TTL)
- **Read-only**: No write/delete permissions granted

---

## Project Structure

```
├── amplify/
│   ├── backend.ts                          # Amplify Gen 2 infra (Lambda + API GW)
│   └── functions/cfn-diagnostics/
│       └── src/handler.py                  # Lambda: AssumeRole + CFN diagnostics
├── frontend/
│   └── src/
│       ├── components/                     # React UI components
│       ├── types/                          # TypeScript interfaces
│       └── utils/                          # API client + formatters
├── amplify.yml                             # Amplify CI/CD build spec
└── package.json
```

## Local Development

```bash
# Install dependencies
npm install
cd frontend && npm install

# Start frontend dev server
cd frontend && npm run dev

# Deploy sandbox environment (separate terminal)
npx ampx sandbox
```

After sandbox deploys, set the API URL in `frontend/.env`:
```
VITE_API_URL=https://xxxxx.execute-api.us-east-1.amazonaws.com/prod
```

## Developer Prerequisites

- Node.js 18+
- AWS CLI configured
- An AWS account to deploy the app into

## Features

- Input form: stack name, AWS region, cross-account Role ARN
- Visual tree showing nested stack hierarchy
- Each stack node shows: name, resource count, failure count
- Failed stacks highlighted in red, healthy in green
- Expandable failure details: resource name, type, timestamp, duration, error message
- Timeline view showing when each failure occurred relative to the operation start
