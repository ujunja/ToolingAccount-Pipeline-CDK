import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { ManagedPolicy, Role, PolicyStatement, ServicePrincipal, AccountPrincipal } from 'aws-cdk-lib/aws-iam';

/**
 * スタック属性
 * @export
 * @interface IamProps
 * @extends {StackProps}
 */
interface IamProps extends cdk.StackProps {
	toolingKeyArn: string,
	tenantKeyArn: string
	tenantAccount: string,
	tenantRegion: string,
	toolingArtifactStore: string,
	tenantArtifactStore: string
}

export class IamStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: IamProps) {
    super(scope, id, props);

		//CodeBuildのログ機能を有効化する。
		//CodePipelineのでファイルロールに入ります。
		const CodeBuildLogPolicy = new PolicyStatement({
			resources: [
				`arn:aws:logs:${props.env?.region}:${props.env?.account}:log-group:/aws/codebuild/${this.node.tryGetContext('CodeBuildProName')}*:*`
			],
			actions: [
				'logs:CreateLogGroup',
        		'logs:CreateLogStream',
        		'logs:PutLogEvents'
			]
		});

		//CodeCoomit RepoからSourceをもらうポリシー
		const CodeBuildPullPolicy = new PolicyStatement({
			resources: [
				`arn:aws:codecommit:${props.env?.region}:${props.env?.account}:${this.node.tryGetContext('CodeCommitRepoName')}`
			],
			actions: [
				'codecommit:GitPull'
			]
		});


		//Kms復号化Policy
		const DecryptKmsPolicy = new PolicyStatement({
			resources: [
				props.toolingKeyArn,
				props.tenantKeyArn
			],
			actions: [
				'kms:Decrypt',
				'kms:DescribeKey',
				'kms:Encrypt',
				'kms:ReEncrypt*',
				'kms:GenerateDataKey*'
			],
		})

		//CodeCoomit Action Stage Policy
		const CodeCommitActionPolicy = new PolicyStatement({
			resources: [
				`arn:aws:codecommit:${props.env?.region}:${props.env?.account}:${this.node.tryGetContext('CodeCommitRepoName')}`
			],
			actions: [
				'codecommit:GetBranch',
        		'codecommit:GetCommit',
        		'codecommit:UploadArchive',
        		'codecommit:GetUploadArchiveStatus',
        		'codecommit:CancelUploadArchive'
			]
		})

		//CodeBuild Action Stage Policy
		const CodeBuildActionPolicy = new PolicyStatement({
			resources: [
				`arn:aws:codebuild:${props.env?.region}:${props.env?.account}:project/${this.node.tryGetContext('CodeBuildProName')}`
			],
			actions: [
				'codebuild:BatchGetBuilds',
				'codebuild:StartBuild',
				'codebuild:StopBuild'
			]
		})

		//Cloudformation Action Stage Policy
		//PassRole
		const CloudformationActionPassRolePolicy = new PolicyStatement({
			resources: [
				`arn:aws:iam::${props.env?.account}:role/${this.node.tryGetContext('DeploymentRole')}`
			],
			actions: [
				'iam:PassRole'
			]
		})
		//CloudFormation
		const CloudformationActionDeployPolicy = new PolicyStatement({
			resources: [
				`arn:aws:cloudformation:${props.env?.region}:${props.env?.account}:stack/*`
			],
			actions: [
				'cloudformation:*'
			]
		})

		//S3 Bucket Policy
		const s3BucketFullPolicy = new PolicyStatement({
			resources: [
				`arn:aws:s3:::${props.toolingArtifactStore}/*`,
				`arn:aws:s3:::${props.tenantArtifactStore}/*`
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

		//シンガポールリージョンのS3バケットから持ち出しするポリシー(Tooling)
		//싱가포르 리전의 버킷으로부터 오브젝트를 가져오는 정책 
		const GetToolingBucketPolicy = new PolicyStatement({
			resources: [
				`arn:aws:s3:::${props.toolingArtifactStore}/*`
			],
			actions: [
				's3:GetObject'
			],
		})

		const CodepipelineAssumeRole = new PolicyStatement({
			resources: [
				`arn:aws:iam::${props.env?.account}:role/${this.node.tryGetContext('CommitActionRole')}`,
				`arn:aws:iam::${props.env?.account}:role/${this.node.tryGetContext('BuildActionRole')}`,
				`arn:aws:iam::${props.env?.account}:role/${this.node.tryGetContext('DeploymentActionRole')}`,
				`arn:aws:iam::${props.env?.account}:role/${this.node.tryGetContext('DeploymentRole')}`,
				`arn:aws:iam::${props.tenantAccount}:role/${this.node.tryGetContext('CrossAccountRole')}`
			],
			actions: [
				'sts:AssumeRole'
			]
		})

		//CodePipelineデフォルトロール
		const CodePipelineRole = new Role(this, 'Pipeline_Role', {
			roleName: this.node.tryGetContext('CodepipelineRole'),
			assumedBy: new ServicePrincipal('codepipeline.amazonaws.com')
		})

		CodePipelineRole.addToPrincipalPolicy(DecryptKmsPolicy);
		CodePipelineRole.addToPrincipalPolicy(s3BucketFullPolicy);
		CodePipelineRole.addToPrincipalPolicy(CodeBuildLogPolicy);
		CodePipelineRole.addToPrincipalPolicy(CodepipelineAssumeRole);

		//CodeCommit Action Stagロール
		const CodeCommitActionRole = new Role(this, 'CodeCommitAction_Role', {
			roleName: this.node.tryGetContext('CommitActionRole'),
			assumedBy: new AccountPrincipal(`${props.env?.account}`)
		})

		CodeCommitActionRole.addToPrincipalPolicy(DecryptKmsPolicy);
		CodeCommitActionRole.addToPrincipalPolicy(s3BucketFullPolicy);
		CodeCommitActionRole.addToPrincipalPolicy(CodeCommitActionPolicy);

		//CodeBuild Action Stageロール
		const CodeBuildActionRole = new Role(this, 'CodeBuildAction_Role', {
			roleName: this.node.tryGetContext('BuildActionRole'),
			assumedBy: new AccountPrincipal(`${props.env?.account}`)
		})

		CodeBuildActionRole.addToPrincipalPolicy(CodeBuildActionPolicy);

		//Deploymeny Action Stage 역할
		const CloudformationActionRole = new Role(this, 'DeploymentActionRole', {
			roleName: this.node.tryGetContext('DeploymentActionRole'),
			assumedBy: new AccountPrincipal(`${props.env?.account}`)
		})

		CloudformationActionRole.addToPrincipalPolicy(DecryptKmsPolicy);
		CloudformationActionRole.addToPrincipalPolicy(GetToolingBucketPolicy);
		CloudformationActionRole.addToPrincipalPolicy(CloudformationActionPassRolePolicy);
		CloudformationActionRole.addToPrincipalPolicy(CloudformationActionDeployPolicy);

		//CodeBuild自体が持つロール
		const CodeBuildRole = new Role(this, 'CodeBuild_Role', {
			roleName: this.node.tryGetContext('CodeBuildRole'),
			assumedBy: new ServicePrincipal('codebuild.amazonaws.com'),
		});

		CodeBuildRole.addToPrincipalPolicy(DecryptKmsPolicy);
		CodeBuildRole.addToPrincipalPolicy(s3BucketFullPolicy);
		CodeBuildRole.addToPrincipalPolicy(CodeBuildPullPolicy);
		CodeBuildRole.addToPrincipalPolicy(CodeBuildLogPolicy);
		// CodeBuildRole.addManagedPolicy(ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMReadOnlyAccess'));

		//ManagedPolicy 를 Attach 하려면 FromRole 로는 안된다... 무조건 Create 단계에서...
		const CfnDeploymentRole = new Role(this, 'CloudFormation_Deploymenty_Role', {
			roleName: this.node.tryGetContext('DeploymentRole'),
			assumedBy: new ServicePrincipal('cloudformation.amazonaws.com'),
		});

		// addManagedPolicy : cdk.aws_iam.IManagedPolicy形式の
		// fromAwsManagedPolicyName : 名前でAWS Management Policyの情報修得
		// https://bobbyhadz.com/blog/managed-policy-aws-cdk
		CfnDeploymentRole.addManagedPolicy(ManagedPolicy.fromAwsManagedPolicyName('AWSCloudFormationFullAccess'));
		CfnDeploymentRole.addManagedPolicy(ManagedPolicy.fromAwsManagedPolicyName('AWSLambda_FullAccess'));
		CfnDeploymentRole.addManagedPolicy(ManagedPolicy.fromAwsManagedPolicyName('AmazonAPIGatewayAdministrator'));
		CfnDeploymentRole.addManagedPolicy(ManagedPolicy.fromAwsManagedPolicyName('IAMFullAccess'));
		CfnDeploymentRole.addManagedPolicy(ManagedPolicy.fromAwsManagedPolicyName('ResourceGroupsandTagEditorFullAccess'));
		CfnDeploymentRole.addManagedPolicy(ManagedPolicy.fromAwsManagedPolicyName('CloudWatchApplicationInsightsFullAccess'));
		CfnDeploymentRole.addToPrincipalPolicy(DecryptKmsPolicy);
		CfnDeploymentRole.addToPrincipalPolicy(GetToolingBucketPolicy);

  }
}