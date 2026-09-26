#!/bin/bash
# 未確認項目の裏取りを、毎回まっさらなセッションで1件ずつ進める。
# 使い方: scripts/factcheck-loop.sh [最大回数(既定5)]
# コミットはしない。終わったら `git diff` で確認してから自分でコミットする。
set -u
cd "$(dirname "$0")/.."
MAX=${1:-5}

PROMPT='CLAUDE.md と tasks/lessons.md を読み、tasks/todo.md の「08〜20 に残る個別の未確認項目」と各ノートの「未確認」欄から、まだ裏取りしていない項目を1件だけ選ぶ。選ぶ順は tasks/todo.md の優先順（ノート17の EventBridge / Step Functions / SNS → ノート20の Lake Formation / Redshift / Firehose / Athena → その他）に従い、単価・料金の数値と EMR / QuickSight / OpenSearch / Data Exchange は選ばない（other/fact-check-log.md の末尾で「未確認」のままのもの）。
公式ドキュメントの原文を curl か Python で取得して確認し、該当ノートの「未確認」の記述を原文ベースの内容に更新する。原文で確認できなければ「未確認」のまま残し、理由を書く。
other/fact-check-log.md に ✅/⚠️/➕ で記録する。tasks/todo.md には弾ごとの記述を追記しない（詳細はログに一本化）。選べる項目が全部なくなったときだけ、todo.md の該当項目にチェックを付ける。コミットはしない。
選べる項目が残っていなければ、何も変更せず、最終行に ALL_DONE とだけ出力する。'

for i in $(seq 1 "$MAX"); do
  echo "=== $i / $MAX ($(date +%H:%M:%S)) ==="
  out=$(claude -p "$PROMPT" \
    --permission-mode acceptEdits \
    --allowedTools "Read" "Edit" "Write" "Bash(curl:*)" "Bash(python3:*)" "Bash(grep:*)" "Bash(git diff:*)" "Bash(git status:*)" 2>&1) || {
    echo "$out"; echo "claude が失敗したので中断"; exit 1; }
  echo "$out"
  if echo "$out" | tail -n 3 | grep -q "ALL_DONE"; then
    echo "残り項目なし。終了"; break
  fi
done

echo "=== 完了。差分を確認してください ==="
git diff --stat
