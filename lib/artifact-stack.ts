import * as cdk from 'aws-cdk-lib';
import { RemovalPolicy } from 'aws-cdk-lib';
import { AccountPrincipal } from 'aws-cdk-lib/aws-iam';
import { Key } from 'aws-cdk-lib/aws-kms';
import { Bucket, BucketEncryption } from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

interface ArtifactProps extends cdk.StackProps {
	artifactStoreName: string,
	artifaceKmsKeyArn: string,
	tenantAccount:string
}

export class ArtifactStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: ArtifactProps) {
    super(scope, id, props);

		const uatAccountRootPrincipal = new AccountPrincipal(props.tenantAccount);

		// 既存のKMS KEY
		const singaporeKey = Key.fromKeyArn(
			this,
			'lswn_ArtifactStore_KMSKey_'+props.env?.region,
			props.artifaceKmsKeyArn
		);

    const artifactBucket = new Bucket(this, 'ArtifactBucket', {
			bucketName: props.artifactStoreName,		//S3バケット名
			removalPolicy: RemovalPolicy.DESTROY,		//cdk destroyコマンドでS3バケット削除することを許可
			encryption: BucketEncryption.KMS,			//S3バケットの暗号化方式
			encryptionKey: singaporeKey,				//S3バケットの暗号化キー
			autoDeleteObjects: true						//Cloudformationのスタック削除時に、S3バケットも削除することを許可			
		})

		artifactBucket.applyRemovalPolicy(cdk.RemovalPolicy.DESTROY)
		artifactBucket.grantRead(uatAccountRootPrincipal);

  }
}