import type { ComponentChildren } from "preact";
import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { categoryOf, type Problem } from "./problem.ts";
import { scrollIntoContainer } from "./scroll.ts";
import type { Mark, RandomPool, Store } from "./storage.ts";

export const MARK_GLYPH: Record<Mark, string> = { ok: "○", ng: "×" };
export const POOL_LABEL: Record<RandomPool, string> = {
  all: "すべて",
  none: "無印",
  ...MARK_GLYPH,
};

type Props = {
  problems: Problem[];
  current: number;
  store: Store;
  onSelect: (index: number) => void;
  onRandom: () => void;
  onRandomPool: (pool: RandomPool) => void;
  /** Actions shown above the list only in the mobile layout, where they do not fit under the board */
  mobileActions: ComponentChildren;
};

/** The problem list grouped by category, with the marks and random picking */
export function Sidebar({
  problems,
  current,
  store,
  onSelect,
  onRandom,
  onRandomPool,
  mobileActions,
}: Props) {
  const categories = useMemo(() => {
    const cs: { name: string; indices: number[] }[] = [];
    problems.forEach((p, i) => {
      const name = categoryOf(p);
      if (cs.at(-1)?.name !== name) cs.push({ name, indices: [] });
      cs[cs.length - 1].indices.push(i);
    });
    return cs;
  }, [problems]);
  const currentCategory = categoryOf(problems[current]);
  const [open, setOpen] = useState<Set<string>>(
    () => new Set([currentCategory]),
  );
  useEffect(
    () =>
      setOpen((o) =>
        o.has(currentCategory) ? o : new Set(o).add(currentCategory),
      ),
    [currentCategory],
  );
  const ref = useRef<HTMLElement>(null);
  useEffect(
    () => scrollIntoContainer(ref.current, ".problem.current", false),
    [current, open],
  );

  const countMarked = (mark: Mark, indices: number[]) =>
    indices.filter((i) => store.marks[problems[i].id] === mark).length;
  const toggle = (name: string) =>
    setOpen((o) => {
      const n = new Set(o);
      if (n.has(name)) n.delete(name);
      else n.add(name);
      return n;
    });

  const all = problems.map((_, i) => i);
  return (
    <nav class="sidebar" ref={ref}>
      <div class="sidebar-actions mobile-only">{mobileActions}</div>
      <div class="summary">
        <span>
          <span class="ok">○ {countMarked("ok", all)}</span>{" "}
          <span class="ng">× {countMarked("ng", all)}</span>{" "}
          <span class="muted">/ {problems.length}</span>
        </span>
        <span class="random">
          <select
            value={store.randomPool}
            onChange={(e) => onRandomPool(e.currentTarget.value as RandomPool)}
            title="ランダム出題の対象"
          >
            {(Object.keys(POOL_LABEL) as RandomPool[]).map((k) => (
              <option key={k} value={k}>
                {POOL_LABEL[k]}
              </option>
            ))}
          </select>
          <button type="button" onClick={onRandom} title="ランダムに出題 (r)">
            ランダム
          </button>
        </span>
      </div>
      {categories.map(({ name, indices }) => (
        <div key={name}>
          <button
            type="button"
            class={`category ${name === currentCategory ? "current" : ""}`}
            onClick={() => toggle(name)}
          >
            <span>
              {open.has(name) ? "▾" : "▸"} {name}
            </span>
            <span class="muted">
              {countMarked("ok", indices)}/{indices.length}
            </span>
          </button>
          {open.has(name) &&
            indices.map((i) => {
              const p = problems[i];
              const mark = store.marks[p.id];
              return (
                <button
                  type="button"
                  key={p.id}
                  class={`problem ${i === current ? "current" : ""}`}
                  onClick={() => onSelect(i)}
                >
                  <span class={`mark ${mark ?? ""}`}>
                    {mark && MARK_GLYPH[mark]}
                  </span>
                  {p.title}
                </button>
              );
            })}
        </div>
      ))}
    </nav>
  );
}
