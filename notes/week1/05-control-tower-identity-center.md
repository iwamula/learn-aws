# Week1-5: Control Tower と IAM Identity Center

## Control Tower（マルチアカウントの土台を自動構築）
- Organizations / CloudFormation StackSets / Config / CloudTrail / IAM Identity Center などを束ねて**ランディングゾーン**を作る。OU 単位でコントロール（旧ガードレール）を適用する
- 初期構築で共有アカウントが2つできる（既存アカウントを流用することも可能）
  - **Log Archive**: 全アカウントの API ログ・リソース構成ログの保管庫
  - **Audit**: セキュリティ/コンプライアンスチームが全アカウントを参照する制限付きアカウント
- **Account Factory**: 標準構成でアカウントを払い出す。**Account Factory for Terraform (AFT)** は Terraform パイプラインでアカウントのプロビジョニングとカスタマイズを行う
- コントロールの種別（詳細は 01 ノート）

| 種別 | 実装 | 動作 |
|---|---|---|
| 予防 | SCP / RCP / 宣言型ポリシー | 違反する操作を拒否。全リージョン対応 |
| 発見 | AWS Config ルール | 違反を検知してダッシュボードに表示。Control Tower 対応リージョンのみ |
| プロアクティブ | CloudFormation フック | プロビジョニング前に検査。CloudFormation 経由のリソースのみ |

- 管理アカウントの root と管理者は、コントロールが拒否する操作も実行できる（意図的な例外）。SCP が管理アカウントに効かないのと同じ発想

## IAM Identity Center（ワークフォースの SSO）
- **1つの組織に ID ソースは1つ**。選択肢は3つ
  - Identity Center ディレクトリ（既定。ユーザー/グループを直接作成）
  - Active Directory（AWS Managed Microsoft AD、またはオンプレ AD）。オンプレ AD は**双方向信頼**か **AD Connector** で接続。**SAMBA4 ベースの Simple AD は非対応**
  - 外部 IdP（Okta、Microsoft Entra ID など SAML 2.0）。**SCIM v2.0** でユーザー/グループを自動プロビジョニング（Google Workspace と PingOne はユーザーのみ）
- **許可セット (Permission Set)** をユーザー/グループ × アカウントに割り当てる。各アカウントに IAM ロールが作られ、一時認証情報でアクセスする（IAM ユーザーとアクセスキーを配らない）
- 許可セットには AWS 管理ポリシー、カスタマー管理ポリシー、インラインポリシー、Permissions Boundary を含められる
- 許可セットを使うには **Organization インスタンス**が必要（アカウントインスタンスでは使えない）
- 管理を**メンバーアカウントに委任**できる。管理アカウントを触る人を減らすため推奨。許可セットのタグとアカウントリストで「特定アカウントだけ割り当て可能な管理者」も作れる
- クォータ（既定）: 設定できるアカウント 7,000（アプリも別に 7,000）。1許可セット×1アカウントに割り当てられるグループは 100。有効化できるリージョンは 6。`ProvisionPermissionSet` の `ALL_PROVISIONED_ACCOUNTS` は最大 3,500 アカウント

## 判断ポイント
- 「新規アカウントを標準構成・ガードレール付きで素早く払い出す」→ Control Tower Account Factory（Terraform 運用なら AFT）
- 「CloudFormation でのデプロイ前に違反リソースを止めたい」→ プロアクティブコントロール
- 「全アカウントの監査ログを改ざんされにくい場所へ集約」→ Log Archive アカウント
- 「社員が多数の AWS アカウントに SSO。既存の Okta/Entra ID を使いたい」→ IAM Identity Center + 外部 IdP（SAML + SCIM）
- 「オンプレ AD のユーザーで AWS にログイン」→ Identity Center + AD（AWS Managed AD の信頼 or AD Connector）
- 「管理アカウントへのアクセスを減らしたい」→ Identity Center の委任管理者
- 「顧客向けアプリの認証」→ Identity Center ではなく Cognito（Identity Center はワークフォース向け）

## 疑問・確認したい点
（ここに `Qn ...` と追記して、AIに事実確認を依頼してください）
