// 将棋の盤面・指し手の最小限のモデル。
// 合法手の判定は行わない（元データの局面作成手順がルール無視のため、
// 「駒を動かす・取った駒は持ち駒になる」だけを再現する）。

export type Side = "s" | "g"; // s: 先手, g: 後手

export const HAND_KINDS = ["飛", "角", "金", "銀", "桂", "香", "歩"] as const;
export type HandKind = (typeof HAND_KINDS)[number];
export type PromotedKind = "と" | "成香" | "成桂" | "成銀" | "馬" | "龍";
export type Kind = HandKind | "玉" | PromotedKind;

export const PROMOTE: Partial<Record<Kind, PromotedKind>> = {
  歩: "と",
  香: "成香",
  桂: "成桂",
  銀: "成銀",
  角: "馬",
  飛: "龍",
};
const UNPROMOTE: Record<PromotedKind, HandKind> = {
  と: "歩",
  成香: "香",
  成桂: "桂",
  成銀: "銀",
  馬: "角",
  龍: "飛",
};

export type Piece = { side: Side; kind: Kind };
/** 筋(1-9), 段(1-9) */
export type Square = { file: number; rank: number };

export type Hand = Record<HandKind | "玉", number>;
export type Position = {
  /** index = (rank-1)*9 + (9-file)。表示と同じ並び（左上が９一）。 */
  board: (Piece | null)[];
  hands: Record<Side, Hand>;
};

export type Move = {
  side: Side;
  /** null なら打つ手 */
  from: Square | null;
  to: Square;
  /** 動かす前の駒（打つ手なら打つ駒） */
  kind: Kind;
  promote: boolean;
  /** 成れるのにあえて成らなかった（元データに「不成」と明記） */
  noPromote: boolean;
  comments: string[];
};

export const sqIndex = (sq: Square) => (sq.rank - 1) * 9 + (9 - sq.file);
export const sameSquare = (a: Square | null, b: Square | null) =>
  a !== null && b !== null && a.file === b.file && a.rank === b.rank;

export function emptyHand(): Hand {
  return { 飛: 0, 角: 0, 金: 0, 銀: 0, 桂: 0, 香: 0, 歩: 0, 玉: 0 };
}

export function hiratePosition(): Position {
  const board: (Piece | null)[] = Array(81).fill(null);
  const put = (file: number, rank: number, side: Side, kind: Kind) => {
    board[sqIndex({ file, rank })] = { side, kind };
  };
  const back: Kind[] = ["香", "桂", "銀", "金", "玉", "金", "銀", "桂", "香"];
  back.forEach((kind, i) => {
    put(9 - i, 1, "g", kind);
    put(9 - i, 9, "s", kind);
  });
  put(8, 2, "g", "飛");
  put(2, 2, "g", "角");
  put(2, 8, "s", "飛");
  put(8, 8, "s", "角");
  for (let f = 1; f <= 9; f++) {
    put(f, 3, "g", "歩");
    put(f, 7, "s", "歩");
  }
  return { board, hands: { s: emptyHand(), g: emptyHand() } };
}

export function clonePosition(pos: Position): Position {
  return {
    board: pos.board.slice(),
    hands: { s: { ...pos.hands.s }, g: { ...pos.hands.g } },
  };
}

export function toHandKind(kind: Kind): HandKind | "玉" {
  return kind in UNPROMOTE ? UNPROMOTE[kind as PromotedKind] : (kind as HandKind | "玉");
}

/** ルールを無視して指し手を適用する。矛盾があれば例外を投げる。 */
export function applyMove(pos: Position, mv: Move): Position {
  const next = clonePosition(pos);
  let kind: Kind;
  if (mv.from === null) {
    const hk = mv.kind as HandKind | "玉";
    if (!(next.hands[mv.side][hk] > 0)) throw new Error(`持ち駒に${hk}がない`);
    next.hands[mv.side][hk]--;
    kind = mv.kind;
  } else {
    const src = next.board[sqIndex(mv.from)];
    if (!src) throw new Error("移動元に駒がない");
    if (src.side !== mv.side || src.kind !== mv.kind) throw new Error("移動元の駒が一致しない");
    next.board[sqIndex(mv.from)] = null;
    kind = mv.promote ? (PROMOTE[src.kind] ?? src.kind) : src.kind;
  }
  const captured = next.board[sqIndex(mv.to)];
  if (captured) next.hands[mv.side][toHandKind(captured.kind)]++;
  next.board[sqIndex(mv.to)] = { side: mv.side, kind };
  return next;
}

/** 成ることができる移動か（行き所のない駒の強制成りは考慮しない） */
export function canPromote(side: Side, kind: Kind, from: Square, to: Square): boolean {
  if (!(kind in PROMOTE)) return false;
  const inZone = (sq: Square) => (side === "s" ? sq.rank <= 3 : sq.rank >= 7);
  return inZone(from) || inZone(to);
}

// ---- 表記 ----

export const FILE_ZEN = ["", "１", "２", "３", "４", "５", "６", "７", "８", "９"];
export const RANK_KAN = ["", "一", "二", "三", "四", "五", "六", "七", "八", "九"];
const KAN_NUM = ["", "", "二", "三", "四", "五", "六", "七", "八", "九", "十", "十一", "十二", "十三", "十四", "十五", "十六", "十七", "十八"];
export const kanNum = (n: number) => KAN_NUM[n] ?? String(n);

export const sideMark = (side: Side) => (side === "s" ? "▲" : "△");

/** 「▲７二飛打」「△同　玉」のような表記（KI2 風だが打は常に付ける） */
export function moveLabel(mv: Move, prev: Move | null): string {
  const dest = prev && sameSquare(prev.to, mv.to) ? "同　" : FILE_ZEN[mv.to.file] + RANK_KAN[mv.to.rank];
  const suffix = mv.from === null ? "打" : mv.promote ? "成" : mv.noPromote ? "不成" : "";
  return sideMark(mv.side) + dest + mv.kind + suffix;
}

/** 盤上に表示する 1 文字 */
export function pieceGlyph(p: Piece): string {
  switch (p.kind) {
    case "成香":
      return "杏";
    case "成桂":
      return "圭";
    case "成銀":
      return "全";
    case "玉":
      return p.side === "g" ? "王" : "玉";
    default:
      return p.kind;
  }
}

export const isPromoted = (kind: Kind) => kind in UNPROMOTE;
