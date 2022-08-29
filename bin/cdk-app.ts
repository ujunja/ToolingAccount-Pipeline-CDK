#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { PipeLineStack } from '../lib/pipeline-stack';
import { IamStack } from '../lib/iam-stack';

const app = new cdk.App();


const iamStack = new IamStack(app, 'IamStack');

cdk.Tags.of(iamStack).add('Project', 'cdk-eye');

// 入力必要
const pipelineStack = new PipeLineStack(app, 'CdkAppStack', {
  env: {
    account: '199836234156',
    region: 'ap-southeast-1',
  },
});

pipelineStack.addDependency(iamStack);


 