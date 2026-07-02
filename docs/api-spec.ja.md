# Obsidian Web Viewer — バックエンド API 設計書

## スタック

- **Flask**（1ファイル: `app.py`）
- DB不要 — vaultはファイルシステムそのもの
- テンプレートエンジンなし — SPAフロントエンド

## API一覧

### `GET /api/list`

vaultディレクトリツリーを返す。

```json
{"tree": [
  {"name": "output", "type": "folder", "children": [
    {"name": "report.md", "type": "file", "path": "output/report.md"}
  ]},
  {"name": "index.md", "type": "file", "path": "index.md"}
]}
```

- `.md` のみ（要望があれば拡張）
- `.` 始まりの隠しフォルダ除外
- 並び順: ピン止め優先 → アルファベット順

### `GET /api/read?path=<filepath>`

ファイル内容 + メタデータ。

```json
{"path": "output/report.md", "content": "# Hello", "size": 1024, "modified": "2026-07-02T10:00:00"}
```

- ponytail: パス深度制限なし、ファイルロックなし
- パストラバーサル: `..` は弾く

### `POST /api/save`

Body: `{"path": "output/report.md", "content": "# new content"}`
Response: `{"ok": true}` or `{"error": "..."}`

- `w` モードで書き込み、utf-8
# 新規ファイル作成も兼ねる — 存在しないパスにPOST→作成
- 親ディレクトリがなければ作成
- ponytail: atomic writeなし、競合検出なし（複数編集者ができたら追加）

### `GET /api/search?q=<query>`

ripgrep で全文検索。

```json
{"results": [
  {"file": "output/report.md", "line": 3, "content": "text with <em>query</em>"}
]}
```

- `rg` CLI 使用（インストール済み）
- ponytail: インデックスなし、fuzzy検索なし

### `GET /` および静的ファイル

`/` → `index.html`（SPA）
`/static/*` → そのまま配信

## ファイル構成

```
obsidian-web-viewer/
├── app.py              # Flask（1ファイル）
├── index.html          # SPA
├── static/
│   ├── style.css       # モックから分割
│   └── script.js       # モックから分割
├── docs/
│   ├── api-spec.md     # 英語版
│   └── api-spec.ja.md  # 日本語版（これ）
└── drafts/
    └── design-mockup.html  # デザイン参考
```

ponytail: `app.py` 1ファイル、300行超えたら分割。

## セキュリティ

- パストラバーサル: `..` 拒否
- Save: vaultルート（`~/vault/`）限定
- 認証なし（LAN専用・単一ユーザー）。WAN公開時にBasic認証追加。
