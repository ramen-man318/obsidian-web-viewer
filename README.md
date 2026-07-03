# Obsidian Web Viewer

**ブラウザ上でObsidian Vaultを閲覧・編集できる軽量Webアプリ。**

![screenshot](https://img.shields.io/badge/Python-3.11%2B-blue)
![screenshot](https://img.shields.io/badge/Flask-3.x-lightgrey)
![screenshot](https://img.shields.io/badge/license-MIT-green)

---

## 機能

- 📂 **Vaultツリー表示** — フォルダ構造をブラウザでそのまま表示
- 👁️ **プレビュー** — Markdownレンダリング表示（WikiLink `[[ファイル名]]` 対応）
- ✏️ **編集** — ブラウザ上で編集、`rg` による全文検索
- 🔖 **ピン留め** — よく使うファイル/フォルダを上部に固定
- 🔗 **URL永続化** — 開いているファイル・編集モードをURLパラメータに保存、再読み込みで復元
- 🖼️ **画像表示** — PNG/JPEG/GIF/WebP をインライン表示
- 📄 **多形式対応** — `.md`, `.txt`, `.json`, `.csv`, `.py`, `.js`, `.yaml` など閲覧可能
- 🔎 **Vault検索** — ripgrep ベースの全文検索
- 📱 **レスポンシブ** — スマホでも操作可能（ハンバーガーメニュー）
- 🐳 **Docker対応** — セルフホスト可能

---

## クイックスタート（ローカル）

### 必要条件

- Python 3.11+
- ripgrep（`rg` コマンド — 全文検索に使用）

```bash
# ripgrepのインストール（Debian/Ubuntu）
sudo apt install ripgrep

# macOS
brew install ripgrep
```

### インストール & 起動

```bash
# 依存関係はFlaskのみ
pip install flask

# 起動（Vaultパスを環境変数で指定）
export OBSIDIAN_VAULT_PATH=/path/to/your/vault
python app.py

# → http://localhost:5000 でアクセス
```

> Vaultパスを省略した場合、`~/vault` がデフォルトとして使われます。

---

## 🐳 Docker セルフホスト

### compose.yaml（推奨）

```yaml
services:
  obsidian-web-viewer:
    build: .
    ports:
      - "5000:5000"
    volumes:
      - /path/to/your/vault:/app/content
    environment:
      - TZ=Asia/Tokyo
    restart: unless-stopped
```

> **注意:** Dockerイメージ内ではVaultパスが `/app/content` に固定されています。  
> `volumes` でホスト側のVaultディレクトリを `/app/content` にマウントしてください。

### 起動

```bash
docker compose up -d
# → http://localhost:5000
```

### ビルドのみ（docker compose不使用の場合）

```bash
docker build -t obsidian-web-viewer .
docker run -d \
  --name obsidian-web-viewer \
  -p 5000:5000 \
  -v /path/to/your/vault:/app/content \
  -e TZ=Asia/Tokyo \
  --restart unless-stopped \
  obsidian-web-viewer
```

---

## 環境変数

| 変数名 | 説明 | デフォルト |
|---|---|---|
| `OBSIDIAN_VAULT_PATH` | Vaultディレクトリのパス | `~/vault` |
| `TZ` | タイムゾーン | — |

---

## API

| エンドポイント | メソッド | 説明 |
|---|---|---|
| `/api/list` | GET | VaultのディレクトリツリーをJSONで返却 |
| `/api/read?path=` | GET | ファイルの内容を取得 |
| `/api/save` | POST | ファイルを保存（新規作成兼用） |
| `/api/search?q=` | GET | ripgrep による全文検索 |
| `/api/raw?path=` | GET | 画像などのバイナリファイルをMIME付きで返却 |

詳細なAPI仕様は [docs/api-spec.md](docs/api-spec.md) を参照してください。

---

## プロジェクト構成

```
obsidian-web-viewer/
├── app.py              # Flask バックエンド
├── index.html          # SPA フロントエンド
├── static/
│   ├── script.js       # フロントエンドロジック
│   └── style.css       # ダークテーマスタイル
├── Dockerfile          # Docker イメージ定義
├── compose.yaml        # Docker Compose
└── docs/
    └── api-spec.md     # API仕様書
```

---

## スクリーンショット

> （実際の画面イメージを後日追加予定）

---

## ライセンス

MIT

---

*Made with ❤️ by [ramen-man318](https://github.com/ramen-man318)*