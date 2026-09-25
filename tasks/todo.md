# 進捗と次のタスク（最終更新: 2026-09-25）

## 完了
- [x] README にロードマップ作成（試験日 2026-10-24）
- [x] Week1 ノート 01〜04（Organizations/SCP、VPC接続、ハイブリッドDNS、IAM評価）
- [x] `iam.md` の Q1・Q2 に回答
- [x] Week1 ノートの初回事実確認（`qa/fact-check-log.md`）

## 次にやること（優先順）
- [ ] 事実確認の続き: `qa/fact-check-log.md` の「未確認」項目を公式ドキュメントの原文で裏取り（Control Tower ガードレール、TGW 上限、Route 53 Resolver/PHZ）
- [ ] Week1 の残りノート作成: Control Tower / IAM Identity Center の詳細、Direct Connect 冗長構成、セキュリティサービスの組織横断集約（GuardDuty/Security Hub/Config 委任管理者）
- [ ] 01 ノート末尾のクイズ形式Q&Aを残すか整理するか、ユーザーに確認
- [ ] Week2 ノート（可用性・DR・データ層）の作成へ

## メモ
- ユーザーは各ノートで気になった点を `Qn` として書き込み、AIに事実確認させる運用（クイズ形式ではない）
- `aws-core` プラグイン導入済みだが、MCP サーバー（aws-mcp）は接続失敗中（CONNECT_TIMEOUT / -32602）。スキル本体は使える。ネットワーク系の下位スキル（route53 等）は MCP 経由のため未参照
- 未コミット。コミットはユーザーの依頼があってから
