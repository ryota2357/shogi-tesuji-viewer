// 外部アプリ（ピヨ将棋など）に渡すための書き出し。

import type { Problem } from "./problem.ts";
import {
  FILE_ZEN,
  HAND_KINDS,
  type Hand,
  type Kind,
  kanNum,
  type Move,
  type Piece,
  type Position,
  RANK_KAN,
  sameSquare,
  sqIndex,
} from "./shogi.ts";

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

function kifHand(hand: Hand): string {
  const parts = HAND_KINDS.filter((k) => hand[k] > 0).map((k) => k + (hand[k] > 1 ? kanNum(hand[k]) : ""));
  return parts.length > 0 ? parts.join("　") : "なし";
}

function kifMove(mv: Move, prev: Move | null): string {
  const dest = prev && sameSquare(prev.to, mv.to) ? "同　" : FILE_ZEN[mv.to.file] + RANK_KAN[mv.to.rank];
  if (mv.from === null) return `${dest}${mv.kind}打`;
  // KIF では「不成」は書かない（移動元があるので成らないことは表せる。「不成」を読めないパーサーもある）
  return `${dest}${mv.kind}${mv.promote ? "成" : ""}(${mv.from.file}${mv.from.rank})`;
}

const commentLines = (comments: string[]) => comments.flatMap((c) => c.split("\n")).map((l) => `*${l}`);

/** 局面図（BOD）付きの KIF。コメントも含む。 */
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

// ---- SFEN ----

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

export function toSfen(pos: Position): string {
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
 * ぴよ将棋で開くリンク。手順も含め、num 手目の局面を表示する（解説コメントは渡せない）。
 * app: true ならアプリ（iOS / Android）、false なら WEB 版の「ぴよ将棋w」。
 */
export function piyoLink(p: Problem, num: number, app: boolean): string {
  const sfen = `position sfen ${toSfen(p.start)} moves ${p.moves.map(usiMove).join(" ")}`;
  const query = `sfen=${encodeURIComponent(sfen)}&num=${num}&game_name=${encodeURIComponent(p.title)}`;
  return app ? `piyoshogi://?${query}` : `https://www.studiok-i.net/ps/?${query}`;
}
