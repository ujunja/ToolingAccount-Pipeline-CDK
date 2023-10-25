import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Key } from 'aws-cdk-lib/aws-kms';
import { ArnPrincipal, PolicyStatement, Role } from 'aws-cdk-lib/aws-iam';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { Repository } from 'aws-cdk-lib/aws-codecommit';
import { BuildEnvironmentVariableType, BuildSpec, LinuxBuildImage, PipelineProject } from 'aws-cdk-lib/aws-codebuild';
import { Artifact, Pipeline } from 'aws-cdk-lib/aws-codepipeline';
import * as codepipeline_actions from 'aws-cdk-lib/aws-codepipeline-actions';

/**
 * スタック属性
 * @export
 * @interface PipelineProps
 * @extends {StackProps}
 */
interface PipelineProps extends cdk.StackProps {
  toolingKmsArn: string,
  tenantKmsArn: string,
  tenantAccount: string,
  tenantRegion: string,
  toolingArtifactStore: string,
  tenantArtifactStore: string,
}

export class PipeLineStack extends cdk.Stack {
  
  constructor(scope: Construct, id: string, props: PipelineProps) {
    super(scope, id, props);


    // TenantAccountのCrossAccountロール = Deploy-Tokyo Action Stageのロール
    const CrossAccountRole = Role.fromRoleArn(
      this,
      'CrossAccountRole',
      `arn:aws:iam::${props.tenantAccount}:role/${this.node.tryGetContext('CrossAccountRole')}`,
      {
        mutable: false
      }
    )
    
    // Tenant AccountのCfnロール
    const TenantCloudFormationRole = Role.fromRoleArn(
      this,
      'TenantCfnDeploymentRole',
      `arn:aws:iam::${props.tenantAccount}:role/${this.node.tryGetContext('DeploymentRole')}`,
      {
        mutable: false,
      }
    );

    //ロール向けKms復号化Policy
    //必ず、CrossAccountRoleStackが実行して、
    //tenantアカウントにCrossAccountRoleとCloudFromationロールを作成した後、KMSポリシーに付与可能
    const tenantDecryptPolicy = new PolicyStatement({
      actions: [
          'kms:Decrypt',
          'kms:DescribeKey',
      ],
      principals: [
        new ArnPrincipal(`arn:aws:iam::${props.tenantAccount}:role/${this.node.tryGetContext('CrossAccountRole')}`),
        new ArnPrincipal(`arn:aws:iam::${props.tenantAccount}:role/${this.node.tryGetContext('DeploymentRole')}`)
      ],
      resources: [
          "*"
      ]
    })
    
    //TOOLING KMS KEY
    const toolingKey = Key.fromKeyArn(
      this,
      'ArtifactStore_KMSKey_Tooling',
      props.toolingKmsArn
    );

    //TENANT KMS KEY
    const tenantKey = Key.fromKeyArn(
      this,
      'ArtifactStore_KMSKey_Tenant',
      props.tenantKmsArn
    );

    //tenantアカウントは、tenantリージョンのみ復号化権限必要
    tenantKey.addToResourcePolicy(tenantDecryptPolicy)

    // CodePipeline Role
    const CodepipelineRole = Role.fromRoleArn(
      this,
      'CodepipelineRole',
      `arn:aws:iam::${props.env?.account}:role/${this.node.tryGetContext('CodepipelineRole')}`,
      {
        mutable: false
      }
    )

    // CodePipeline Action Stage - CodeCommit
    const CodeCommitActionRole = Role.fromRoleArn(
      this,
      'CodeCommitActionRole',
      // cdk.Fn.importValue('CodeCommitActionRoleArn'),
      `arn:aws:iam::${props.env?.account}:role/${this.node.tryGetContext('CommitActionRole')}`,
      {
        mutable: false
      }
    )
    // CodePipeline Action Stage - CodeBuild
    const CodeBuildActionRole = Role.fromRoleArn(
      this,
      'CodeBuildActionRole',
      `arn:aws:iam::${props.env?.account}:role/${this.node.tryGetContext('BuildActionRole')}`,
      {
        mutable: false
      }
    )
    // CodePipeline Action Stage - Toonling Account Deploy
    const CloudformationActionRole = Role.fromRoleArn(
      this,
      'CloudformationctionRole',
      `arn:aws:iam::${props.env?.account}:role/${this.node.tryGetContext('DeploymentActionRole')}`,
      {
        mutable: false
      }
    )


    // Tooling AccoungのSingapore KMS KeyにTenant AccountのTenantCloudFormationRole復号化権限付与
    const keyPolicy = new PolicyStatement({
      principals: [
        new ArnPrincipal(`arn:aws:iam::${props.tenantAccount}:role/${this.node.tryGetContext('CrossAccountRole')}`),
        new ArnPrincipal(`arn:aws:iam::${props.tenantAccount}:role/${this.node.tryGetContext('DeploymentRole')}`),
			],
			actions: [
				'kms:Decrypt',
        'kms:DescribeKey'
			],
      resources: [
        '*'
      ]
    })

    tenantKey.addToResourcePolicy(keyPolicy);

    // CodeBuild ROLE
    const CodeBuildRole = Role.fromRoleArn(
      this,
      'ToolinhCodeBuildRole',
      `arn:aws:iam::${props.env?.account}:role/${this.node.tryGetContext('CodeBuildRole')}`,
      {
        mutable: false,
      }
    );

    // Tooling AccountのCfnロール
    const CloudFormationRole = Role.fromRoleArn(
      this,
      'ToolingCfnDeploymentRole',
      `arn:aws:iam::${props.env?.account}:role/${this.node.tryGetContext('DeploymentRole')}`,
      {
        mutable: false,
      }
    );
    
    // Tooling AccoungのSingapore KMS KeyにTenant AccountのTenantCloudFormationRole復号化権限付与
    // tokyoKey.grantDecrypt(TenantCloudFormationRole);

    const artifactStoreTooling = Bucket.fromBucketAttributes(this, 'artifactStoreTooling', {
      bucketName: props.toolingArtifactStore,
      region: props.env?.region,
      encryptionKey: toolingKey,
    })

    const artifactStoreTenant = Bucket.fromBucketAttributes(
      this,
      'artifactStoreTenant',
      {
        bucketName: props.tenantArtifactStore,
        region: props.tenantRegion,
        encryptionKey: tenantKey,
      });

    
    const commit_repository = Repository.fromRepositoryName(
      this,
      'repo_id',
      `${this.node.tryGetContext('CodeCommitRepoName')}`  //自然に作成が必要、後で修正
    );

    //CodePipeline 구조에서 ArtifactStores 를 사용하고 싶다면 crossRegionReplicationBuckets
    //pipelineName :	The name of the pipeline.
    //crossAccountKeys : KMS keys for cross-account deployments
    //crossRegionReplicationBuckets : A map of region to S3 bucket name used for cross-region CodePipeline.
    const pipeline = new Pipeline(this, this.node.tryGetContext('PipelineName'), {
      pipelineName: this.node.tryGetContext('PipelineName'),      
      crossAccountKeys: true,
      //crossRegionReplicationBucketsのリージョンは手動で入力
      crossRegionReplicationBuckets: {
        'ap-southeast-1': artifactStoreTooling,
        'ap-northeast-1': artifactStoreTenant,
      },
      role: CodepipelineRole
    });

    const SourceArtifact = new Artifact('SourceArtifact');
    pipeline.addStage({
      stageName: 'Source',
      actions: [
        new codepipeline_actions.CodeCommitSourceAction({
          actionName: 'CodeCommit',
          repository: commit_repository,
          output: SourceArtifact,
          branch: 'main',
          role: CodeCommitActionRole          
        }),
      ],
    });

    const BuildArtifact = new Artifact('BuildArtifact');

    // Codpipeline - Build Stage
    pipeline.addStage({
      stageName: 'Build',
      actions: [
        new codepipeline_actions.CodeBuildAction({
          actionName: 'CDK_Build',
          input: SourceArtifact,
          outputs: [BuildArtifact],
          project: new PipelineProject(this, 'CdkBuildProject', {
            environment: {
              buildImage: LinuxBuildImage.STANDARD_5_0,
            },
            environmentVariables: {
              toolingBucket: {
                  type: BuildEnvironmentVariableType.PLAINTEXT,
                  value: props.toolingArtifactStore
              },
              tenantBucket: {
                type: BuildEnvironmentVariableType.PLAINTEXT,
                value: props.tenantArtifactStore
              },
              toolingTemplate: {
                type: BuildEnvironmentVariableType.PLAINTEXT,
                value: this.node.tryGetContext('toolingTemplate')
              },
              tenantTemplate: {
                type: BuildEnvironmentVariableType.PLAINTEXT,
                value: this.node.tryGetContext('tenantTemplate')
              },
              toolingKeyArn: {
                type: BuildEnvironmentVariableType.PLAINTEXT,
                value: toolingKey.keyArn
              },
              tenantKeyArn: {
                type: BuildEnvironmentVariableType.PLAINTEXT,
                value: tenantKey.keyArn
              },
            },
            buildSpec: BuildSpec.fromSourceFilename('buildspec.yaml'),
            encryptionKey: toolingKey,
            role: CodeBuildRole,
            projectName: `${this.node.tryGetContext('CodeBuildProName')}`
          }),
         role: CodeBuildActionRole
        }),
      ],
    });



    // Codpipeline - Deploy Singapore Stage
    pipeline.addStage({
      stageName: 'Deploy-Tooling',
      actions: [
        new codepipeline_actions.CloudFormationCreateUpdateStackAction({
          actionName: 'Deploy-Tooling',
          stackName: 'lswn-deploy-stack-tooling',
          templatePath: BuildArtifact.atPath(this.node.tryGetContext('toolingTemplate')),
          adminPermissions: true,
          cfnCapabilities: [
            cdk.CfnCapabilities.ANONYMOUS_IAM,
            cdk.CfnCapabilities.AUTO_EXPAND,
          ],
          extraInputs: [SourceArtifact],
          deploymentRole: CloudFormationRole,
          role: CloudformationActionRole,
          region: props.env?.region
        }),
      ],
    });


    // Codpipeline - Deploy Tokyo Stage
    pipeline.addStage({
      stageName: 'Deploy-Tenant',
      actions: [
        new codepipeline_actions.CloudFormationCreateUpdateStackAction({
          actionName: 'Deploy-Tenant',
          stackName: 'lswn-deploy-stack-tenant',
          templatePath: BuildArtifact.atPath(this.node.tryGetContext('tenantTemplate')),
          adminPermissions: true,
          cfnCapabilities: [
            cdk.CfnCapabilities.ANONYMOUS_IAM,
            cdk.CfnCapabilities.AUTO_EXPAND,
          ],
          deploymentRole: TenantCloudFormationRole,
          role: CrossAccountRole,
          region: props.tenantRegion,
        }),
      ],
    });

  }
}
