/** Progress, settings and AI stories on the device (IndexedDB). The AI key is never stored
 * here and never exported: see keys.ts. */
import { openDB, type IDBPDatabase } from "idb";
import type { Card } from "./srs";
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
const VALID: Record<string, (v: any) => boolean> = {
  progress: (v) =>
    isObj(v) &&
    isObj(v.cards) &&
    Array.isArray(v.done) &&
    v.done.every((x: unknown) => typeof x === "string") &&
    typeof v.minutes === "number" &&
    Array.isArray(v.days),
  settings: (v) =>
    isObj(v) && ["en", "de"].includes(v.help as string) && ["type", "choose"].includes(v.mode as string) && [0.75, 1].includes(v.speed as number),
  stories: (v) => Array.isArray(v),
};

export async function openStore(name = "tutor"): Promise<Store> {
  const db: IDBPDatabase = await openDB(name, 1, {
    upgrade(d) {
      d.createObjectStore("kv");
    },
  });
  // Android Chrome may clear site data when space runs low, unless asked to keep it
  void navigator.storage?.persist?.().catch(() => false);
  const get = async <T>(key: string, fallback: T): Promise<T> =>
    structuredClone((await db.get("kv", key)) ?? fallback);
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
