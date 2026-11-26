// Extracts the problems from the bundle of the app 「将棋の手筋」 (macOS version) into JSON.
//
//   pnpm extract [path/to/fork.plist]
//
// In fork.plist, each problem's Record is a kifu text that first builds the problem position by
// moving pieces from the initial position with no regard for the rules, then plays the solution:
//   - moves 1 to Index+1 set up the position; only the last of them can be a real move, and it is
//     one exactly when it has a comment
//   - moves from Index+2 on are the solution
//   - "counterCapturedRemovedIndex:N" empties 後手's hand right after move N+1, putting the pieces
//     left over from the setup back in the box (-1 means no such step)
//   - a line starting with "*" comments on the preceding move, and so does a following line
//     without "*"; everything after "end" is the developer's notes

import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Problem } from "../src/problem.ts";
import { applyMove, emptyHand, hiratePosition, type Kind, type Move, type Position } from "../src/shogi.ts";

const DEFAULT_PLIST = "/Applications/将棋の手筋.app/Wrapper/Tesuji.app/fork.plist";
const OUT = join(dirname(fileURLToPath(import.meta.url)), "../src/generated/problems.json");

/** A node of fork.plist: a category when it has Fork, a problem when it has Record */
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
      if (Number(num) !== moves.length + 1) throw new Error(`move number out of sequence: ${line}`);
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
      const last = moves.at(-1)?.comments;
      if (!last || last.length === 0) throw new Error(`unexpected line: ${line}`);
      last[last.length - 1] += `\n${line}`;
    }
  }
  return { removedIndex, moves };
}

function convert(id: string, node: RawNode, path: string[]): Problem {
  const { removedIndex, moves } = parseRecord(node.Record ?? "");
  const index = node.Index ?? -1;
  if (index < 0 || index + 1 >= moves.length) throw new Error("Index out of range");

  let pos: Position = hiratePosition();
  for (let i = 0; i <= index; i++) {
    if (i < index && moves[i].comments.length > 0) throw new Error("a setup move has a comment");
    pos = applyMove(pos, moves[i]);
    if (i === removedIndex) pos.hands.g = emptyHand();
  }
  const last = moves[index];
  const solution = moves.slice(index + 1);
  if (solution[0].side !== "s") throw new Error("the solution starts with 後手");
  // Replaying the solution throws if it does not fit the position.
  solution.reduce(applyMove, pos);

  return {
    id,
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
const walk = (nodes: RawNode[], path: string[]) => {
  for (const node of nodes) {
    if (node.Record !== undefined) {
      const id = `${path.join("/")}:${node.Title}`;
      try {
        if (node.Title === undefined) throw new Error("no Title");
        if (problems.some((p) => p.id === id)) throw new Error("duplicate id");
        problems.push(convert(id, node, path));
      } catch (e) {
        throw new Error(`${id} ${node.Caption}: ${(e as Error).message}`);
      }
    }
    if (node.Fork) walk(node.Fork, [...path, node.Caption]);
  }
};
walk(root, []);

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(problems));
console.log(`Wrote ${problems.length} problems to ${OUT}`);
