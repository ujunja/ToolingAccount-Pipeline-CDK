import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Key } from 'aws-cdk-lib/aws-kms';
import { ArnPrincipal, PolicyStatement, Role} from 'aws-cdk-lib/aws-iam';

/**
 * スタック属性
 * @export
 * @interface KmsProps
 * @extends {StackProps}
 */
interface KmsProps extends cdk.StackProps {
	tenantAccount: string,
    keyName: string
}

export class KmsStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: KmsProps) {
    super(scope, id, props);

        //toolingアカウントのrootユーザー
        // const toolingRoot = new ArnPrincipal(`arn:aws:iam::${props.env?.account}:root`)
        //tenantアカウントのユーザー
        //特定のユーザーのみ許可したい場合は、「*」にユーザーの名前を記載してください。
        // const tenantUser = new ArnPrincipal(`arn:aws:iam::${props.tenantAccount}:user/*`)

        const key = new Key(this, props.keyName, {
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            pendingWindow: cdk.Duration.days(7),
            alias: props.keyName,
            description: 'KMS key for ' + props.keyName,
            enableKeyRotation: false,            
        });

        new cdk.CfnOutput(this, props.keyName + ' Arn', {
            value: key.keyArn,
            exportName: props.keyName,
            description: props.keyName + 'Arn'
        });

    }
}