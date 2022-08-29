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
				`arn:aws:logs:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:log-group:/aws/codebuild/CdkBuildProject*:*`
			],
			actions: [
				'logs:CreateLogGroup',
        'logs:CreateLogStream',
        'logs:PutLogEvents'
			]
		});

		const CodeBuildPullPolicy = new PolicyStatement({
			resources: [
				`arn:aws:codecommit:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:repo-199836234156`
			],
			actions: [
				'codecommit:GitPull'
			]
		});

		// Kms Key 복호화 Policy
		const DecryptKmsPolicy = new PolicyStatement({
			resources: [
				`arn:aws:kms:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:key/a2d9b566-3c0e-4539-b06a-04e3be27b222`,
				`arn:aws:kms:ap-northeast-1:${cdk.Stack.of(this).account}:key/d8cb9c97-67da-4459-aa39-da14c41ab16b`
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
				`arn:aws:codecommit:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:repo-199836234156`
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
				`arn:aws:codebuild:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:project/CdkBuildProject`
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
				`arn:aws:iam::${cdk.Stack.of(this).account}:role/CDK-CloudFormation-Deployment-Role`
			],
			actions: [
				'iam:PassRole'
			]
		})
		// CloudFormation
		const CloudformationActionDeployPolicy = new PolicyStatement({
			resources: [
				`arn:aws:cloudformation:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:stack/*`
			],
			actions: [
				'cloudformation:*'
			]
		})

		// S3 Bucket 전체 Policy
		const s3BucketFullPolicy = new PolicyStatement({
			resources: [
				'arn:aws:s3:::codepipeline-ap-southeast-1-872854859043/*',
				'arn:aws:s3:::codepipeline-ap-northeast-bucket-lswn/*'
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
				`arn:aws:s3:::codepipeline-ap-northeast-bucket-lswn/*`
			],
			actions: [
				's3:PutObject'
			],
		})

		// 싱가포르 리전의 버킷으로부터 오브젝트를 가져오는 정책 
		const GetSingaporeBucketPolicy = new PolicyStatement({
			resources: [
				`arn:aws:s3:::codepipeline-ap-southeast-1-872854859043/*`
			],
			actions: [
				's3:GetObject'
			],
		})

		// CodePipeline 디폴트 역할
		const CodePipelineRole = new Role(this, 'Pipeline_Role', {
			roleName: 'CDK-CodePipeline-Service-Role',
			assumedBy: new ServicePrincipal('codepipeline.amazonaws.com')
		})

		CodePipelineRole.addToPrincipalPolicy(DecryptKmsPolicy);
		CodePipelineRole.addToPrincipalPolicy(s3BucketFullPolicy);
		CodePipelineRole.addToPrincipalPolicy(CodeBuildLogPolicy);

		// CodeCommit Action Stage역할
		const CodeCommitActionRole = new Role(this, 'CodeCommitAction_Role', {
			roleName: 'CDK-CodeCommit-Action-Role',
			assumedBy: new AccountPrincipal(`${cdk.Stack.of(this).account}`)
		})

		CodeCommitActionRole.addToPrincipalPolicy(DecryptKmsPolicy);
		CodeCommitActionRole.addToPrincipalPolicy(s3BucketFullPolicy);
		CodeCommitActionRole.addToPrincipalPolicy(CodeCommitActionPolicy);

		// CodeCommit Action Stage 역할
		const CodeBuildActionRole = new Role(this, 'CodeBuildAction_Role', {
			roleName: 'CDK-CodeBuild-Action-Role',
			assumedBy: new AccountPrincipal(`${cdk.Stack.of(this).account}`)
		})

		CodeBuildActionRole.addToPrincipalPolicy(CodeBuildActionPolicy);

		// CodeCommit Action Stage 역할
		const CloudformationActionRole = new Role(this, 'CloudFormationAction_Role', {
			roleName: 'CDK-Cloudformation-Action-Role',
			assumedBy: new AccountPrincipal(`${cdk.Stack.of(this).account}`)
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
		const CloudFormationRole = new Role(this, 'Sample_role', {
			roleName: 'CDK-CloudFormation-Deployment-Role',
			assumedBy: new ServicePrincipal('cloudformation.amazonaws.com'),
		});

		// https://bobbyhadz.com/blog/managed-policy-aws-cdk
		CloudFormationRole.addManagedPolicy(ManagedPolicy.fromAwsManagedPolicyName('AWSCloudFormationFullAccess'));
		CloudFormationRole.addManagedPolicy(ManagedPolicy.fromAwsManagedPolicyName('AWSLambda_FullAccess'));
		CloudFormationRole.addManagedPolicy(ManagedPolicy.fromAwsManagedPolicyName('AmazonAPIGatewayAdministrator'));
		CloudFormationRole.addManagedPolicy(ManagedPolicy.fromAwsManagedPolicyName('IAMFullAccess'));
		CloudFormationRole.addToPrincipalPolicy(DecryptKmsPolicy);
		CloudFormationRole.addToPrincipalPolicy(GetSingaporeBucketPolicy);
  }
}