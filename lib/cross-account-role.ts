import * as cdk from 'aws-cdk-lib';
import { AccountPrincipal, ManagedPolicy, PolicyStatement, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export class CrossAccountRoleStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
      super(scope, id, props);

    // Tooling AccountのKms Key アクセスポリシー
		const DecryptKmsPolicy = new PolicyStatement({
			resources: [
				this.node.tryGetContext('TokyoKmsKeyArn')
			],
			actions: [
				'kms:Decrypt',
				'kms:DescribeKey',
				'kms:Encrypt',
				'kms:ReEncrypt*',
				'kms:GenerateDataKey*'
			],
		})

		// Tooling AccountのArtifact Store アクセスポリシー
    const GetTokyoBucketPolicy = new PolicyStatement({
			resources: [
				`arn:aws:s3:::${this.node.tryGetContext('TokyoArtifactStore')}/*`
			],
			actions: [
				's3:GetObject*',
        's3:GetBucket*',
        's3:List*',
			]
		})

		// CloudFormaton DeploymentロールにCrossAccountの権限をPassするポリシー
		const CrossAccountPassRolePolicy = new PolicyStatement({
			resources: [
				`arn:aws:iam::${this.node.tryGetContext('TenantAccountId')}:role/CDK-CloudFormation-Deployment-Role`
			],
			actions: [
				'iam:PassRole'
			]
		})

		// CrossAccountロールが使えるCloudformation権限のポリシー
		const CloudFormationDeploymentRole = new PolicyStatement({
			resources: [
				`arn:aws:cloudformation:${this.node.tryGetContext('TenantAccountRegion')}:${this.node.tryGetContext('TenantAccountId')}:stack/*`
			],
			actions: [
				'cloudformation:*'
			]
		})

		// CrossAccount ロール
		const CrossAccountRole = new Role(this, 'Cross_Account_Role', {
			roleName: 'CDK-Cross-Account-Role',
			assumedBy: new AccountPrincipal(this.node.tryGetContext('ToolingAccountId'))
		})

		// CrossAccount ロールにポリシーをアタッチ
		CrossAccountRole.addToPrincipalPolicy(DecryptKmsPolicy);
		CrossAccountRole.addToPrincipalPolicy(GetTokyoBucketPolicy);
		CrossAccountRole.addToPrincipalPolicy(CrossAccountPassRolePolicy);
		CrossAccountRole.addToPrincipalPolicy(CloudFormationDeploymentRole);

		// Cloudformation Deployment ロール
		const CfnDeploymentRole = new Role(this, 'CloudFormation_Deploymenty_Role', {
			roleName: 'CDK-CloudFormation-Deployment-Role',
			assumedBy: new ServicePrincipal('cloudformation.amazonaws.com')
		})

		CfnDeploymentRole.addManagedPolicy(ManagedPolicy.fromAwsManagedPolicyName('AWSCloudFormationFullAccess'));
		CfnDeploymentRole.addManagedPolicy(ManagedPolicy.fromAwsManagedPolicyName('AWSLambda_FullAccess'));
		CfnDeploymentRole.addManagedPolicy(ManagedPolicy.fromAwsManagedPolicyName('AmazonAPIGatewayAdministrator'));
		CfnDeploymentRole.addManagedPolicy(ManagedPolicy.fromAwsManagedPolicyName('IAMFullAccess'));
		CfnDeploymentRole.addToPrincipalPolicy(DecryptKmsPolicy);
		CfnDeploymentRole.addToPrincipalPolicy(GetTokyoBucketPolicy);
  }
}  