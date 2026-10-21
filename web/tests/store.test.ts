import { describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS, openStore, streak } from "../src/lib/store";
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
  ])("rejects %s and keeps what was there", async (json) => {
    const s = await openStore("t-bad");
    await s.saveSettings("hu", { help: "de", mode: "type", speed: 1 });
    await expect(s.importAll(json)).rejects.toThrow("Not a progress file");
    expect((await s.settings("hu")).help).toBe("de");
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
