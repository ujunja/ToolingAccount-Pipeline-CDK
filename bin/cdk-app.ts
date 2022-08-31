#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { PipeLineStack } from '../lib/pipeline-stack';
import { IamStack } from '../lib/iam-stack';
import { CrossAccountRoleStack } from '../lib/cross-account-role';
import { ArtifactStack } from '../lib/artifact-stack';

const app = new cdk.App();

// Tolling AccountのIAMロール作成スタック
const iamStack = new IamStack(app, 'IamStack');

// iamStackで作られる全てのAWSリソースにタグをアタッチ
cdk.Tags.of(iamStack).add('Project', 'cdk-eye');
cdk.Tags.of(iamStack).add('Class', 'IAM Stack');


// Tolling AccountのIAMロール作成スタック
const artifactStack = new ArtifactStack(app, 'ArtifactStack');

// iamStackで作られる全てのAWSリソースにタグをアタッチ
cdk.Tags.of(artifactStack).add('Project', 'cdk-eye');
cdk.Tags.of(artifactStack).add('Class', 'Artifact Stack');


// CodePipeline 作成スタック
// CrossRegion 作成時には、envに必ずregionを作成する必要があり
const pipelineStack = new PipeLineStack(app, 'PipeLineStack', {
  env: {
    account: '199836234156',  // Tooling Account 
    region: 'ap-southeast-1'  // Tooling Accountのリージョン
  }
});

// PipelineStackで作られる全てのAWSリソースにタグをアタッチ
cdk.Tags.of(pipelineStack).add('Project', 'cdk-eye');
cdk.Tags.of(pipelineStack).add('Class', 'Pipeline1');

pipelineStack.addDependency(iamStack);


// CodePipeline 作成スタック
// CrossRegion 作成時には、envに必ずregionを作成する必要があり
const pipelineStack2 = new PipeLineStack(app, 'PipeLineStack2', {
  env: {
    region: 'ap-southeast-1'  // Tooling Accountのリージョン
  }
});

// PipelineStackで作られる全てのAWSリソースにタグをアタッチ
cdk.Tags.of(pipelineStack2).add('Project', 'cdk-eye');
cdk.Tags.of(pipelineStack2).add('Class', 'Pipeline2');


// Tenant AccountのCrossAccountロール作成スタック
const crossAccountRoleStack = new CrossAccountRoleStack(app, 'CrossAccountRoleStack', {
  env: {
    region: 'ap-northeast-1'
  }
})

cdk.Tags.of(crossAccountRoleStack).add('Project', 'cdk-eye');
cdk.Tags.of(crossAccountRoleStack).add('Class', 'CrossAccountRole');