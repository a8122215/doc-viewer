# doc-viewer

同じ `Projects/` フォルダ配下にある各プロジェクトの `docs/**/*.md` を自動検出し、Markdown + Mermaid を読み取り専用でHTML表示する個人用ビューアです。

## ディレクトリ構成

```text
Projects/
  doc-viewer/
  some-project/
    docs/
      index.md
      architecture.md
      implementation-plan.md
```

`doc-viewer` は親ディレクトリ `../` を `ProjectsRoot` として走査し、自分自身を除いた `Projects/<project>/docs/**/*.md` のみを表示対象にします。

## 起動方法

```bash
npm install
npm run dev
```

Vite は `http://127.0.0.1:5173`、Express API は `http://127.0.0.1:4321` で起動します。どちらもローカルホスト限定です。

## Dockerで常駐起動

常に動かしておく場合は Docker Compose を使います。

```bash
docker compose up -d --build
```

ブラウザでは `http://127.0.0.1:4321` を開きます。停止する場合は次のコマンドです。

```bash
docker compose down
```

Compose では `../` を `/projects` に読み取り専用でマウントします。Markdown はコンテナイメージに取り込まず、API リクエストごとに `/projects/<project>/docs/**/*.md` を再走査・再読込するため、各プロジェクト側の `docs` にファイルを追加・変更してもコンテナの再ビルドは不要です。

開いている画面でも、ブラウザタブが表示中であれば約5秒間隔でドキュメント一覧と本文を再取得します。

## 各プロジェクト側に必要な構成

各プロジェクト側には変換環境やビルド設定は不要です。Markdown ファイルだけを置いてください。

```text
some-project/
  docs/
    index.md
    architecture.md
    implementation-plan.md
```

## セキュリティ方針

- API は読み取り専用です。
- 任意パスを読み込める API はありません。
- 読み取り対象は `Projects/<project>/docs/**/*.md` に限定します。
- `doc-viewer` 自身、`node_modules`、`.git`、`dist`、`build`、`.next`、`.vite`、`coverage` は対象外です。
- `realpath` で実体パスを確認し、`docs` 配下でないファイルは拒否します。
- Markdown のHTML出力はサニタイズします。
- Mermaid は `securityLevel: "strict"` で描画します。
- サーバーは `127.0.0.1` / `localhost` / `::1` 以外の host を拒否します。
- Docker ではホスト側の公開先を `127.0.0.1:4321` に固定し、コンテナ内待ち受けに限って明示フラグ付きで `0.0.0.0` を使います。

## 制限事項

- ブラウザからの編集、保存、削除、リネーム、移動はできません。
- 表示対象は Markdown ファイルのみです。
- プロジェクトは `ProjectsRoot` 直下のディレクトリとして扱います。
- Mermaid のクリック機能やHTML埋め込みは strict 設定により無効化されます。

## 今後追加すると便利な機能

- 最近更新されたドキュメント順のビュー。
- タグや見出し横断検索。
- ダークモード。
- ドキュメント間リンクの補助表示。
- 静的HTMLエクスポート。

## License

MIT
