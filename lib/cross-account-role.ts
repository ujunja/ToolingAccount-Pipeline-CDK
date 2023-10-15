import * as cdk from 'aws-cdk-lib';
import { AccountPrincipal, ManagedPolicy, PolicyStatement, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

interface CrossAccountRoleProps extends cdk.StackProps {
	tenantKmsArn: string,
	tenantArtifactStore: string,
	toolingAccount: string,
	tenantAccount: string,
	tenantRegion: string,
  }
  

export class CrossAccountRoleStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props: CrossAccountRoleProps) {
      super(scope, id, props);

    // Tooling AccountのKms Key アクセスポリシー
		const DecryptKmsPolicy = new PolicyStatement({
			resources: [
				props.tenantKmsArn
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
				`arn:aws:s3:::${props.tenantArtifactStore}/*`
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
				`arn:aws:iam::${props.toolingAccount}:role/${this.node.tryGetContext('DeploymentRole')}`
			],
			actions: [
				'iam:PassRole'
			]
		})

		// CrossAccountロールが使えるCloudformation権限のポリシー
		const CloudFormationDeploymentRole = new PolicyStatement({
			resources: [
				`arn:aws:cloudformation:${props.tenantRegion}:${props.tenantAccount}:stack/*`
			],
			actions: [
				'cloudformation:*'
			]
		})

		// CrossAccount ロール
		const CrossAccountRole = new Role(this, 'Cross_Account_Role', {
			roleName: 'CDK-Cross-Account-Role',
			assumedBy: new AccountPrincipal(props.toolingAccount)
		})

		// CrossAccount ロールにポリシーをアタッチ
		CrossAccountRole.addToPrincipalPolicy(DecryptKmsPolicy);
		CrossAccountRole.addToPrincipalPolicy(GetTokyoBucketPolicy);
		CrossAccountRole.addToPrincipalPolicy(CrossAccountPassRolePolicy);
		CrossAccountRole.addToPrincipalPolicy(CloudFormationDeploymentRole);

		// Cloudformation Deployment ロール
		const CfnDeploymentRole = new Role(this, 'CloudFormation_Deploymenty_Role', {
			roleName: this.node.tryGetContext('DeploymentRole'),
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