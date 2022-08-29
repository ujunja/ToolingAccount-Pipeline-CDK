import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Key } from 'aws-cdk-lib/aws-kms';
import { Role } from 'aws-cdk-lib/aws-iam';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { Repository } from 'aws-cdk-lib/aws-codecommit';
import { BuildSpec, LinuxBuildImage, PipelineProject } from 'aws-cdk-lib/aws-codebuild';
import { Artifact, Pipeline } from 'aws-cdk-lib/aws-codepipeline';
import * as codepipeline_actions from 'aws-cdk-lib/aws-codepipeline-actions';

export class PipeLineStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // 既存のKMS KEY
    // 入力必要
    const myKey = Key.fromKeyArn(
      this,
      'EYES_ArtifactStore_KMSKey',
      `arn:aws:kms:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:key/a2d9b566-3c0e-4539-b06a-04e3be27b222`
    );
    // 既存のKMS KEY
    // 入力必要
    const northKey = Key.fromKeyArn(
      this,
      'EYES_ArtifactStore_KMSKey_Tokyo',
      `arn:aws:kms:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:key/d8cb9c97-67da-4459-aa39-da14c41ab16b`
    );

    // CodePipeline Action Stage
    const CodeCommitActionRole = Role.fromRoleArn(
      this,
      'CodeCommitActionRole',
      `arn:aws:iam::${cdk.Stack.of(this).account}:role/CDK-CodeCommit-Action-Role`,
      {
        mutable: false
      }
    )
    const CodeBuildActionRole = Role.fromRoleArn(
      this,
      'CodeBuildActionRole',
      `arn:aws:iam::${cdk.Stack.of(this).account}:role/CDK-CodeBuild-Action-Role`,
      {
        mutable: false
      }
    )
    const CloudformationActionRole = Role.fromRoleArn(
      this,
      'CloudformationctionRole',
      `arn:aws:iam::${cdk.Stack.of(this).account}:role/CDK-Cloudformation-Action-Role`,
      {
        mutable: false
      }
    )

    // CodeBuild ROLE
    const CodeBuildRole = Role.fromRoleArn(
      this,
      'ProdCodeBuildRole',
      `arn:aws:iam::${cdk.Stack.of(this).account}:role/CDK-CodeBuild-Service-Role`,
      {
        mutable: false,
      }
    );

    const CloudFormationRole = Role.fromRoleArn(
      this,
      'ProdDeploymentRole',
      `arn:aws:iam::${cdk.Stack.of(this).account}:role/CDK-CloudFormation-Deployment-Role`,
      {
        mutable: false,
      }
    );

    // existing s3 bucket
    const artifactBucket = Bucket.fromBucketName(
      this,
      'import existing bucket',
      'codepipeline-ap-southeast-1-872854859043'
    );
    const artifactBucketNorth = Bucket.fromBucketArn(
      this,
      'import existing bucket north',
      'arn:aws:s3:::codepipeline-ap-northeast-bucket-lswn'
    );
    const commit_repository = Repository.fromRepositoryName(
      this,
      'repo_id',
      'repo-199836234156'
    );

    // CodePipeline 구조에서 ArtifactStores 를 사용하고 싶다면 crossRegionReplicationBuckets
    const pipeline = new Pipeline(this, 'eye-password-change-api-pipeline', {
      pipelineName: 'eye-password-change-api-pipeline',
      crossAccountKeys: false,
      crossRegionReplicationBuckets: {
        'ap-southeast-1': artifactBucket,
        'ap-northeast-1': artifactBucketNorth,
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
          role: CodeCommitActionRole
        }),
      ],
    });

    const BuildArtifact = new Artifact('BuildArtifact');

    // LinuxBuildImage
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
            encryptionKey: myKey,
            role: CodeBuildRole,
            projectName: 'CdkBuildProject'
          }),
          role: CodeBuildActionRole
        }),
      ],
    });

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
          role: CloudformationActionRole,
          region: 'ap-southeast-1',
        }),
      ],
    });

  }
}
