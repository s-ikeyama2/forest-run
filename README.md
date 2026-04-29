# ふわふわエンジェル 森の精霊ラン

ブラウザで遊べる横スクロール収集ゲームです。主人公のふわふわエンジェルを上下キーで操作し、6レーンに出現する森の仲間を集めます。

## 遊び方

- `Enter` / `Space` / クリック: ゲーム開始、リスタート
- `↑` / `↓`: レーン変更
- `P`: 一時停止

## ルール

- 制限時間は30秒から開始します。
- 時間経過でスクロール速度が上がります。
- 同じキャラクターを3回連続で収集すると、スコア加点と制限時間延長が発生します。
- 収集枠は8体までです。
- 8枠が埋まるとゲームオーバーです。

## GitHub Pagesで公開する方法

1. GitHubで新しいリポジトリを作成します。
2. `index.html`, `styles.css`, `game.js`, `assets` フォルダをアップロードします。
3. `README.md` も一緒にアップロードします。
4. リポジトリの `Settings` から `Pages` を開きます。
5. `Source` を `Deploy from a branch` にします。
6. Branchを `main`、Folderを `/root` にして保存します。
7. 数分後、GitHub PagesのURLからゲームを遊べます。

## ファイル構成

```text
.
├── index.html
├── styles.css
├── game.js
├── README.md
└── assets/
    ├── sprites-source.png
    ├── collect-boar.jpg
    ├── collect-tiger.jpg
    └── collect-unicorn.jpg
```
