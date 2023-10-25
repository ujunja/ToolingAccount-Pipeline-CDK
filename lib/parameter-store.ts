import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { StringParameter } from 'aws-cdk-lib/aws-ssm';

/**
 * スタック属性
 * @export
 * @interface ParameterStoreProps
 * @extends {StackProps}
 */
interface ParameterStoreProps extends cdk.StackProps {
  toolingKmsArn: string,
  tenantKmsArn: string,
}

export class ParameterStoreStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props: ParameterStoreProps) {
      super(scope, id, props);

      new StringParameter(this, 'toolingKmsArn', {
        description: 'ToolingアカウントのKMSキーのArn',
        parameterName: 'toolingKmsArn',
        stringValue: props.toolingKmsArn,        
      });

      new StringParameter(this, 'tenantKmsArn', {
        description: 'TenantアカウントのKMSキーのArn',
        parameterName: 'tenantKmsArn',
        stringValue: props.tenantKmsArn,
      });
    }
}