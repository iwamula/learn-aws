# Week1-4: IAM ポリシー評価とクロスアカウント権限

## ポリシーの種類
| 種類 | 役割 |
|---|---|
| アイデンティティベース | ユーザー/グループ/ロールに付与し、権限を与える |
| リソースベース | S3, SQS, KMS, Lambda 等に付与。**Principal を指定**。他アカウントに直接許可できる |
| **Permissions Boundary** | ユーザー/ロールに付与できる権限の**上限**（権限は付与しない） |
| **SCP** | アカウント/OU の権限の上限（管理アカウントには非適用） |
| **セッションポリシー** | AssumeRole 時に一時的に権限を絞る |
| RCP（リソースコントロールポリシー） | 組織内リソースへのアクセスの上限（リソース側のガードレール） |

## 評価ロジック（同一アカウント）
1. **明示的 Deny** があれば拒否（最優先）
2. SCP、RCP、Permissions Boundary、セッションポリシーで**Allow されていなければ拒否**（これらは全部の共通部分が有効）
3. **同一アカウント**では、アイデンティティベース**または**リソースベースのどちらかで Allow があれば許可（リソースポリシーの Principal がアカウント `root` の場合は、アイデンティティ側の Allow も必要）
4. それ以外は暗黙の Deny

## クロスアカウントの場合
- **アイデンティティ側とリソース側の両方**で Allow が必要
- リソースポリシーの Principal に相手アカウントの `root` を指定しただけでは足りず、相手側の管理者がアイデンティティポリシーで委任する必要がある
- **同一アカウント**で、リソースポリシーが Principal に **IAM ユーザー ARN** を直接指定している場合、Permissions Boundary の制限を受けずに許可される
- **AssumeRole** すると呼び出し元の権限は失われ、ロールの権限になる。リソースベースで直接許可すれば元の権限を保ったまま操作できる

## 条件キー（頻出）
- `aws:PrincipalOrgID`: 組織内の全アカウントを許可（S3 バケットポリシー等で個別のアカウント列挙を避けられる）
- `aws:SourceIp` / `aws:SourceVpce`: 接続元制限
- `aws:RequestedRegion`: リージョン制限
- `aws:MultiFactorAuthPresent`: MFA 必須
- `aws:SourceArn` / `aws:SourceAccount`: サービスがロールを使うときの confused deputy 対策

## 判断ポイント
- 「開発者に IAM ロール作成を任せたいが、権限昇格は防ぎたい」→ Permissions Boundary（付与できる上限を設定）
- 「組織内のアカウントのみアクセス可」→ `aws:PrincipalOrgID` 条件
- 「外部ベンダーにロールを引き受けさせる」→ ExternalId
- 「EC2 に権限を与える」→ インスタンスプロファイル（IAM ロール）。アクセスキーを埋め込まない
- 「Web/モバイルアプリのユーザーに一時的にAWSへアクセス」→ Cognito Identity Pool（ID プール）
- 「オンプレのサーバーから」→ IAM Roles Anywhere（証明書ベース）

## Q&A（答えを隠して考えてから確認）
### Q1. 開発者に IAM ロールの作成を任せたいが、自分より強い権限を持つロールを作る権限昇格は防ぎたい。どうする？
<details><summary>答え</summary>
Permissions Boundary を設定する。付与できる権限の上限を決めるだけで、権限自体は付与しない。
</details>

### Q2. 別アカウントの S3 バケットに、自アカウントのユーザーからアクセスさせたい。どちらの設定が必要？
<details><summary>答え</summary>
クロスアカウントではアイデンティティ側とリソース側の両方で Allow が必要。リソースポリシーで相手アカウントの root を指定しただけでは足りず、相手側の管理者がアイデンティティポリシーで委任する必要がある。
</details>

### Q3. 組織内の全アカウントからだけバケットにアクセスさせたい。アカウント ID を列挙せずに済ませるには？
<details><summary>答え</summary>
バケットポリシーに `aws:PrincipalOrgID` 条件を使う。
</details>

### Q4. 外部ベンダーにロールを引き受けさせたい。どうする？
<details><summary>答え</summary>
IAM ロールを作り ExternalId を条件にして AssumeRole させる。EC2 にはインスタンスプロファイル、オンプレのサーバーには IAM Roles Anywhere（証明書ベース）、Web/モバイルアプリのユーザーには Cognito Identity Pool を使い、アクセスキーは埋め込まない。
</details>

### Q5. 同一アカウントで、SCP・Permissions Boundary・アイデンティティ/リソースポリシーが混在するときの評価順序は？
<details><summary>答え</summary>
1. 明示的 Deny があれば拒否。2. SCP、RCP、Permissions Boundary、セッションポリシーで Allow されていなければ拒否（共通部分が有効）。3. アイデンティティまたはリソースのどちらかで Allow があれば許可（リソースポリシーの Principal がアカウント root の場合はアイデンティティ側の Allow も必要）。4. それ以外は暗黙の Deny。
</details>

### Q6. AssumeRole すると、呼び出し元の元の権限はどうなる？ 元の権限を保ったまま別アカウントのリソースを操作するには？
<details><summary>答え</summary>
AssumeRole すると元の権限は失われ、ロールの権限になる。リソースベースポリシーで直接許可すれば、元の権限を保ったまま操作できる。
</details>

## 疑問・確認したい点
（ここに `Qn ...` と追記して、AIに事実確認を依頼してください）
