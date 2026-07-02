# syntax=docker/dockerfile:1
FROM python:3.11-slim

WORKDIR /app

# ripgrepインストール（全文検索に使用）
RUN apt-get update && apt-get install -y --no-install-recommends ripgrep \
    && rm -rf /var/lib/apt/lists/*

# Flaskインストール
RUN pip install flask --no-cache-dir

# アプリケーションファイル
COPY app.py index.html ./
COPY static/ ./static/

# コンテンツディレクトリ（外部マウント用）
VOLUME /app/content

EXPOSE 5000

CMD ["python", "app.py"]