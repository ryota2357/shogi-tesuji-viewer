# 将棋の手筋ビューア（個人用）

アプリ「将棋の手筋」(macOS 版) の問題データを読み出して、ブラウザで見やすく解けるようにしたもの。

## 使い方

```sh
direnv allow            # または nix develop
pnpm install
pnpm extract            # /Applications/将棋の手筋.app から src/generated/problems.json を生成
pnpm dev                # 開発サーバ
pnpm build              # dist/index.html（1 ファイル完結。file:// で直接開ける）
```

`src/generated/` はアプリの著作物なので `.gitignore` 済み。公開しないこと。

## 機能

- 盤面と解説を並べて表示、1 手ずつ進む / 戻る、次の問題へ（スマホは画面幅・高さに合わせて表示）
- 盤上で駒を動かして、想定手順どおりなら進む（相手の応手は自動）
- ○ / × の記録（localStorage）、○ / × / 無印 / すべてからランダム出題
- キーボード操作（`?` で一覧）
- 棋譜コピー（ぴよ将棋の「クリップボードから棋譜を読み込む」で解説付きで読める）
- 表示中の局面をぴよ将棋で開く（PC は WEB 版のぴよ将棋w、スマホはアプリ。解説は付かない）

## 元データの形式（scripts/extract.ts 参照）

`Wrapper/Tesuji.app/fork.plist` に全 506 問。各問題の `Record` は平手初期配置からルール無視で駒を動かして問題図を作る手順＋解答手順の棋譜テキスト。

- 1〜(Index+1) 手目が問題図の作成手順、以降が解答手順
- `counterCapturedRemovedIndex:N` は N+1 手目の直後に後手の持ち駒を空にする（余り駒を駒箱へ）
- `*` 行は直前の手の解説。`end` 以降は開発メモ
