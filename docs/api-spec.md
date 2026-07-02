# Obsidian Web Viewer — Backend API Spec

## Stack

- **Flask** (single file: `app.py`)
- SQLite not needed — vault IS the filesystem
- No template engine — SPA frontend serves itself

## API Endpoints

### `GET /api/list`

Return vault directory tree.

```json
{
  "tree": [
    {
      "name": "output",
      "type": "folder",
      "children": [
        {"name": "report.md", "type": "file", "path": "output/report.md"}
      ]
    },
    {
      "name": "index.md",
      "type": "file",
      "path": "index.md"
    }
  ]
}
```

- Only `.md` files (unless requested otherwise)
- Hidden folders (`.` prefix) excluded
- Sort: pinned first → alphabetical within each group

### `GET /api/read?path=<filepath>`

Return file content + basic metadata.

```json
{
  "path": "output/report.md",
  "content": "# Hello\n\nWorld",
  "size": 1024,
  "modified": "2026-07-02T10:00:00"
}
```

- **ponytail**: no depth limit, no file lock — YAGNI
- Path traversal: block `..` segments

### `POST /api/save`

Body: `{"path": "output/report.md", "content": "# new content"}`

Response: `{"ok": true}` or `{"error": "..."}`

- Write with `w` mode, utf-8
- Creates new files too — path doesn't exist → creates it
- Create parent dirs if needed
- **ponytail**: no atomic writes, no conflict detection — add when multiple editors exist

### `GET /api/search?q=<query>`

Grep-style full-text search via ripgrep.

```json
{
  "results": [
    {
      "file": "output/report.md",
      "line": 3,
      "content": "some text with <em>query</em> match"
    }
  ]
}
```

- Use `rg` CLI (already installed) — faster than pure Python grep
- **ponytail**: no index, no fuzzy search — plain ripgrep, add when speed matters

### `GET /` and static files

Serve `index.html` (the SPA) for `/`.
Everything else under `/static/` served as-is.

## File Layout

```
obsidian-web-viewer/
├── app.py              # Flask app (single file)
├── index.html          # SPA frontend
├── static/
│   ├── style.css       # split from mockup
│   └── script.js       # split from mockup
├── docs/
│   ├── api-spec.md     # English spec
│   └── api-spec.ja.md  # Japanese spec
└── drafts/
    └── design-mockup.html  # design reference
```

**ponytail**: single `app.py` — split only when lines exceed 300.

## Security

- Path traversal: reject `..` in `path` params
- Save: limit to vault root (`~/vault/`)
- No auth for now (LAN-only, single user). Add basic auth when exposed to WAN.
