"""Obsidian Web Viewer — 日本語版Flaskバックエンド
APIエンドポイント:
  GET /api/list            ディレクトリツリー
  GET /api/read?path=      ファイル内容
  POST /api/save           保存（新規作成兼用）
  GET /api/search?q=       全文検索
  GET /                    SPA配信
  /static/*                静的ファイル
"""

import os
import json
import subprocess
from pathlib import Path
from flask import Flask, request, jsonify, send_from_directory

app = Flask(__name__, static_folder='.', static_url_path='')

# vaultディレクトリ（OBSIDIAN_VAULT_PATH 環境変数 → content/ フォールバック）
VAULT_ROOT = Path(os.environ.get('OBSIDIAN_VAULT_PATH', Path.home() / 'vault'))
VAULT_ROOT.mkdir(exist_ok=True)

def safe_path(path_str) -> Path | None:
    """パストラバーサル対策：.. を拒否"""
    if '..' in path_str.split('/'):
        return None
    p = (VAULT_ROOT / path_str).resolve()
    if not str(p).startswith(str(VAULT_ROOT.resolve())):
        return None
    return p

def _visible_suffixes():
    """表示可能な拡張子リストを返す"""
    return {'.md', '.txt', '.json', '.yaml', '.yml', '.toml', '.csv',
            '.xml', '.ini', '.cfg', '.conf', '.env', '.properties',
            '.css', '.js', '.html', '.sh', '.bash', '.py', '.rb',
            '.lua', '.sql', '.rs', '.go', '.zig', '.ts', '.jsx', '.tsx',
            '.svg', '.drawio', '.excalidraw', '.png', '.jpg', '.jpeg',
            '.gif', '.webp'}


@app.route('/api/list')
def list_files():
    """vault内の表示可能ファイルをディレクトリツリーで返す"""
    def walk(dir_path):
        items = []
        try:
            for entry in sorted(dir_path.iterdir(), key=lambda x: (not x.is_dir(), x.name.lower())):
                if entry.name.startswith('.'):
                    continue
                if entry.is_dir():
                    children = walk(entry)
                    items.append({
                        'name': entry.name,
                        'type': 'folder',
                        'children': children
                    })
                elif entry.suffix.lower() in _visible_suffixes():
                    rel = entry.relative_to(VAULT_ROOT)
                    items.append({
                        'name': entry.name,
                        'type': 'file',
                        'path': str(rel)
                    })
        except PermissionError:
            pass
        return items
    return jsonify({'tree': walk(VAULT_ROOT)})

@app.route('/api/read')
def read_file():
    path = request.args.get('path', '')
    p = safe_path(path)
    if p is None or not p.exists() or not p.is_file():
        return jsonify({'error': 'Not found'}), 404
    try:
        content = p.read_text('utf-8')
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    stat = p.stat()
    return jsonify({
        'path': path,
        'content': content,
        'size': stat.st_size,
        'modified': stat.st_mtime
    })

@app.route('/api/save', methods=['POST'])
def save_file():
    data = request.get_json(force=True)
    path = data.get('path', '')
    content = data.get('content', '')
    p = safe_path(path)
    if p is None:
        return jsonify({'error': 'Invalid path'}), 400
    p.parent.mkdir(parents=True, exist_ok=True)
    try:
        p.write_text(content, 'utf-8')
        return jsonify({'ok': True, 'path': path})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/search')
def search_files():
    q = request.args.get('q', '')
    if not q:
        return jsonify({'results': []})
    try:
        result = subprocess.run(
            ['rg', '-n', q, str(VAULT_ROOT)],
            capture_output=True, text=True, timeout=10
        )
        results = []
        for line in result.stdout.strip().split('\n'):
            if not line:
                continue
            parts = line.split(':', 2)
            if len(parts) >= 3:
                rel_path = Path(parts[0]).relative_to(VAULT_ROOT)
                results.append({
                    'file': str(rel_path),
                    'line': int(parts[1]),
                    'content': parts[2]
                })
        return jsonify({'results': results})
    except FileNotFoundError:
        return jsonify({'error': 'rg not found'}), 500
    except subprocess.TimeoutExpired:
        return jsonify({'error': 'search timeout'}), 504

@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)