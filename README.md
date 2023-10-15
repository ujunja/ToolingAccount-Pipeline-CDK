# AWS CDKは？
最新のプログラミング言語を使用してクラウドインフラストラクチャをコードとして定義し、それを AWS CloudFormationを通じてデプロイするためのオープンソースのソフトウェア開発フレームワーク

# 準備項目
 - AWSアカウント
 - AWS CLI
 - IDE(Visual Studio Codeなど)
 - Node.js

## CDK Cliインストール
グローバル環境にインストール
```bash
npm install -g aws-cdk
```
インストール確認
```bash
cdk --version
```
## CDK Bootstapとは？
cdk appを新しい環境(AWSアカウント x リージョン)でデプロイする際に、最初の一回だけ実行が必要なコマンドで、CDKでデプロイするAWSアカウントとリージョンを決める概念です。

## CDK Bootstap設定
AWS アカウント呼び出し
```bash
aws sts get-caller-identity
```
CDK Bootstrap連携
```bash
cdk bootstrap aws://${account-number}/${region}

# account-number : 「aws sts get-caller-identity」コマンドで取得したAWSアカウント
# region : デプロイするリージョン、例えば、東京リージョンなら「ap-northeast-1」
```

## CDK プロジェクト生成
```bash
mkdir cdk-demo
cd cdk-demo
cdk init --language typescript
```

## 環境変数設定リスト
 - TOOLING_ACCOUNT
 - TOOLING_ACCOUNT_REGION
 - TOOLING_REGION_KEY_ARN
 - TOOLING_REGION_BUCKET
 - TENANT_ACCOUNT
 - TENANT_ACCOUNT_REGION
 - TENANT_REGION_KEY_ARN
 - TENANT_REGION_BUCKET

## cdk.json作成方法
 - CodeCommitRepoName: ToolingAccountのCodeCommitリポジトリ名、別途作成が必要
 - CodeBuildProName: CodeBuild名
 - CommitActionRole: CodePipelineのCommitStageActionのロール名
 - BuildActionRole: CodePipelineのBuildStageActionのロール名
 - DeploymentActionRole: CodePipelineのDeployStageActionのロール名
 - DeploymentRole: CloudFormationのロール名
 - CrossAccountRole: TenantAccountのCrossAccountのロール名
 - CodepipelineRole: CodePipelineのロール名
 - CodeBuildRole: CodeBuildのロール名
 - PipelineName: CodePipeline名

## CDK デプロイ手順
```bash
※ Tooling Accountで実行
cdk deploy IamStack ToolingRegionArtifactStack TenantRegionArtifactStack
※ Tenant Accountで実行 -> 事前にcredentials設定(TenantAccount用)をしてください。
cdk deploy CrossAccountRoleStack --profile tenant
※ Tooling Accountで実行
cdk deploy PipeLineStack
# binディレクトリのcdk-app.tsで指定したスタック名で特定のスタックだけ実行することができる。 
```
## CDK 削除y
```bash
※ 全体削除
cdk destroy --all
※ 一部削除
cdk destroy スタック名
cdk destroy PipeLineStack
cdk destroy IamStack ToolingRegionArtifactStack TenantRegionArtifactStack
cdk destroy CrossAccountRoleStack --profile tenant
```

## Useful commands
* `cdk diff`        compare deployed stack with current state
* `cdk synth`       emits the synthesized CloudFormation template
