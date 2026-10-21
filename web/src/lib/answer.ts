/** Checking a typed or chosen answer. Accents are letters (Hungarian o/ó/ö/ő are four
 * different vowels), so an answer that differs only in accents is "almost", not right. */
import { fold } from "./text";

export type Verdict = "right" | "almost" | "wrong";

const clean = (s: string) =>
  s
    .trim()
    .toLowerCase()
    .replace(/[.,!?;:]+$/u, "");

export function check(expected: string, given: string): Verdict {
  const e = clean(expected);
  const g = clean(given);
  if (!g) return "wrong";
  if (e === g) return "right";
  return fold(e) === fold(g) ? "almost" : "wrong";
}

export function shuffle<T>(items: T[], rng: () => number = Math.random): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** The answer plus up to 3 other words from the pool, in random order. */
export function choices(answer: string, pool: string[], rng: () => number = Math.random): string[] {
  const others = [...new Set(pool.map(clean))].filter((w) => w && w !== clean(answer));
  return shuffle([clean(answer), ...shuffle(others, rng).slice(0, 3)], rng);
}
