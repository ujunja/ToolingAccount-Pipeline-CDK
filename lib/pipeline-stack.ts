import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Key } from 'aws-cdk-lib/aws-kms';
import { ArnPrincipal, PolicyStatement, Role } from 'aws-cdk-lib/aws-iam';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { Repository } from 'aws-cdk-lib/aws-codecommit';
import { BuildSpec, LinuxBuildImage, PipelineProject } from 'aws-cdk-lib/aws-codebuild';
import { Artifact, Pipeline } from 'aws-cdk-lib/aws-codepipeline';
import * as codepipeline_actions from 'aws-cdk-lib/aws-codepipeline-actions';

export class PipeLineStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // 既存のKMS KEY
    const tokyoKey = Key.fromKeyArn(
      this,
      'EYES_ArtifactStore_KMSKey',
      `${this.node.tryGetContext('TokyoKmsKeyArn')}`
    );

    // 既存のKMS KEY
    const singaporeKey = Key.fromKeyArn(
      this,
      'EYES_ArtifactStore_KMSKey_Singapore',
      `${this.node.tryGetContext('SingaporeKmsKeyArn')}`
    );


    // `arn:aws:iam::${this.node.tryGetContext('ToolingAccountId')}:role/CDK-CodeCommit-Action-Role`,
    
    // CodePipeline Action Stage - CodeCommit
    const CodeCommitActionRole = Role.fromRoleArn(
      this,
      'CodeCommitActionRole',
      cdk.Fn.importValue('CodeCommitActionRoleArn'),
      {
        mutable: false
      }
    )
    // CodePipeline Action Stage - CodeBuild
    const CodeBuildActionRole = Role.fromRoleArn(
      this,
      'CodeBuildActionRole',
      `arn:aws:iam::${this.node.tryGetContext('ToolingAccountId')}:role/CDK-CodeBuild-Action-Role`,
      {
        mutable: false
      }
    )
    // CodePipeline Action Stage - Toonling Account Deploy
    const CloudformationActionRole = Role.fromRoleArn(
      this,
      'CloudformationctionRole',
      `arn:aws:iam::${this.node.tryGetContext('ToolingAccountId')}:role/CDK-Cloudformation-Action-Role`,
      {
        mutable: false
      }
    )

    // TenantAccountのCrossAccountロール = Deploy-Tokyo Action Stageのロール
    const CrossAccountRole = Role.fromRoleArn(
      this,
      'CrossAccountRole',
      `arn:aws:iam::${this.node.tryGetContext('TenantAccountId')}:role/CDK-Cross-Account-Role`,
      {
        mutable: false
      }
    )

    // Tooling AccoungのSingapore KMS KeyにTenant AccountのTenantCloudFormationRole復号化権限付与
    const keyPolicy = new PolicyStatement({
      principals: [
        new ArnPrincipal(`arn:aws:iam::${this.node.tryGetContext('TenantAccountId')}:role/CDK-Cross-Account-Role`),
        new ArnPrincipal(`arn:aws:iam::${this.node.tryGetContext('TenantAccountId')}:role/CDK-CloudFormation-Deployment-Role`),
			],
			actions: [
				'kms:Decrypt',
        'kms:DescribeKey'
			],
      resources: [
        '*'
      ]
    })

    tokyoKey.addToResourcePolicy(keyPolicy);

    // CodeBuild ROLE
    const CodeBuildRole = Role.fromRoleArn(
      this,
      'ProdCodeBuildRole',
      `arn:aws:iam::${this.node.tryGetContext('ToolingAccountId')}:role/CDK-CodeBuild-Service-Role`,
      {
        mutable: false,
      }
    );

    // Tooling AccountのCfnロール
    const CloudFormationRole = Role.fromRoleArn(
      this,
      'ToolingCfnDeploymentRole',
      `arn:aws:iam::${this.node.tryGetContext('ToolingAccountId')}:role/CDK-CloudFormation-Deployment-Role`,
      {
        mutable: false,
      }
    );

    // Tenant AccountのCfnロール
    const TenantCloudFormationRole = Role.fromRoleArn(
      this,
      'TenantCfnDeploymentRole',
      `arn:aws:iam::${this.node.tryGetContext('TenantAccountId')}:role/CDK-CloudFormation-Deployment-Role`,
      {
        mutable: false,
      }
    );
    
    // Tooling AccoungのSingapore KMS KeyにTenant AccountのTenantCloudFormationRole復号化権限付与
    // tokyoKey.grantDecrypt(TenantCloudFormationRole);

    const artifactStoreSingapore = Bucket.fromBucketAttributes(this, 'artifactStoreSingapore', {
      bucketName: `${this.node.tryGetContext('SingaporeArtifactStore')}`,
      region: 'ap-southeast-1',
      encryptionKey: singaporeKey,
    })

    const artifactStoreTokyo = Bucket.fromBucketAttributes(
      this,
      'import existing bucket tokyo',
      {
        bucketName: `${this.node.tryGetContext('TokyoArtifactStore')}`,
        region: `${this.node.tryGetContext('ToolingAccountRegion')}`,
        encryptionKey: tokyoKey,
      });

    
    const commit_repository = Repository.fromRepositoryName(
      this,
      'repo_id',
      `${this.node.tryGetContext('CodeCommitRepoName')}`
    );

    // CodePipeline 구조에서 ArtifactStores 를 사용하고 싶다면 crossRegionReplicationBuckets
    // pipelineName :	The name of the pipeline.
    // crossAccountKeys : KMS keys for cross-account deployments
    // crossRegionReplicationBuckets : A map of region to S3 bucket name used for cross-region CodePipeline.
    const pipeline = new Pipeline(this, 'eye-password-change-api-pipeline', {
      pipelineName: 'eye-password-change-api-pipeline',
      crossAccountKeys: true,
      crossRegionReplicationBuckets: {
        'ap-southeast-1': artifactStoreSingapore,
        'ap-northeast-1': artifactStoreTokyo,
      },
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
          // role: CodeCommitActionRole          
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
            buildSpec: BuildSpec.fromSourceFilename('buildspec.yml'),
            encryptionKey: singaporeKey,
            role: CodeBuildRole,
            projectName: `${this.node.tryGetContext('CodeBuildProName')}`
          }),
          // role: CodeBuildActionRole
        }),
      ],
    });

    // Codpipeline - Deploy Singapore Stage
    pipeline.addStage({
      stageName: 'Deploy-Singapore',
      actions: [
        new codepipeline_actions.CloudFormationCreateUpdateStackAction({
          actionName: 'Deploy-Singapore',
          stackName: 'eye-passwordchange-stack',
          templatePath: BuildArtifact.atPath('singapore-package-template.yaml'),
          adminPermissions: true,
          cfnCapabilities: [
            cdk.CfnCapabilities.ANONYMOUS_IAM,
            cdk.CfnCapabilities.AUTO_EXPAND,
          ],
          extraInputs: [SourceArtifact],
          deploymentRole: CloudFormationRole,
          // role: CloudformationActionRole,
          region: `${this.node.tryGetContext("ToolingAccountRegion")}`
        }),
      ],
    });

    // Codpipeline - Deploy Tokyo Stage
    pipeline.addStage({
      stageName: 'Deploy-Tokyo',
      actions: [
        new codepipeline_actions.CloudFormationCreateUpdateStackAction({
          actionName: 'Deploy-Tokyo',
          stackName: 'eye-passwordchange-stack-tokyo',
          templatePath: BuildArtifact.atPath('tokyo-package-template.yaml'),
          adminPermissions: true,
          cfnCapabilities: [
            cdk.CfnCapabilities.ANONYMOUS_IAM,
            cdk.CfnCapabilities.AUTO_EXPAND,
          ],
          deploymentRole: TenantCloudFormationRole,
          role: CrossAccountRole,
          region: `${this.node.tryGetContext("TenantAccountRegion")}`,
        }),
      ],
    });

  }
}
