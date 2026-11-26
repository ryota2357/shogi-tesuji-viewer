// アプリ「将棋の手筋」(macOS 版) のバンドルから問題データを抽出して JSON にする。
//
//   pnpm extract [path/to/fork.plist]
//
// 元データ（fork.plist）の Record は「平手初期配置から、ルール無視で駒を動かして問題図を作る手順」
// ＋「解答手順」の棋譜テキストになっている。
//   - 1〜(Index+1) 手目: 問題図を作る手順（最後の 1 手は直前の手として解説が付くことがある）
//   - (Index+2) 手目以降: 解答手順
//   - "counterCapturedRemovedIndex:N" があれば、N+1 手目を指した直後に後手の持ち駒を空にする
//     （余った駒を駒箱に戻す操作）
//   - "*" で始まる行は直前の手への解説。end 以降は開発メモなので無視する。

import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Problem, ProblemData } from "../src/problem.ts";
import { applyMove, emptyHand, hiratePosition, type Kind, type Move, type Position } from "../src/shogi.ts";

const DEFAULT_PLIST = "/Applications/将棋の手筋.app/Wrapper/Tesuji.app/fork.plist";
const OUT = join(dirname(fileURLToPath(import.meta.url)), "../src/generated/problems.json");

type RawNode = { Caption: string; Title?: string; Index?: number; Record?: string; Fork?: RawNode[] };

const ZEN = "１２３４５６７８９";
const KAN = "一二三四五六七八九";
const MOVE_RE = /^(\d+) ([１-９])([一二三四五六七八九])(.+?)(?:\((\d)(\d)\)|打):(先手|後手)$/;

function parseRecord(record: string): { removedIndex: number | null; moves: Move[] } {
  let removedIndex: number | null = null;
  const moves: Move[] = [];
  for (const line of record.split("\n")) {
    if (line.trim() === "end") break;
    const m = MOVE_RE.exec(line);
    if (m) {
      const [, num, f, r, pieceText, ff, fr, side] = m;
      if (Number(num) !== moves.length + 1) throw new Error(`手数が連続していない: ${line}`);
      let kind = pieceText;
      let promote = false;
      let noPromote = false;
      if (kind.endsWith("不成")) {
        kind = kind.slice(0, -2);
        noPromote = true;
      } else if (kind.length > 1 && kind.endsWith("成") && !kind.startsWith("成")) {
        kind = kind.slice(0, -1);
        promote = true;
      }
      moves.push({
        side: side === "先手" ? "s" : "g",
        from: ff ? { file: Number(ff), rank: Number(fr) } : null,
        to: { file: ZEN.indexOf(f) + 1, rank: KAN.indexOf(r) + 1 },
        kind: kind as Kind,
        promote,
        noPromote,
        comments: [],
      });
    } else if (line.startsWith("counterCapturedRemovedIndex:")) {
      const n = Number(line.split(":")[1]);
      removedIndex = n >= 0 ? n : null;
    } else if (line.startsWith("*")) {
      moves.at(-1)?.comments.push(line.slice(1));
    } else if (line.trim() !== "") {
      // "*" の付いていない行は直前の解説の続き
      const last = moves.at(-1)?.comments;
      if (!last || last.length === 0) throw new Error(`解釈できない行: ${line}`);
      last[last.length - 1] += `\n${line}`;
    }
  }
  return { removedIndex, moves };
}

function convert(node: RawNode, path: string[]): Omit<Problem, "id"> {
  const { removedIndex, moves } = parseRecord(node.Record ?? "");
  const index = node.Index ?? -1;
  if (index < 0 || index + 1 >= moves.length) throw new Error("Index が範囲外");

  let pos: Position = hiratePosition();
  for (let i = 0; i <= index; i++) {
    if (i < index && moves[i].comments.length > 0) throw new Error("局面作成手順に解説がある");
    pos = applyMove(pos, moves[i]);
    if (removedIndex !== null && i === removedIndex) pos.hands.g = emptyHand();
  }
  const last = moves[index];
  const solution = moves.slice(index + 1);
  // 解答手順もルール無視で再生して矛盾がないことだけ確認する
  solution.reduce(applyMove, pos);
  if (solution[0].side !== "s") throw new Error("解答が後手から始まっている");

  return {
    title: node.Caption,
    path,
    start: pos,
    lastMove: last.comments.length > 0 ? { ...last, comments: [] } : null,
    prompt: last.comments,
    moves: solution,
  };
}

const plist = process.argv[2] ?? DEFAULT_PLIST;
const root = JSON.parse(execFileSync("plutil", ["-convert", "json", "-o", "-", plist], { encoding: "utf8", maxBuffer: 64 << 20 })) as RawNode[];

const problems: Problem[] = [];
const usedIds = new Map<string, number>();
const walk = (nodes: RawNode[], path: string[]) => {
  for (const node of nodes) {
    if (node.Record !== undefined) {
      const base = `${path.join("/")}:${node.Title ?? "noid"}`;
      const n = usedIds.get(base) ?? 0;
      usedIds.set(base, n + 1);
      const id = n === 0 ? base : `${base}#${n + 1}`;
      try {
        problems.push({ id, ...convert(node, path) });
      } catch (e) {
        throw new Error(`${path.join("/")} / ${node.Caption} (${base}): ${(e as Error).message}`);
      }
    }
    if (node.Fork) walk(node.Fork, [...path, node.Caption]);
  }
};
walk(root, []);

const data: ProblemData = { problems };
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(data));
const dup = [...usedIds].filter(([, n]) => n > 1);
console.log(`${problems.length} 問を書き出しました: ${OUT}`);
if (dup.length > 0) console.log(`ID の重複（連番を付与）: ${dup.map(([k, n]) => `${k}×${n}`).join(", ")}`);
