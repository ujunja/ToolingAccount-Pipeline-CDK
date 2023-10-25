#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { PipeLineStack } from '../lib/pipeline-stack';
import { IamStack } from '../lib/iam-stack';
import { CrossAccountRoleStack } from '../lib/cross-account-role';
import { ArtifactStack } from '../lib/artifact-stack';
import { KmsStack } from '../lib/kms-key';
import { TenantKmsPolicyStack } from '../lib/tenant-kms-policy';

const app = new cdk.App();

const toolingKmsKey = 'toolingKmsKey'
const tenantKmsKey = 'tenantKmsKey'

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

// Tenat Accountで実行
// Tenant AccountのKMS KEY 復号化のポリシー作成スタック
new TenantKmsPolicyStack(app, 'TenantKmsPolicyStack', {
  env: {
    region: process.env.TENANT_ACCOUNT_REGION
  },
  tenantKmsArn: process.env.TENANT_REGION_KEY_ARN || "",
})

cdk.Tags.of(crossAccountRoleStack).add('Project', 'cdk-lswn');
cdk.Tags.of(crossAccountRoleStack).add('Class', 'TenantKmsPolicyStack');


// Tolling AccountのIAMロール作成スタック
const toolingKmsStack = new KmsStack(app, 'KmsStack', {
  env: {
    account: process.env.TOOLING_ACCOUNT || "",
    region: process.env.TOOLING_ACCOUNT_REGION || ""
  },
  tenantCheck: false,
  keyName: toolingKmsKey,
  tenantAccount: process.env.TENANT_ACCOUNT || ""
});

//kamStackで作られる全てのAWSリソースにタグをアタッチ
cdk.Tags.of(toolingKmsStack).add('Project', 'cdk-lswn');
cdk.Tags.of(toolingKmsStack).add('Class', 'KMS Stack');

// Tenant AccountのIAMロール作成スタック
const tenantKmsStack = new KmsStack(app, 'TenantKmsStack', {
  env: {
    account: process.env.TOOLING_ACCOUNT || "",
    region: process.env.TENANT_ACCOUNT_REGION || ""
  },
  tenantCheck: true,
  keyName: tenantKmsKey,
  tenantAccount: process.env.TENANT_ACCOUNT || ""
});

//kamStackで作られる全てのAWSリソースにタグをアタッチ
cdk.Tags.of(tenantKmsStack).add('Project', 'cdk-lswn');
cdk.Tags.of(tenantKmsStack).add('Class', 'KMS Stack');

// Tolling AccountのIAMロール作成スタック
const iamStack = new IamStack(app, 'IamStack', {
  env: {
    account: process.env.TOOLING_ACCOUNT || "",
    region: process.env.TOOLING_ACCOUNT_REGION || "",
  },
  tenantKeyArn: process.env.TENANT_REGION_KEY_ARN || "",
  toolingKeyArn: process.env.TOOLING_REGION_KEY_ARN || "",
  tenantAccount: process.env.TENANT_ACCOUNT || "",
  tenantRegion: process.env.TENANT_ACCOUNT_REGION || "",
  toolingArtifactStore: process.env.TOOLING_REGION_BUCKET || "",
  tenantArtifactStore: process.env.TENANT_REGION_BUCKET || "",  
});

iamStack.addDependency(toolingKmsStack);
iamStack.addDependency(tenantKmsStack);

//iamStackで作られる全てのAWSリソースにタグをアタッチ
cdk.Tags.of(iamStack).add('Project', 'cdk-lswn');
cdk.Tags.of(iamStack).add('Class', 'IAM Stack');


//Tolling AccountリージョンのS3バケット
const toolingRegionArtifactStack = new ArtifactStack(app, 'ToolingRegionArtifactStack', {
  env: {
    region: process.env.TOOLING_ACCOUNT_REGION // Tooling Accountのリージョン
  },
  artifactStoreName: process.env.TOOLING_REGION_BUCKET || "",
  keyName: toolingKmsKey,
  tenantAccount:process.env.TENANT_ACCOUNT || ""
});

toolingRegionArtifactStack.addDependency(toolingKmsStack);

//Tenant AccountリージョンのS3バケット
const tenantRegionArtifactStack = new ArtifactStack(app, 'TenantRegionArtifactStack', {
  env: {
    region: process.env.TENANT_ACCOUNT_REGION // Tenant Accountのリージョン
  },
  artifactStoreName: process.env.TENANT_REGION_BUCKET || "",
  keyName: tenantKmsKey,
  tenantAccount:process.env.TENANT_ACCOUNT || ""
});

tenantRegionArtifactStack.addDependency(tenantKmsStack);

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

pipelineStack.addDependency(toolingRegionArtifactStack);
pipelineStack.addDependency(tenantRegionArtifactStack);
pipelineStack.addDependency(iamStack);

