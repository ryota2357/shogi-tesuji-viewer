// Exports a problem as a game record for other apps (ぴよ将棋 etc.).
// Both formats assume 先手 moves first, which `Problem.moves` guarantees.

import type { Problem } from "./problem.ts";
import { FILE_ZEN, HAND_KINDS, type Hand, type Kind, type Move, type Piece, type Position, RANK_KAN, sameSquare, sqIndex } from "./shogi.ts";

// ---- KIF ----

const BOD_GLYPH: Record<Kind, string> = {
  歩: "歩",
  香: "香",
  桂: "桂",
  銀: "銀",
  金: "金",
  角: "角",
  飛: "飛",
  玉: "玉",
  と: "と",
  成香: "杏",
  成桂: "圭",
  成銀: "全",
  馬: "馬",
  龍: "龍",
};
// A hand holds at most 18 pieces of a kind (歩).
const KAN_COUNT = ["", "", "二", "三", "四", "五", "六", "七", "八", "九", "十", "十一", "十二", "十三", "十四", "十五", "十六", "十七", "十八"];

function kifHand(hand: Hand): string {
  const parts = HAND_KINDS.filter((k) => hand[k] > 0).map((k) => k + KAN_COUNT[hand[k]]);
  return parts.length > 0 ? parts.join("　") : "なし";
}

function kifMove(mv: Move, prev: Move | null): string {
  const dest = prev && sameSquare(prev.to, mv.to) ? "同　" : FILE_ZEN[mv.to.file] + RANK_KAN[mv.to.rank];
  if (mv.from === null) return `${dest}${mv.kind}打`;
  // 不成 is left out: the source square already says the piece did not promote, and some parsers
  // (e.g. tsshogi) reject 不成 in KIF.
  return `${dest}${mv.kind}${mv.promote ? "成" : ""}(${mv.from.file}${mv.from.rank})`;
}

const commentLines = (comments: string[]) => comments.flatMap((c) => c.split("\n")).map((l) => `*${l}`);

/** KIF that starts from the problem position (a BOD board diagram) and carries the comments */
export function toKif(p: Problem): string {
  const pos = p.start;
  const lines: string[] = [];
  lines.push(`棋戦：将棋の手筋 ${p.path.join(" / ")}`);
  lines.push(`表題：${p.title}`);
  lines.push(`後手の持駒：${kifHand(pos.hands.g)}`);
  lines.push("  ９ ８ ７ ６ ５ ４ ３ ２ １");
  lines.push("+---------------------------+");
  for (let rank = 1; rank <= 9; rank++) {
    let row = "|";
    for (let file = 9; file >= 1; file--) {
      const pc = pos.board[sqIndex({ file, rank })];
      row += pc ? (pc.side === "g" ? "v" : " ") + BOD_GLYPH[pc.kind] : " ・";
    }
    lines.push(`${row}|${RANK_KAN[rank]}`);
  }
  lines.push("+---------------------------+");
  lines.push(`先手の持駒：${kifHand(pos.hands.s)}`);
  lines.push("先手：先手");
  lines.push("後手：後手");
  lines.push("手数----指手---------消費時間--");
  lines.push(...commentLines(p.prompt));
  p.moves.forEach((mv, i) => {
    lines.push(`${String(i + 1).padStart(4)} ${kifMove(mv, p.moves[i - 1] ?? null).padEnd(12)}( 0:00/00:00:00)`);
    lines.push(...commentLines(mv.comments));
  });
  return `${lines.join("\r\n")}\r\n`;
}

// ---- SFEN / USI ----

const SFEN_LETTER: Record<Kind, string> = {
  歩: "p",
  香: "l",
  桂: "n",
  銀: "s",
  金: "g",
  角: "b",
  飛: "r",
  玉: "k",
  と: "+p",
  成香: "+l",
  成桂: "+n",
  成銀: "+s",
  馬: "+b",
  龍: "+r",
};
const RANK_LETTER = " abcdefghi";

function sfenPiece(pc: Piece): string {
  const s = SFEN_LETTER[pc.kind];
  return pc.side === "s" ? s.toUpperCase() : s;
}

/** SFEN of a position with 先手 to move */
function toSfen(pos: Position): string {
  const rows: string[] = [];
  for (let rank = 1; rank <= 9; rank++) {
    let row = "";
    let empty = 0;
    for (let file = 9; file >= 1; file--) {
      const pc = pos.board[sqIndex({ file, rank })];
      if (pc) {
        if (empty > 0) row += empty;
        empty = 0;
        row += sfenPiece(pc);
      } else empty++;
    }
    if (empty > 0) row += empty;
    rows.push(row);
  }
  let hands = "";
  for (const side of ["s", "g"] as const) {
    for (const k of HAND_KINDS) {
      const n = pos.hands[side][k];
      if (n > 0) hands += (n > 1 ? n : "") + sfenPiece({ side, kind: k });
    }
  }
  return `${rows.join("/")} b ${hands || "-"} 1`;
}

function usiMove(mv: Move): string {
  const to = `${mv.to.file}${RANK_LETTER[mv.to.rank]}`;
  if (mv.from === null) return `${SFEN_LETTER[mv.kind].toUpperCase()}*${to}`;
  return `${mv.from.file}${RANK_LETTER[mv.from.rank]}${to}${mv.promote ? "+" : ""}`;
}

/**
 * A link that opens the problem in ぴよ将棋 at the position after `step` moves, with the whole
 * solution loaded. ぴよ将棋's link format cannot carry comments.
 * "app" opens the iOS / Android app, "web" opens ぴよ将棋w in the browser.
 */
export function piyoLink(p: Problem, step: number, target: "app" | "web"): string {
  const sfen = `position sfen ${toSfen(p.start)} moves ${p.moves.map(usiMove).join(" ")}`;
  const query = `sfen=${encodeURIComponent(sfen)}&num=${step}&game_name=${encodeURIComponent(p.title)}`;
  return target === "app" ? `piyoshogi://?${query}` : `https://www.studiok-i.net/ps/?${query}`;
}
