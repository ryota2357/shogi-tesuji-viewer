import type { Move, Position } from "./shogi.ts";

export type Problem = {
  /** localStorage のキーにも使う安定 ID（「カテゴリ:元データの Title」。重複時は連番を付与） */
  id: string;
  title: string;
  /** カテゴリの階層（例: ["双玉問題", "即詰みの手筋"]） */
  path: string[];
  /** 問題図 */
  start: Position;
  /** 問題図に至った直前の手（解説が付いている場合のみ。局面作成用の手は含めない） */
  lastMove: Move | null;
  /** 問題図の時点で表示する解説 */
  prompt: string[];
  /** 解答手順（先手から） */
  moves: Move[];
};

export type ProblemData = {
  problems: Problem[];
};
