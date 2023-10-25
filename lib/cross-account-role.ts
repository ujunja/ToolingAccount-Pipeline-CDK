import * as cdk from 'aws-cdk-lib';
import { AccountPrincipal, ManagedPolicy, PolicyStatement, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

/**
 * スタック属性
 * @export
 * @interface CrossAccountRoleProps
 * @extends {StackProps}
 */
interface CrossAccountRoleProps extends cdk.StackProps {
	tenantArtifactStore: string,
	toolingAccount: string,
	tenantAccount: string,
	tenantRegion: string,
	tenantKmsArn: string
}

export class CrossAccountRoleStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props: CrossAccountRoleProps) {
      super(scope, id, props);

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
				`arn:aws:iam::${props.tenantAccount}:role/${this.node.tryGetContext('DeploymentRole')}`
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
			roleName: this.node.tryGetContext('CrossAccountRole'),
			assumedBy: new AccountPrincipal(props.toolingAccount)
		})

		// CrossAccount ロールにポリシーをアタッチ
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
		CfnDeploymentRole.addManagedPolicy(ManagedPolicy.fromAwsManagedPolicyName('ResourceGroupsandTagEditorFullAccess'));
		CfnDeploymentRole.addManagedPolicy(ManagedPolicy.fromAwsManagedPolicyName('CloudWatchApplicationInsightsFullAccess'));
		CfnDeploymentRole.addToPrincipalPolicy(GetTokyoBucketPolicy);

		new cdk.CfnOutput(this, this.node.tryGetContext('CrossAccountRole'), {
			value: CrossAccountRole.roleArn,
			exportName: this.node.tryGetContext('CrossAccountRole'),
			description: "CloudFormation DeploymentRole of Tenant Account"
		});

		new cdk.CfnOutput(this, this.node.tryGetContext('DeploymentRole'), {
			value: CfnDeploymentRole.roleArn,
			exportName: this.node.tryGetContext('DeploymentRole'),
			description: "CloudFormation DeploymentRole of Tenant Account"
		 });
  }
}  