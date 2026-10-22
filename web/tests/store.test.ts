import { describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS, SAVE_FAILED, localDay, openStore, streak, trySave } from "../src/lib/store";
import { newCard } from "../src/lib/srs";

describe("store", () => {
  it("defaults, round trip, export and import", async () => {
    const a = await openStore("t1");
    expect(await a.settings("hu")).toEqual(DEFAULT_SETTINGS);
    expect((await a.progress("hu")).done).toEqual([]);
    await a.saveSettings("hu", { help: "de", mode: "choose", speed: 0.75 });
    await a.saveProgress("hu", { cards: { macska: newCard(new Date()) }, done: ["001"], minutes: 3, days: ["2026-10-09"] });
    const dump = await a.exportAll();
    expect(dump).not.toContain("tutor-ai-key");
    const b = await openStore("t2");
    await b.importAll(dump);
    expect((await b.settings("hu")).help).toBe("de");
    expect((await b.progress("hu")).done).toEqual(["001"]);
  });
  it("rejects files from elsewhere", async () => {
    const s = await openStore("t3");
    await expect(s.importAll('{"x":1}')).rejects.toThrow("Not a progress file");
  });
  it("streak counts days in a row ending today or yesterday", () => {
    expect(streak(["2026-10-07", "2026-10-08", "2026-10-09"], "2026-10-09")).toBe(3);
    expect(streak(["2026-10-07", "2026-10-08"], "2026-10-09")).toBe(2);
    expect(streak(["2026-10-01"], "2026-10-09")).toBe(0);
  });
});

describe("import validation", () => {
  it.each([
    ['{"format":"rationis-tutor-progress-1","data":null}'],
    ['{"format":"rationis-tutor-progress-1","data":{"progress:de":{}}}'],
    ['{"format":"rationis-tutor-progress-1","data":{"settings:hu":{"help":"fr","mode":"type","speed":1}}}'],
    ['{"format":"rationis-tutor-progress-1","data":{"stories:it":"nope"}}'],
    // Shapes that would crash the Library or a review on every load after an import:
    ['{"format":"rationis-tutor-progress-1","data":{"stories:de":[null]}}'],
    ['{"format":"rationis-tutor-progress-1","data":{"stories:de":[{"id":"001","title":"T","level":"A1","sentences":[],"new_words":[],"names":[]}]}}'],
    ['{"format":"rationis-tutor-progress-1","data":{"progress:de":{"cards":{"x":{"due":"x"}},"done":[],"minutes":0,"days":[]}}}'],
    ['{"format":"rationis-tutor-progress-1","data":{"progress:de":{"cards":{},"done":[],"minutes":0,"days":[1]}}}'],
    ['{"format":"rationis-tutor-progress-1","data":{"progress:de":{"cards":{"x":{"due":null,"stability":1,"difficulty":5,"elapsed_days":0,"scheduled_days":0,"learning_steps":0,"reps":1,"lapses":0,"state":2}},"done":[],"minutes":0,"days":[]}}}'],
    ['{"format":"rationis-tutor-progress-1","data":{"progress:de":{"cards":{"x":{"due":"2026-10-01T00:00:00.000Z","stability":1,"difficulty":5,"elapsed_days":0,"scheduled_days":0,"learning_steps":0,"reps":1,"lapses":0,"state":9}},"done":[],"minutes":0,"days":[]}}}'],
    ['{"format":"rationis-tutor-progress-1","data":{"progress:de":{"cards":{"x":{"due":"2026-10-01T00:00:00.000Z","stability":1,"difficulty":5,"elapsed_days":0,"scheduled_days":0,"learning_steps":0,"reps":1,"lapses":0,"state":2,"last_review":"x"}},"done":[],"minutes":0,"days":[]}}}'],
    ['{"format":"rationis-tutor-progress-1","data":{"progress:de":{"cards":{},"done":[],"minutes":1e999,"days":[]}}}'],
    ['{"format":"rationis-tutor-progress-1","data":{"stories:de":[{"id":"ai-1","title":"T","level":"A1","sentences":[{"text":"Hallo","picture":"x","help":{"en":"","de":""}}],"new_words":[],"names":[]},{"id":"ai-1","title":"T","level":"A1","sentences":[{"text":"Hallo","picture":"x","help":{"en":"","de":""}}],"new_words":[],"names":[]}]}}'],
    ['{"format":"rationis-tutor-progress-1","data":{"stories:de":[{"id":"ai-1","title":"T","level":"A1","sentences":[],"new_words":[],"names":[]}]}}'],
    ['{"format":"rationis-tutor-progress-1","data":{"stories:de":[{"id":"ai-1","title":"T","level":"A1","sentences":[{"text":"Hallo","picture":"x"}],"new_words":[],"names":[]}]}}'],
  ])("rejects %s and keeps what was there", async (json) => {
    const s = await openStore("t-bad");
    await s.saveSettings("hu", { help: "de", mode: "type", speed: 1 });
    await expect(s.importAll(json)).rejects.toThrow("Not a progress file");
    expect((await s.settings("hu")).help).toBe("de");
  });
});

describe("load validation", () => {
  it("a stored value of the wrong shape loads as the default", async () => {
    const s = await openStore("t-shape");
    await s.saveStories("de", [null as any]);
    expect(await s.stories("de")).toEqual([]);
  });
  it("progress with a missing or broken field keeps the rest, cards above all", async () => {
    const s = await openStore("t-repair");
    const card = newCard(new Date());
    await s.saveProgress("de", { cards: { ok: card, bad: { due: "x" } }, done: ["001"], minutes: 4 } as any);
    const p = await s.progress("de");
    expect(Object.keys(p.cards)).toEqual(["ok"]);
    expect([p.done, p.minutes, p.days]).toEqual([["001"], 4, []]);
  });
  it("one broken stored story is dropped, never the others", async () => {
    // generate() saves the list it loaded plus the new story: an all-or-nothing load
    // would overwrite every other generated story.
    const s = await openStore("t-one-bad");
    const story = { id: "ai-1", level: "A1", title: "T", sentences: [{ text: "Hallo", picture: "💬", help: { en: "", de: "" }, audio: null }], new_words: [], names: [], generated: true };
    await s.saveStories("de", [story, { ...story, id: "ai-2", sentences: [] } as any]);
    expect(await s.stories("de")).toEqual([story]);
  });
  it("a valid generated story still loads", async () => {
    const s = await openStore("t-ok");
    const story = { id: "ai-1", level: "A1", title: "T", sentences: [{ text: "Hallo", picture: "💬", help: { en: "", de: "" }, audio: null }], new_words: [], names: [], generated: true };
    await s.saveStories("de", [story]);
    expect(await s.stories("de")).toEqual([story]);
  });
});

describe("keeping the data", () => {
  it("asks the browser not to clear progress when space runs low", async () => {
    const persist = vi.fn(async () => true);
    vi.stubGlobal("navigator", { ...navigator, storage: { persist } });
    await openStore("t-persist");
    expect(persist).toHaveBeenCalledOnce();
    vi.unstubAllGlobals();
  });
});

describe("days", () => {
  it("a day is the learner's local date, not the UTC one", () => {
    vi.stubEnv("TZ", "America/Los_Angeles");
    try {
      // 17:30 on the 19th in California is already the 20th in UTC
      expect(localDay(new Date("2026-10-20T00:30:00Z"))).toBe("2026-10-19");
      const monday = localDay(new Date("2026-10-20T00:00:00Z")); // Mon 17:00 local
      const tuesday = localDay(new Date("2026-10-20T16:00:00Z")); // Tue 09:00 local
      expect(streak([monday, tuesday], tuesday)).toBe(2);
    } finally {
      vi.unstubAllEnvs();
    }
  });
});

describe("saving a session", () => {
  it("a full device says so instead of failing silently", async () => {
    const full = async () => {
      throw new DOMException("quota", "QuotaExceededError");
    };
    expect(await trySave(full)).toBe(SAVE_FAILED);
    expect(await trySave(async () => {})).toBe("");
  });
});
