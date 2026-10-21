import { afterEach, describe, expect, it, vi } from "vitest";
import { play, prefetch } from "../src/lib/audio";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("audio", () => {
  it("fetches audio relative to the site's base", () => {
    vi.stubEnv("BASE_URL", "/ai-language-tutor/");
    const fetch = vi.fn(async () => new Response(""));
    vi.stubGlobal("fetch", fetch);
    prefetch(["hu/abc.mp3", null]);
    expect(fetch).toHaveBeenCalledExactlyOnceWith("/ai-language-tutor/audio/hu/abc.mp3");
  });
});

describe("play", () => {
  it("finishes when the sentence has played to the end", async () => {
    const el = Object.assign(new EventTarget(), { playbackRate: 1, pause: vi.fn(), play: vi.fn(async () => {}) });
    vi.stubGlobal("Audio", vi.fn(function () { return el; }));
    let done = false;
    const p = play("hu/a.mp3", "A macska ül.", "hu", 1).then(() => (done = true));
    await new Promise((r) => setTimeout(r, 10));
    expect(done).toBe(false);
    el.dispatchEvent(new Event("ended"));
    await p;
    expect(done).toBe(true);
  });
});
