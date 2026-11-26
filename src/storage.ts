// Persists the user's marks and preferences in localStorage.

/** ok: ○, ng: × — what they mean is up to the user */
export type Mark = "ok" | "ng";
/** Which problems random picks from: "none" means unmarked ones */
export type RandomPool = "all" | "none" | Mark;

export type Store = {
  marks: Record<string, Mark>;
  /** The problem opened last, to resume from */
  last: string | null;
  randomPool: RandomPool;
};

const KEY = "shogi-tesuji:v2";

export function loadStore(): Store {
  try {
    const saved = JSON.parse(
      localStorage.getItem(KEY) ?? "{}",
    ) as Partial<Store>;
    return {
      marks: saved.marks ?? {},
      last: saved.last ?? null,
      randomPool: saved.randomPool ?? "all",
    };
  } catch {
    return { marks: {}, last: null, randomPool: "all" };
  }
}

export function saveStore(store: Store) {
  localStorage.setItem(KEY, JSON.stringify(store));
}
