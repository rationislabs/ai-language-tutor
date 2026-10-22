/** Progress, settings and AI stories on the device (IndexedDB). The AI key is never stored
 * here and never exported: see keys.ts. */
import { openDB, type IDBPDatabase } from "idb";
import { review, type Card } from "./srs";
import type { HelpLang, Lang, Story } from "./types";

export interface LangSettings {
  help: HelpLang;
  mode: "type" | "choose";
  speed: 0.75 | 1;
}

export interface Progress {
  cards: Record<string, Card>; // lemma → schedule
  done: string[]; // story ids
  minutes: number;
  days: string[]; // YYYY-MM-DD with activity
}

export interface Store {
  progress(lang: Lang): Promise<Progress>;
  saveProgress(lang: Lang, p: Progress): Promise<void>;
  settings(lang: Lang): Promise<LangSettings>;
  saveSettings(lang: Lang, s: LangSettings): Promise<void>;
  stories(lang: Lang): Promise<Story[]>;
  saveStories(lang: Lang, s: Story[]): Promise<void>;
  exportAll(): Promise<string>;
  importAll(json: string): Promise<void>;
}

export const DEFAULT_SETTINGS: LangSettings = { help: "en", mode: "type", speed: 1 };
const EMPTY: Progress = { cards: {}, done: [], minutes: 0, days: [] };
const FORMAT = "rationis-tutor-progress-1";
const NOT_OURS = "Not a progress file from this app.";
const KEY = /^(progress|settings|stories):(de|hu|fr|it)$/;
const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const strings = (v: unknown) => Array.isArray(v) && v.every((x) => typeof x === "string");
/** A review schedule ts-fsrs can work with: finite numbers, and a review of it succeeds
 * (ts-fsrs throws on a null due date, an unknown state or a broken last_review). */
export const validCard = (v: any): boolean => {
  if (!isObj(v) || !["stability", "difficulty", "reps", "lapses", "state"].every((k) => Number.isFinite(v[k])))
    return false;
  try {
    return !Number.isNaN(new Date(review(v as unknown as Card, "right", new Date()).due).getTime());
  } catch {
    return false;
  }
};
/** A story the app made (only those are stored: built-in ones come from content/). Its id
 * starts with "ai-", so it can never take a built-in story's place. */
export const validStory = (v: any): boolean =>
  isObj(v) &&
  typeof v.id === "string" &&
  v.id.startsWith("ai-") &&
  typeof v.title === "string" &&
  typeof v.level === "string" &&
  Array.isArray(v.sentences) &&
  v.sentences.length > 0 &&
  v.sentences.every((s: any) => isObj(s) && typeof s.text === "string" && isObj(s.help)) &&
  strings(v.new_words) &&
  strings(v.names);
const VALID: Record<string, (v: any) => boolean> = {
  progress: (v) =>
    isObj(v) &&
    isObj(v.cards) &&
    Object.values(v.cards).every(validCard) &&
    strings(v.done) &&
    Number.isFinite(v.minutes) &&
    strings(v.days),
  settings: (v) =>
    isObj(v) && ["en", "de"].includes(v.help as string) && ["type", "choose"].includes(v.mode as string) && [0.75, 1].includes(v.speed as number),
  // the Library keys its list by id: a duplicate crashes it on every start
  stories: (v) => Array.isArray(v) && v.every(validStory) && new Set(v.map((s) => s.id)).size === v.length,
};

/** Stored stories without the broken ones and repeated ids: generate() saves the loaded
 * list plus the new story, so dropping the whole list would lose every other story. */
function repairStories(v: unknown): Story[] {
  if (!Array.isArray(v)) return [];
  const seen = new Set<string>();
  return structuredClone(v.filter((s) => validStory(s) && !seen.has(s.id) && seen.add(s.id)));
}

/** Stored progress with every broken part replaced by its default: months of review
 * schedules must not be lost because one field is missing or one card is damaged. */
function repairProgress(v: any): Progress {
  if (!isObj(v)) return structuredClone(EMPTY);
  const cards = isObj(v.cards)
    ? Object.fromEntries(Object.entries(v.cards).filter(([, c]) => validCard(c)))
    : {};
  return structuredClone({
    cards,
    done: strings(v.done) ? v.done : [],
    minutes: Number.isFinite(v.minutes) ? v.minutes : 0,
    days: strings(v.days) ? v.days : [],
  }) as Progress;
}

export async function openStore(name = "tutor"): Promise<Store> {
  const db: IDBPDatabase = await openDB(name, 1, {
    upgrade(d) {
      d.createObjectStore("kv");
    },
  });
  // Android Chrome may clear site data when space runs low, unless asked to keep it
  void navigator.storage?.persist?.().catch(() => false);
  // Checked on load too: a value of the wrong shape (an old version, a bad import) loads as
  // the default instead of crashing the app on every start.
  const get = async <T>(key: string, fallback: T): Promise<T> => {
    const value = await db.get("kv", key);
    if (value === undefined) return structuredClone(fallback);
    if (key.startsWith("progress:")) return repairProgress(value) as T;
    if (key.startsWith("stories:")) return repairStories(value) as T;
    if (!VALID[key.split(":")[0]](value)) {
      console.warn(`ignoring stored ${key}: not in the expected shape`);
      return structuredClone(fallback);
    }
    return structuredClone(value);
  };
  const put = (key: string, value: unknown) => db.put("kv", structuredClone(value), key);
  return {
    progress: (lang) => get(`progress:${lang}`, EMPTY),
    saveProgress: async (lang, p) => void (await put(`progress:${lang}`, p)),
    settings: (lang) => get(`settings:${lang}`, DEFAULT_SETTINGS),
    saveSettings: async (lang, s) => void (await put(`settings:${lang}`, s)),
    stories: (lang) => get(`stories:${lang}`, [] as Story[]),
    saveStories: async (lang, s) => void (await put(`stories:${lang}`, s)),
    async exportAll() {
      const data: Record<string, unknown> = {};
      for (const key of await db.getAllKeys("kv")) data[String(key)] = await db.get("kv", key);
      return JSON.stringify({ format: FORMAT, data });
    },
    async importAll(json) {
      let parsed: any;
      try {
        parsed = JSON.parse(json);
      } catch {
        throw new Error(NOT_OURS);
      }
      if (parsed?.format !== FORMAT || !parsed.data || typeof parsed.data !== "object")
        throw new Error(NOT_OURS);
      const entries = Object.entries(parsed.data).filter(([key]) => KEY.test(key));
      for (const [key, value] of entries)
        if (!VALID[key.split(":")[0]](value)) throw new Error(NOT_OURS);
      const tx = db.transaction("kv", "readwrite"); // only after every value passed
      for (const [key, value] of entries) await tx.store.put(value, key);
      await tx.done;
    },
  };
}

export const SAVE_FAILED =
  "This session could not be saved on this device (its storage may be full). Keep this tab open and free some space: finishing the next story saves this one too.";

/** "" once saved, else what to tell the learner: a full device must not lose a session silently. */
export async function trySave(save: () => Promise<void>): Promise<string> {
  try {
    await save();
    return "";
  } catch (e) {
    console.warn("progress not saved:", e);
    return SAVE_FAILED;
  }
}

/** The learner's calendar date, YYYY-MM-DD: what "a day" means for a streak. */
export function localDay(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Days in a row with activity, ending today or yesterday. */
export function streak(days: string[], today: string): number {
  const set = new Set(days);
  const d = new Date(`${today}T12:00:00Z`);
  if (!set.has(today)) d.setUTCDate(d.getUTCDate() - 1);
  let n = 0;
  while (set.has(d.toISOString().slice(0, 10))) {
    n++;
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return n;
}
