#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib/core';
import { SqsFanOutAssignmentStack } from '../lib/sqs-fan-out-assignment-stack';

const app = new cdk.App();
new SqsFanOutAssignmentStack(app, 'SqsFanOutAssignmentStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
  description: 'Image processing pipeline with S3, SNS, SQS, and Lambda',
});
