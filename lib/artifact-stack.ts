import * as cdk from 'aws-cdk-lib';
import { RemovalPolicy } from 'aws-cdk-lib';
import { AccountPrincipal } from 'aws-cdk-lib/aws-iam';
import { Alias } from 'aws-cdk-lib/aws-kms';
import { Bucket, BucketEncryption } from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

/**
 * スタック属性
 * @export
 * @interface ArtifactProps
 * @extends {StackProps}
 */
interface ArtifactProps extends cdk.StackProps {
	artifactStoreName: string,
	keyName: string,
	tenantAccount:string
}

export class ArtifactStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: ArtifactProps) {
    super(scope, id, props);

		//tenantアカウントのprincipal
		const tenantAccountRootPrincipal = new AccountPrincipal(props.tenantAccount);

		const key = Alias.fromAliasName(
			this,
			'lswn_ArtifactStore_KMSKey_'+props.env?.region,
			'alias/' + props.keyName
		);

    	const artifactBucket = new Bucket(this, 'ArtifactBucket', {
			bucketName: props.artifactStoreName,		//S3バケット名
			removalPolicy: RemovalPolicy.DESTROY,		//cdk destroyコマンドでS3バケット削除することを許可
			encryption: BucketEncryption.KMS,			//S3バケットの暗号化方式
			encryptionKey: key,							//S3バケットの暗号化キー
			autoDeleteObjects: true						//Cloudformationのスタック削除時に、S3バケットも削除することを許可			
		})

		artifactBucket.applyRemovalPolicy(cdk.RemovalPolicy.DESTROY)
		artifactBucket.grantRead(tenantAccountRootPrincipal);

		new cdk.CfnOutput(this, props.artifactStoreName, {
		 	value: artifactBucket.bucketArn,
		 	exportName: props.artifactStoreName,
		 	description: props.env?.region + "ArtifacStore's Arn"
	  	});
  }
}