# CloudFormation Stack Failure Diagnostics

A full-stack web application that diagnoses CloudFormation nested stack failures across AWS accounts. It walks the entire nested stack hierarchy, identifies failed resources, and presents them in a visual tree with timeline view.

## Architecture

```
┌─────────────────┐     ┌──────────────┐     ┌─────────────────┐     ┌──────────────────┐
│  React Frontend │────▶│ API Gateway  │────▶│  Lambda          │────▶│ Target Account   │
│  (Amplify Gen2) │◀────│              │◀────│  (AssumeRole)    │◀────│ (Read-Only Role) │
└─────────────────┘     └──────────────┘     └─────────────────┘     └──────────────────┘
```

## Cross-Account Access Model

This application uses **STS AssumeRole** for secure cross-account access:

1. Users deploy a CloudFormation template (`cross-account-role.yaml`) in their target account
2. The template creates a read-only IAM role with a trust policy pointing to the diagnostics account
3. Users provide the Role ARN in the web UI
4. The Lambda assumes that role to read CloudFormation data — no credentials leave the user's account

### Security Features

- **Read-only**: The cross-account role only grants `cloudformation:Describe*` and `cloudformation:List*`
- **External ID**: Prevents confused deputy attacks — both sides must agree on the external ID
- **Scoped trust**: The role only trusts the specific account where this app is deployed
- **No stored credentials**: Uses temporary STS tokens (15 min TTL)

## Setup for Users (Target Account)

Deploy the trust role in any AWS account you want to diagnose:

```bash
aws cloudformation deploy \
  --template-file cross-account-role.yaml \
  --stack-name cfn-diagnostics-role \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides \
    TrustedAccountId=<ACCOUNT_ID_WHERE_APP_IS_DEPLOYED> \
    ExternalId=cfn-diagnostics
```

Then copy the Role ARN from the stack outputs and use it in the web UI.

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
├── cross-account-role.yaml                 # CFN template users deploy in their account
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

## Prerequisites

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
