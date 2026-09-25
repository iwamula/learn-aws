# Week1-1: AWS Organizations と SCP

## 要点
- **Organizations**: 複数アカウントを OU（組織単位）で階層管理。一括請求（Consolidated Billing）でボリュームディスカウントや RI/Savings Plans の共有ができる。
- **SCP（サービスコントロールポリシー）**: 権限の「上限（ガードレール）」を定めるだけで、権限を**付与はしない**。実効権限 = SCP ∩ IAM ポリシー（∩ permissions boundary など）。
  - **管理アカウント（旧マスター）には適用されない**。メンバーアカウントのルートユーザーには適用される。
  - サービスリンクロールには影響しない。
  - 継承: ルート → OU → アカウントの各階層すべてで許可されていないと通らない。
  - 戦略: 「拒否リスト方式」（FullAWSAccess を残して Deny を追加）が扱いやすい。「許可リスト方式」は FullAWSAccess を外して必要なものだけ Allow。
- 典型的な SCP: 特定リージョン以外を Deny（`aws:RequestedRegion`）、CloudTrail 停止の Deny、組織離脱の Deny、暗号化なしの作成の Deny。
- **Control Tower**: Organizations 上にランディングゾーンを自動構築。ガードレール（現在の用語は「コントロール」）は3種類: 予防=SCP/RCP/宣言型ポリシー、発見=Config ルール、**プロアクティブ=CloudFormation フック**（プロビジョニング前に非準拠リソースを拒否。CloudFormation 経由のリソースのみ対象）。Account Factory でアカウント払い出し。
- **IAM Identity Center（旧 SSO）**: 複数アカウントへのシングルサインオンと権限セット。外部 IdP（Entra ID/Okta）と連携可能。
- **RAM**: Transit Gateway、サブネット、Route 53 Resolver ルールなどを組織内で共有。
- **CloudTrail 組織証跡**: 全アカウントのログを 1 つの S3 に集約。
- **Config アグリゲーター / Security Hub / GuardDuty 委任管理者**: 組織横断の集約。管理アカウントではなくセキュリティ専用アカウントに委任する。

## 試験での判断ポイント
- 「全アカウントで○○を禁止したい」→ SCP
- 「新規アカウントを標準構成で素早く作りたい」→ Control Tower Account Factory
- 「アカウント間でリソースを共有、コピーしたくない」→ RAM
- 「一時的に別アカウントへアクセス」→ IAM ロール + STS AssumeRole（アクセスキーの共有は不可）

## Q&A（答えを隠して考えてから確認）
### Q1. SCP で Allow していれば、そのアカウントの IAM ユーザーは操作できる？
<details><summary>答え</summary>
できない。SCP は上限を定めるだけ。IAM ポリシー側でも Allow が必要。実効権限は両方の共通部分。
</details>

### Q2. 管理アカウントに SCP を適用してリージョン制限をかけたい。可能？
<details><summary>答え</summary>
不可。SCP は管理アカウントには効かない。だから管理アカウントには最小限のリソースしか置かず、ワークロードはメンバーアカウントに置く。
</details>

### Q3. OU に FullAWSAccess をアタッチしたまま、特定 OU で S3 削除だけを禁止したい。どうする？
<details><summary>答え</summary>
その OU に `s3:DeleteBucket` などを Deny する SCP をアタッチする（拒否リスト方式）。Deny は明示的拒否なので、上位で Allow されていても優先される。
</details>

### Q4. 親 OU が SCP で S3 を Allow していない場合、子 OU の SCP で Allow すれば使える？
<details><summary>答え</summary>
使えない。SCP は階層すべてで許可されている必要がある。子で Allow を足しても上位の制限は超えられない。
</details>

### Q5. 100 アカウントで、CloudTrail・Config・GuardDuty を各アカウント個別ではなく一括で有効化・管理したい。どうする？
<details><summary>答え</summary>
Organizations と統合し、組織証跡、Config アグリゲーター、GuardDuty/Security Hub の委任管理者（セキュリティアカウント）と自動有効化を使う。標準化まで求めるなら Control Tower。
</details>

### Q6. 各アカウントの開発者に、コード変更なしで長期アクセスキーを使わず複数アカウントへログインさせたい。
<details><summary>答え</summary>
IAM Identity Center で権限セットを割り当て、既存の IdP と連携して SSO する。一時認証情報が払い出されるので長期キーが不要。
</details>
