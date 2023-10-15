#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { PipeLineStack } from '../lib/pipeline-stack';
import { IamStack } from '../lib/iam-stack';
import { CrossAccountRoleStack } from '../lib/cross-account-role';
import { ArtifactStack } from '../lib/artifact-stack';
import { env } from 'process';

const app = new cdk.App();

// Tolling AccountのIAMロール作成スタック
const iamStack = new IamStack(app, 'IamStack', {
  env: {
    account: process.env.TOOLING_ACCOUNT || "",
    region: process.env.TOOLING_ACCOUNT_REGION || ""
  },
  toolingKmsArn: process.env.TOOLING_REGION_KEY_ARN || "",
  tenantKmsArn: process.env.TENANT_REGION_KEY_ARN || "",
  tenantAccount: process.env.TENANT_ACCOUNT || "",
  tenantRegion: process.env.TENANT_ACCOUNT_REGION || "",
  toolingArtifactStore: process.env.TOOLING_REGION_BUCKET || "",
  tenantArtifactStore: process.env.TENANT_REGION_BUCKET || "",
});

//iamStackで作られる全てのAWSリソースにタグをアタッチ
cdk.Tags.of(iamStack).add('Project', 'cdk-lswn');
cdk.Tags.of(iamStack).add('Class', 'IAM Stack');


//Tolling AccountリージョンのS3バケット
const toolingRegionArtifactStack = new ArtifactStack(app, 'ToolingRegionArtifactStack', {
  env: {
    region: process.env.TOOLING_ACCOUNT_REGION // Tooling Accountのリージョン
  },
  artifactStoreName: process.env.TOOLING_REGION_BUCKET || "",
  artifaceKmsKeyArn: process.env.TOOLING_REGION_KEY_ARN  || "",
  tenantAccount:process.env.TENANT_ACCOUNT || ""
});

//Tenant AccountリージョンのS3バケット
const tenantRegionArtifactStack = new ArtifactStack(app, 'TenantRegionArtifactStack', {
  env: {
    region: process.env.TENANT_ACCOUNT_REGION // Tenant Accountのリージョン
  },
  artifactStoreName: process.env.TENANT_REGION_BUCKET || "",
  artifaceKmsKeyArn: process.env.TENANT_REGION_KEY_ARN || "",
  tenantAccount:process.env.TENANT_ACCOUNT || ""
});

//iamStackで作られる全てのAWSリソースにタグをアタッチ
cdk.Tags.of(toolingRegionArtifactStack).add('Project', 'cdk-lswn');
cdk.Tags.of(toolingRegionArtifactStack).add('Class', 'Artifact Stack');
cdk.Tags.of(tenantRegionArtifactStack).add('Project', 'cdk-lswn');
cdk.Tags.of(tenantRegionArtifactStack).add('Class', 'Artifact Stack');


// CodePipeline 作成スタック
// CrossRegion 作成時には、envに必ずregionを作成する必要があり
const pipelineStack = new PipeLineStack(app, 'PipeLineStack', {
  env: {
    account: process.env.TOOLING_ACCOUNT,  // Tooling Account 
    region: process.env.TOOLING_ACCOUNT_REGION,  // Tooling Accountのリージョン
  },
  toolingKmsArn: process.env.TOOLING_REGION_KEY_ARN || "",
  tenantKmsArn: process.env.TENANT_REGION_KEY_ARN || "",
  tenantAccount: process.env.TENANT_ACCOUNT || "",
  tenantRegion: process.env.TENANT_ACCOUNT_REGION || "",
  toolingArtifactStore: process.env.TOOLING_REGION_BUCKET || "",
  tenantArtifactStore: process.env.TENANT_REGION_BUCKET || "",
});

// PipelineStackで作られる全てのAWSリソースにタグをアタッチ
cdk.Tags.of(pipelineStack).add('Project', 'cdk-lswn');
cdk.Tags.of(pipelineStack).add('Class', 'Pipeline1');

pipelineStack.addDependency(iamStack);


// CodePipeline 作成スタック
// CrossRegion 作成時には、envに必ずregionを作成する必要があり
// const pipelineStack2 = new PipeLineStack(app, 'PipeLineStack2', {
//   env: {
//     region: process.env.TOOLING_ACCOUNT_REGION // Tooling Accountのリージョン
//   },
//   toolingKmsArn: process.env.TOOLING_REGION_KEY_ARN || "",
//   tenantKmsArn: process.env.TENANT_REGION_KEY_ARN || "",
// });

// PipelineStackで作られる全てのAWSリソースにタグをアタッチ
// cdk.Tags.of(pipelineStack2).add('Project', 'cdk-lswn');
// cdk.Tags.of(pipelineStack2).add('Class', 'Pipeline2');


// Tenat Accountで実行
// Tenant AccountのCrossAccountロール作成スタック
const crossAccountRoleStack = new CrossAccountRoleStack(app, 'CrossAccountRoleStack', {
  env: {
    region: process.env.TENANT_ACCOUNT_REGION
  },
  tenantKmsArn: process.env.TENANT_REGION_KEY_ARN || "",
  tenantArtifactStore: process.env.TENANT_REGION_BUCKET || "",
  toolingAccount: process.env.TOOLING_ACCOUNT || "",
  tenantAccount: process.env.TENANT_ACCOUNT || "",
  tenantRegion: process.env.TENANT_ACCOUNT_REGION || ""
})

cdk.Tags.of(crossAccountRoleStack).add('Project', 'cdk-lswn');
cdk.Tags.of(crossAccountRoleStack).add('Class', 'CrossAccountRole');