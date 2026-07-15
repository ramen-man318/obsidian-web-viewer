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
- 🆕 **ファイル新規作成** — 専用UI（＋New ボタン / `?new` URL）でパス指定＆保存
- 🔎 **Vault検索** — ripgrep ベースの全文検索
- 📱 **レスポンシブ** — スマホでも操作可能（ファイル開くとサイドバー自動クローズ）
- 🐳 **Docker対応** — セルフホスト（推奨）

---

## 🐳 クイックスタート（Docker — 推奨）

**Docker Compose を使う方法が最も簡単で、権限問題も起こりにくいです。**

### 必要条件

- Docker + Docker Compose

### 1. セットアップ

```bash
# リポジトリをクローン
cd obsidian-web-viewer

# .env ファイルを作成
cp .env.example .env
```

### 2. .env を編集

```env
# Vaultディレクトリの絶対パス（ホスト側）
OBSIDIAN_VAULT=/path/to/your/vault

# ポート番号（省略時: 5000）
PORT=5000

# タイムゾーン（省略時: Asia/Tokyo）
TZ=Asia/Tokyo
```

### 3. 起動

```bash
docker compose up -d
# → http://localhost:5000
```

### 4. 停止

```bash
docker compose down
```

---

## ローカル起動（Python — 非推奨）

> **注意:** ローカル起動は簡易検証用です。Dockerで運用することを推奨します。
> 以下の権限問題が発生する可能性があります。

### 必要条件

```bash
pip install flask
sudo apt install ripgrep
```

### 起動

```bash
export OBSIDIAN_VAULT_PATH=/path/to/your/vault
python app.py
# → http://localhost:5000
```

Vaultパスを省略した場合、`~/vault` がデフォルトです。

---

## 権限に関する注意

### 💡 Docker運用を推奨する理由

このアプリケーションはFlaskを実行するユーザー権限でファイル操作を行います。

- **ローカル起動** → 一般ユーザー権限で動作。Dockerで以前作成した root所有ファイルなどがあると、削除・編集で `Permission denied` が発生します
- **Docker起動** → コンテナ内の `appuser` 権限で動作。ホスト側のuidと一致しなくても、コンテナ内からは一貫した権限でアクセスできます

Docker Compose で起動すれば、これらの問題を意識する必要はほぼありません。

### ローカル起動時によくある問題

**症状**: ファイル削除時に `[Errno 13] Permission denied` が発生する

**原因**: Dockerコンテナ内で作成されたファイルが root所有のままになっている

**解決方法**:

```bash
sudo find ~/vault -user root -type f -exec chown $(whoami):$(whoami) {} +
```

### ピン留めデータ

| 起動方法 | 保存先 | 備考 |
|---|---|---|
| Docker（推奨） | `/data/pins.json`（名前付きボリューム） | `docker compose down` 後も保持 |
| ローカル起動 | `~/.vault/owv-pins.json` | `PINS_FILE` 環境変数で変更可能 |

---

## 環境変数

| 変数名 | 説明 | デフォルト |
|---|---|---|
| `OBSIDIAN_VAULT_PATH` | Vaultディレクトリのパス | `~/vault` |
| `PINS_FILE` | ピン留めデータの保存先（ローカル時） | `~/.vault/owv-pins.json` |
| `FLASK_DEBUG` | `1` でFlaskデバッグモード有効（非推奨） | `0` |
| `TZ` | タイムゾーン | — |

### Docker Compose 用（.env で設定）

| 変数名 | 説明 | デフォルト |
|---|---|---|
| `OBSIDIAN_VAULT` | ホスト側のVaultディレクトリ（絶対パス） | — |
| `PORT` | 公開ポート | `5000` |
| `TZ` | タイムゾーン | `Asia/Tokyo` |

---

## ⚠️ セキュリティ注意

このアプリケーションは **認証機能を持ちません**。

- Vault内のファイルが**読み書きし放題**になります
- インターネットに直接公開せず、**必ず認証プロキシ（Basic認証、OIDC等）またはVPNの内側**で運用してください
- デフォルトでFlaskデバッグモードは無効（`FLASK_DEBUG=1` で有効化）です。本番環境では絶対に有効にしないでください

---

## API

| エンドポイント | メソッド | 説明 |
|---|---|---|
| `/api/list` | GET | VaultのディレクトリツリーをJSONで返却 |
| `/api/read?path=` | GET | ファイルの内容を取得 |
| `/api/save` | POST | ファイルを保存（新規作成兼用）・空contentで削除 |
| `/api/search?q=` | GET | ripgrep による全文検索 |
| `/api/raw?path=` | GET | 画像などのバイナリファイルをMIME付きで返却 |

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
├── .env.example        # 環境変数テンプレート
├── README.md           # このファイル
└── docs/
    └── api-spec.md     # API仕様書
```

---

## ライセンス

MIT

---

*Made with ❤️ by [ramen-man318](https://github.com/ramen-man318)*