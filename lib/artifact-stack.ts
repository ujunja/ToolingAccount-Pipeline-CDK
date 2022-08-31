import * as cdk from 'aws-cdk-lib';
import { RemovalPolicy } from 'aws-cdk-lib';
import { AccountPrincipal } from 'aws-cdk-lib/aws-iam';
import { Key } from 'aws-cdk-lib/aws-kms';
import { Bucket, BucketEncryption } from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

export class ArtifactStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

		const uatAccountRootPrincipal = new AccountPrincipal(`${this.node.tryGetContext('TenantAccountId')}`);

		// 既存のKMS KEY
		const singaporeKey = Key.fromKeyArn(
			this,
			'EYES_ArtifactStore_KMSKey_Singapore',
			`${this.node.tryGetContext('SingaporeKmsKeyArn')}`
		);

		// 대문자 X
    const artifactBucket = new Bucket(this, 'ArtifactBucket', {
			bucketName: 'lswn-cdk-create-test-bucket',
			removalPolicy: RemovalPolicy.DESTROY,
			encryption: BucketEncryption.KMS,
			encryptionKey: singaporeKey,
		})

		artifactBucket.grantRead(uatAccountRootPrincipal);

  }
}