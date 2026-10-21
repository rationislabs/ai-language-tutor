import { describe, expect, it, vi } from "vitest";
import { AiError, complete, generateStory, parseStory, storyPrompt, type AiSettings, type StoryRequest } from "../src/lib/ai";
import { HU } from "./fixtures";

const Q: StoryRequest = { lang: "hu", level: "A1", help: "de", known: ["a", "macska", "ül", "néz"], fresh: ["kutya"] };
const GOOD = JSON.stringify({
  title: "A kutya",
  sentences: [
    { text: "A kutya ül.", picture: "🐕", help: "Der Hund sitzt." },
    { text: "A macska nézi a kutyát.", picture: "👀", help: "Die Katze sieht den Hund an." },
    { text: "A kutya nézi a macskát.", picture: "👀", help: "…" },
    { text: "A macska ül.", picture: "🐈", help: "…" },
  ],
  new_words: ["kutya"],
});
// a fresh Response per call: a body can only be read once
const reply = (status: number, body: unknown) =>
  vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify(body), { status }));
const sent = (f: ReturnType<typeof reply>) => ({
  url: String(f.mock.calls[0][0]),
  headers: (f.mock.calls[0][1]?.headers ?? {}) as Record<string, string>,
});

const S: Record<string, AiSettings> = {
  openai: { provider: "openai", baseUrl: "https://api.example.com/v1/", model: "m", key: "sk-secret" },
  anthropic: { provider: "anthropic", baseUrl: "", model: "m", key: "sk-secret" },
  gemini: { provider: "gemini", baseUrl: "", model: "gemini-x", key: "sk-secret" },
};

describe("complete", () => {
  it("openai-compatible", async () => {
    const f = reply(200, { choices: [{ message: { content: "hi" } }] });
    expect(await complete(S.openai, "p", f)).toBe("hi");
    expect(sent(f).url).toBe("https://api.example.com/v1/chat/completions");
    expect(sent(f).headers.authorization).toBe("Bearer sk-secret");
  });
  it("anthropic sends the browser-access header", async () => {
    const f = reply(200, { content: [{ text: "hi" }] });
    expect(await complete(S.anthropic, "p", f)).toBe("hi");
    expect(sent(f).headers["anthropic-dangerous-direct-browser-access"]).toBe("true");
  });
  it("gemini native", async () => {
    const f = reply(200, { candidates: [{ content: { parts: [{ text: "hi" }] } }] });
    expect(await complete(S.gemini, "p", f)).toBe("hi");
    expect(sent(f).url).toContain("/models/gemini-x:generateContent");
    expect(sent(f).headers["x-goog-api-key"]).toBe("sk-secret");
  });
  it.each([
    [401, "auth"],
    [403, "auth"],
    [429, "rate"],
    [500, "bad"],
  ])("HTTP %i is %s, and the key is never in the message", async (status, kind) => {
    const err = await complete(S.openai, "p", reply(status, {})).catch((e) => e);
    expect(err).toBeInstanceOf(AiError);
    expect(err.kind).toBe(kind);
    expect(err.message).not.toContain("sk-secret");
  });
  it("network failure and empty answers", async () => {
    const down = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    expect((await complete(S.openai, "p", down).catch((e) => e)).kind).toBe("network");
    expect((await complete(S.openai, "p", reply(200, { choices: [] })).catch((e) => e)).kind).toBe("bad");
  });
});

describe("stories", () => {
  it("the prompt names the language, words and help language", () => {
    const p = storyPrompt(Q);
    expect(p).toContain("Hungarian");
    expect(p).toContain("a, macska, ül, néz");
    expect(p).toContain("kutya");
    expect(p).toContain("German explanation");
  });
  it("parses fenced JSON and counts unknown words by stem", () => {
    const c = parseStory("```json\n" + GOOD + "\n```", Q, HU, "ai-1");
    expect(c.story.sentences[0]).toMatchObject({ text: "A kutya ül.", help: { en: "", de: "Der Hund sitzt." }, audio: null });
    expect(c.story.generated).toBe(true);
    expect(c.unknown).toEqual([]);
  });
  it("too many unknown words: one retry, then the story with a note", async () => {
    const bad = JSON.stringify({ title: "x", sentences: Array(4).fill({ text: "Zebra zsiráf oroszlán ül.", picture: "🦓", help: "…" }) });
    const f = reply(200, { choices: [{ message: { content: bad } }] });
    const r = await generateStory(S.openai, Q, HU, "ai-2", f);
    expect(f).toHaveBeenCalledTimes(2);
    expect(r.note).toBe("Uses 3 words above your level.");
  });
  it("a good story on the first try has no note", async () => {
    const r = await generateStory(S.openai, Q, HU, "ai-3", reply(200, { choices: [{ message: { content: GOOD } }] }));
    expect(r.note).toBeUndefined();
  });
  it("finds the JSON inside prose", () => {
    const c = parseStory("Here is your story:\n" + GOOD + "\nEnjoy!", Q, HU, "ai-4");
    expect(c.story.title).toBe("A kutya");
  });
  it("unusable JSON is a bad answer", () => {
    expect(() => parseStory("no json", Q, HU, "x")).toThrow(AiError);
    expect(() => parseStory('{"title":"t","sentences":[]}', Q, HU, "x")).toThrow(AiError);
  });
});
