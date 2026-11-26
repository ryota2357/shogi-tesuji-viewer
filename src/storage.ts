// ○ / × の記録などを localStorage に保存する。

/** ok: ○, ng: × （意味は使う人の気分でよい） */
export type Mark = "ok" | "ng";
/** ランダム出題の対象 */
export type RandomPool = "all" | "none" | "ok" | "ng";

export type Store = {
  status: Record<string, Mark>;
  last: string | null;
  randomPool: RandomPool;
};

const KEY = "shogi-tesuji:v1";

export function loadStore(): Store {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "{}") as Partial<Store>;
    return { status: raw.status ?? {}, last: raw.last ?? null, randomPool: raw.randomPool ?? "all" };
  } catch {
    return { status: {}, last: null, randomPool: "all" };
  }
}

export function saveStore(store: Store) {
  localStorage.setItem(KEY, JSON.stringify(store));
}
