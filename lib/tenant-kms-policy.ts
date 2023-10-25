import * as cdk from 'aws-cdk-lib';
import { PolicyStatement, Role } from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

/**
 * スタック属性
 * @export
 * @interface TenantKmsPolicyProps
 * @extends {StackProps}
 */
interface TenantKmsPolicyProps extends cdk.StackProps {
	tenantKmsArn: string
}

export class TenantKmsPolicyStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props: TenantKmsPolicyProps) {
      super(scope, id, props);

        // Tooling AccountのKms Key アクセスポリシー
		const DecryptKmsPolicy = new PolicyStatement({
			resources: [
				props.tenantKmsArn
			],
			actions: [
				'kms:Decrypt',
				'kms:DescribeKey',
				'kms:Encrypt',
				'kms:ReEncrypt*',
				'kms:GenerateDataKey*'
			],
		})

        const crossRoleArn = cdk.Fn.importValue(this.node.tryGetContext('CrossAccountRole'))
        const deploymentRoleArn = cdk.Fn.importValue(this.node.tryGetContext('DeploymentRole'))

        // TenantAccountのCrossAccountロール
        const CrossAccountRole = Role.fromRoleArn(
            this,
            'CrossAccountRole',
            crossRoleArn
        )

        // TenantAccountのCfnDeploymentRoleロール
        const CfnDeploymentRole = Role.fromRoleArn(
            this,
            'TenantDeploymentRole',
            deploymentRoleArn
        )


        CrossAccountRole.addToPrincipalPolicy(DecryptKmsPolicy);
        CfnDeploymentRole.addToPrincipalPolicy(DecryptKmsPolicy);
    }
}