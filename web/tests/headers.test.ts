import { describe, expect, it } from "vitest";
import { AUDIO_CACHE } from "../pwa.config";
import headers from "../public/_headers?raw";

const csp = headers.match(/Content-Security-Policy: (.*)/)![1];
const directive = (name: string) => csp.split(";").map((d: string) => d.trim()).find((d: string) => d.startsWith(name + " "))!;

describe("site headers", () => {
  it("lets the AI settings reach a local OpenAI-compatible server, and only that over http", () => {
    // Ollama or LM Studio at http://localhost:11434/v1; any other address must be https.
    const sources = directive("connect-src").split(" ").slice(1);
    expect(sources).toContain("http://localhost:*");
    expect(sources).toContain("http://127.0.0.1:*");
    expect(sources.filter((s: string) => s.startsWith("http:"))).toEqual(["http://localhost:*", "http://127.0.0.1:*"]);
  });
});

describe("audio cache", () => {
  it("keeps recordings by count, not by age", () => {
    // Workbox counts maxAgeSeconds from the download, not the last use: every recording of a
    // learner offline for three months would fall back to the device voice.
    expect(AUDIO_CACHE.expiration).toEqual({ maxEntries: 2000 });
  });
});
