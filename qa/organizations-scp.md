# QA

Q1. AWS Control Towerの概要を教えてください。

> **AI回答（2026-09-25）**
> マルチアカウント環境の土台（ランディングゾーン）を、AWS のベストプラクティスに沿って自動構築し、ガバナンスを継続的に効かせるサービスです。Organizations、CloudFormation StackSets、Config、CloudTrail、IAM Identity Center などを束ねて構築します。
>
> - **共有アカウント**: 初期構築で **Log Archive**（全アカウントのログの保管庫）と **Audit**（セキュリティ/コンプライアンス用の制限付きアカウント）ができる。既存アカウントの流用も可能
> - **コントロール（旧ガードレール）**: OU 単位で適用し、その OU 内の全アカウントに効く。種別は3つ
>   - 予防: SCP / RCP / 宣言型ポリシーで実装。違反する操作を拒否する
>   - 発見: Config ルールで実装。違反を検知して通知する
>   - プロアクティブ: CloudFormation フックで実装。作成前に非準拠リソースを拒否する（CloudFormation 経由のみ）
> - **Account Factory**: 標準構成で新規アカウントを払い出す。Terraform 運用なら Account Factory for Terraform (AFT)
> - **例外**: 管理アカウントの root と管理者は、コントロールが拒否する操作も実行できる（意図的な仕様）
>
> **試験での判断**: 「新規アカウントを標準構成とガードレール付きで素早く量産したい」なら Control Tower。「細かい権限の上限だけ自前で設計したい」なら Organizations + SCP。詳細は `notes/week1/05-control-tower-identity-center.md`。
>
> 根拠: Control Tower Controls Reference「Control behavior and guidance」原文、Control Tower 関連ドキュメント（search_documentation の原文チャンク）。

Q2. AWS OrganizationのOUって、Active Directoryとかの回想の概念に似てますか？



