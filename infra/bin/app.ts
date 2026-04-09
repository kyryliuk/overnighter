#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { OvernighterAiStack } from '../lib/overnighter-ai-stack';

const app = new cdk.App();

new OvernighterAiStack(app, 'OvernighterAiStack', {
  // Pull account + region from CDK bootstrap context so the same code
  // can be deployed to any environment without hard-coding values.
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
});
