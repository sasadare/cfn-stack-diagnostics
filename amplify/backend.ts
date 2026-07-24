import { defineBackend } from '@aws-amplify/backend';
import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as iam from 'aws-cdk-lib/aws-iam';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const backend = defineBackend({});

// Create a custom stack for our API
const apiStack = backend.createStack('CfnDiagnosticsApi');

// Lambda function
const diagnosticsFunction = new lambda.Function(apiStack, 'CfnDiagnosticsFunction', {
  runtime: lambda.Runtime.PYTHON_3_12,
  handler: 'handler.lambda_handler',
  code: lambda.Code.fromAsset(join(__dirname, 'functions/cfn-diagnostics/src')),
  timeout: cdk.Duration.seconds(300),
  memorySize: 512,
  environment: {
    POWERTOOLS_SERVICE_NAME: 'cfn-diagnostics',
    EXTERNAL_ID: 'cfn-diagnostics',
  },
});

// Grant CloudFormation read permissions and STS AssumeRole
diagnosticsFunction.addToRolePolicy(
  new iam.PolicyStatement({
    effect: iam.Effect.ALLOW,
    actions: [
      'sts:AssumeRole',
    ],
    resources: ['*'],  // Users provide their own role ARNs
  })
);

// API Gateway
const api = new apigateway.RestApi(apiStack, 'CfnDiagnosticsApiGw', {
  restApiName: 'CFN Diagnostics API',
  description: 'API for CloudFormation stack failure diagnostics',
  defaultCorsPreflightOptions: {
    allowOrigins: apigateway.Cors.ALL_ORIGINS,
    allowMethods: ['POST', 'OPTIONS'],
    allowHeaders: ['Content-Type'],
  },
});

const diagnoseResource = api.root.addResource('diagnose');
diagnoseResource.addMethod(
  'POST',
  new apigateway.LambdaIntegration(diagnosticsFunction)
);

// Output the API URL
backend.addOutput({
  custom: {
    apiUrl: api.url,
  },
});

