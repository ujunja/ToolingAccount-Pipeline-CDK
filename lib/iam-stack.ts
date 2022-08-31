import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { ManagedPolicy, Role, PolicyStatement, ServicePrincipal, AccountPrincipal } from 'aws-cdk-lib/aws-iam';

export class IamStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

		// CodeBuild 에서 로그를 활성화시켜주는 Policy
		// CodePipeline 디폴트 Role 에 들어감
		const CodeBuildLogPolicy = new PolicyStatement({
			resources: [
				`arn:aws:logs:${this.node.tryGetContext('ToolingAccountRegion')}:${this.node.tryGetContext('ToolingAccountId')}:log-group:/aws/codebuild/${this.node.tryGetContext('CodeBuildProName')}*:*`
			],
			actions: [
				'logs:CreateLogGroup',
        'logs:CreateLogStream',
        'logs:PutLogEvents'
			]
		});

		// CodeCoomit RepoからSourceをもらうポリシー
		const CodeBuildPullPolicy = new PolicyStatement({
			resources: [
				`arn:aws:codecommit:${this.node.tryGetContext('ToolingAccountRegion')}:${this.node.tryGetContext('ToolingAccountId')}:${this.node.tryGetContext('CodeCommitRepoName')}`
			],
			actions: [
				'codecommit:GitPull'
			]
		});

		// Kms Key 復号化 Policy
		const DecryptKmsPolicy = new PolicyStatement({
			resources: [
				`${this.node.tryGetContext('SingaporeKmsKeyArn')}`,
				`${this.node.tryGetContext('TokyoKmsKeyArn')}`
			],
			actions: [
				'kms:Decrypt',
				'kms:DescribeKey',
				'kms:Encrypt',
				'kms:ReEncrypt*',
				'kms:GenerateDataKey*'
			],
		})

		// CodeCoomit Action Stage Policy
		const CodeCommitActionPolicy = new PolicyStatement({
			resources: [
				`arn:aws:codecommit:${this.node.tryGetContext('ToolingAccountRegion')}:${this.node.tryGetContext('ToolingAccountId')}:${this.node.tryGetContext('CodeCommitRepoName')}`
			],
			actions: [
				'codecommit:GetBranch',
        'codecommit:GetCommit',
        'codecommit:UploadArchive',
        'codecommit:GetUploadArchiveStatus',
        'codecommit:CancelUploadArchive'
			]
		})

		// CodeBuild Action Stage Policy
		const CodeBuildActionPolicy = new PolicyStatement({
			resources: [
				`arn:aws:codebuild:${this.node.tryGetContext('ToolingAccountRegion')}:${this.node.tryGetContext('ToolingAccountId')}:project/${this.node.tryGetContext('CodeBuildProName')}`
			],
			actions: [
				'codebuild:BatchGetBuilds',
				'codebuild:StartBuild',
				'codebuild:StopBuild'
			]
		})

		// Cloudformation Action Stage Policy
		// PassRole
		const CloudformationActionPassRolePolicy = new PolicyStatement({
			resources: [
				`arn:aws:iam::${this.node.tryGetContext('ToolingAccountId')}:role/CDK-CloudFormation-Deployment-Role`
			],
			actions: [
				'iam:PassRole'
			]
		})
		// CloudFormation
		const CloudformationActionDeployPolicy = new PolicyStatement({
			resources: [
				`arn:aws:cloudformation:${this.node.tryGetContext('ToolingAccountRegion')}:${this.node.tryGetContext('ToolingAccountId')}:stack/*`
			],
			actions: [
				'cloudformation:*'
			]
		})

		// S3 Bucket 전체 Policy
		const s3BucketFullPolicy = new PolicyStatement({
			resources: [
				`arn:aws:s3:::${this.node.tryGetContext('SingaporeArtifactStore')}/*`,
				`arn:aws:s3:::${this.node.tryGetContext('TokyoArtifactStore')}/*`
			],
			actions: [
				's3:GetObject*',
        's3:GetBucket*',
        's3:List*',
        's3:DeleteObject*',
        's3:PutObject*',
        's3:Abort*'
			]
		})

		// 도쿄 리전 버켓에 업로드하는 정책
		const UploadTokyoBucketPolicy = new PolicyStatement({
			resources: [
				`arn:aws:s3:::${this.node.tryGetContext('TokyoArtifactStore')}/*`
			],
			actions: [
				's3:PutObject'
			],
		})

		// 싱가포르 리전의 버킷으로부터 오브젝트를 가져오는 정책 
		const GetSingaporeBucketPolicy = new PolicyStatement({
			resources: [
				`arn:aws:s3:::${this.node.tryGetContext('SingaporeArtifactStore')}/*`
			],
			actions: [
				's3:GetObject'
			],
		})

		const CodepipelineAssumeRole = new PolicyStatement({
			resources: [
				`arn:aws:iam::${this.node.tryGetContext('ToolingAccountId')}:role/CDK-CodeCommit-Action-Role`,
				`arn:aws:iam::${this.node.tryGetContext('ToolingAccountId')}:role/CDK-CodeBuild-Action-Role`,
				`arn:aws:iam::${this.node.tryGetContext('ToolingAccountId')}:role/CDK-CloudFormation-Deployment-Role`,
				`arn:aws:iam::${this.node.tryGetContext('TenantAccountId')}:role/CDK-Cross-Account-Role`
			],
			actions: [
				'sts:AssumeRole'
			]
		})

		// CodePipeline 디폴트 역할
		const CodePipelineRole = new Role(this, 'Pipeline_Role', {
			roleName: 'CDK-CodePipeline-Service-Role',
			assumedBy: new ServicePrincipal('codepipeline.amazonaws.com')
		})

		CodePipelineRole.addToPrincipalPolicy(DecryptKmsPolicy);
		CodePipelineRole.addToPrincipalPolicy(s3BucketFullPolicy);
		CodePipelineRole.addToPrincipalPolicy(CodeBuildLogPolicy);
		CodePipelineRole.addToPrincipalPolicy(CodepipelineAssumeRole);

		// CodeCommit Action Stage역할
		const CodeCommitActionRole = new Role(this, 'CodeCommitAction_Role', {
			roleName: 'CDK-CodeCommit-Action-Role',
			assumedBy: new AccountPrincipal(`${this.node.tryGetContext('ToolingAccountId')}`)
		})

		CodeCommitActionRole.addToPrincipalPolicy(DecryptKmsPolicy);
		CodeCommitActionRole.addToPrincipalPolicy(s3BucketFullPolicy);
		CodeCommitActionRole.addToPrincipalPolicy(CodeCommitActionPolicy);

		// CodeCommit Action Stage 역할
		const CodeBuildActionRole = new Role(this, 'CodeBuildAction_Role', {
			roleName: 'CDK-CodeBuild-Action-Role',
			assumedBy: new AccountPrincipal(`${this.node.tryGetContext('ToolingAccountId')}`)
		})

		CodeBuildActionRole.addToPrincipalPolicy(CodeBuildActionPolicy);

		// CodeCommit Action Stage 역할
		const CloudformationActionRole = new Role(this, 'CloudFormationAction_Role', {
			roleName: 'CDK-Cloudformation-Action-Role',
			assumedBy: new AccountPrincipal(`${this.node.tryGetContext('ToolingAccountId')}`)
		})

		CloudformationActionRole.addToPrincipalPolicy(DecryptKmsPolicy);
		CloudformationActionRole.addToPrincipalPolicy(GetSingaporeBucketPolicy);
		CloudformationActionRole.addToPrincipalPolicy(CloudformationActionPassRolePolicy);
		CloudformationActionRole.addToPrincipalPolicy(CloudformationActionDeployPolicy);

		// CodeBuild 역할
		const CodeBuildRole = new Role(this, 'Build_Role', {
			roleName: 'CDK-CodeBuild-Service-Role',
			assumedBy: new ServicePrincipal('codebuild.amazonaws.com'),
		});

		CodeBuildRole.addToPrincipalPolicy(DecryptKmsPolicy);
		CodeBuildRole.addToPrincipalPolicy(s3BucketFullPolicy);
		CodeBuildRole.addToPrincipalPolicy(CodeBuildPullPolicy);
		CodeBuildRole.addToPrincipalPolicy(CodeBuildLogPolicy);

		//ManagedPolicy 를 Attach 하려면 FromRole 로는 안된다... 무조건 Create 단계에서...
		const CfnDeploymentRole = new Role(this, 'CloudFormation_Deploymenty_Role', {
			roleName: 'CDK-CloudFormation-Deployment-Role',
			assumedBy: new ServicePrincipal('cloudformation.amazonaws.com'),
		});

		// addManagedPolicy : cdk.aws_iam.IManagedPolicy形式の
		// fromAwsManagedPolicyName : 名前でAWS Management Policyの情報修得
		// https://bobbyhadz.com/blog/managed-policy-aws-cdk
		CfnDeploymentRole.addManagedPolicy(ManagedPolicy.fromAwsManagedPolicyName('AWSCloudFormationFullAccess'));
		CfnDeploymentRole.addManagedPolicy(ManagedPolicy.fromAwsManagedPolicyName('AWSLambda_FullAccess'));
		CfnDeploymentRole.addManagedPolicy(ManagedPolicy.fromAwsManagedPolicyName('AmazonAPIGatewayAdministrator'));
		CfnDeploymentRole.addManagedPolicy(ManagedPolicy.fromAwsManagedPolicyName('IAMFullAccess'));
		CfnDeploymentRole.addToPrincipalPolicy(DecryptKmsPolicy);
		CfnDeploymentRole.addToPrincipalPolicy(GetSingaporeBucketPolicy);


		// 이걸 사용하려면 Toolinf Account CodeBuild, CloudFormation 공유한다는 전제조건이 없어야만 한다
		new cdk.CfnOutput(this, 'CodeCommitActionRoleArnOutPut', {
			value: CodeCommitActionRole.roleArn,
			exportName: 'CodeCommitActionRoleArn',
		  });
  }
}