# 事実確認ログ

## 2026-09-25（初回: Week1 ノート4本 + iam.md）
根拠: aws-core:aws-iam スキル、AWS 公式ドキュメント（VPN トンネル帯域、Direct Connect MACsec/クォータ、IAM ポリシー評価ロジック）

| 対象 | 結果 |
|---|---|
| 02: VPN 1トンネル約1.25Gbps | ⚠️ 標準は正しいが、Large Bandwidth Tunnel（最大5Gbps、TGW/Cloud WAN 接続のみ）が抜けていた → 修正 |
| 02: Direct Connect 速度 | ⚠️ 専用接続は400Gbpsもあり → 修正。ホスト型「50Mから」は未確認のため削除 |
| 02: MACsec | ⚠️ 10/100/400Gbps に対応 → 修正 |
| 04: 同一アカウントの評価（Identity/Resource の和集合、明示Denyが優先） | ✅ 公式と一致 |
| 04: SCP/RCP/Boundary は共通部分 | ✅ |
| 04: リソースポリシーが IAM ユーザーARNを指定 → Boundary をバイパス | ➕ aws-iam スキルの記載に基づき追記 |
| iam.md: ロールチェーンは最大1時間 | ✅ aws-iam スキルと一致 |
| iam.md: クロスアカウントは両側の許可が必要 | ✅ |

## 未確認（公式で裏取りできていない項目）
- 01: Control Tower のガードレール種別（予防=SCP / 発見=Config）の現行仕様（プロアクティブ型の追加など）
- 02: TGW の各種上限、ホスト型 Direct Connect の帯域
- 03: Route 53 Resolver / PHZ の細部（aws-networking のサブスキルは MCP 接続失敗のため参照できず）

## 注意
WebFetch の要約は誤ることがある（VPN の大容量トンネルを2.5Gbpsと返した）。数値は原文で確認すること。
