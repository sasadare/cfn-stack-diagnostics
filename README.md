# CloudFormation Stack Failure Diagnostics

A full-stack web application that diagnoses CloudFormation nested stack failures. It walks the entire nested stack hierarchy, identifies failed resources, and presents them in a visual tree with timeline view.

## Architecture

```
┌─────────────────┐     ┌──────────────┐     ┌─────────────────┐
│  React Frontend │────▶│ API Gateway  │────▶│  Lambda (Python) │
│  (Amplify Gen2) │◀────│              │◀────│  CFN Diagnostics │
└─────────────────┘     └──────────────┘     └─────────────────┘
```

## Project Structure

```
├── frontend/          # React app (Vite + TypeScript)
├── amplify/           # Amplify Gen 2 backend (API + Lambda)
└── README.md
```

## Prerequisites

- Node.js 18+
- npm or yarn
- AWS CLI configured
- AWS Amplify CLI (`npm install -g @aws-amplify/cli`)

## Local Development

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Deploy

```bash
npx ampx sandbox    # Deploy sandbox environment
```

## Features

- Input form: stack name, AWS region, optional AWS profile
- Visual tree showing nested stack hierarchy
- Each stack node shows: name, resource count, failure count
- Failed stacks highlighted in red, healthy in green
- Expandable failure details with resource info
- Timeline view showing failure sequence
