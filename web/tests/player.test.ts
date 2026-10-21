import { fireEvent, render, screen } from "@testing-library/svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import StoryPlayer from "../src/components/StoryPlayer.svelte";
import { play } from "../src/lib/audio";
import type { Story } from "../src/lib/types";
import { HU } from "./fixtures";

vi.mock("../src/lib/audio", () => ({ play: vi.fn(async () => {}), prefetch: vi.fn() }));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.mocked(play).mockClear();
});

const AI_STORY: Story = { ...HU.stories[0], id: "ai-1", sentences: HU.stories[0].sentences.map((s) => ({ ...s, audio: null })) };
const NOTE = /no Hungarian voice/;

function voices(list: { lang: string }[]) {
  const synth = Object.assign(new EventTarget(), { getVoices: () => list, speak: vi.fn(), cancel: vi.fn() });
  vi.stubGlobal("speechSynthesis", synth);
  return synth;
}

function show(story = AI_STORY) {
  render(StoryPlayer, { story, content: HU, help: "en", mode: "type", speed: 1, makeGaps: () => [], onDone: vi.fn(), onBack: vi.fn() });
}

describe("StoryPlayer device voice", () => {
  it("a story without audio files says when the device has no voice for the language", () => {
    voices([{ lang: "en-US" }]);
    show();
    expect(screen.getByText(NOTE)).toBeTruthy();
  });

  it("the note goes once the browser has loaded its voices", async () => {
    const list: { lang: string }[] = [];
    const synth = voices(list);
    show();
    expect(screen.getByText(NOTE)).toBeTruthy();
    list.push({ lang: "hu-HU" }); // Chrome lists its voices only after voiceschanged
    synth.dispatchEvent(new Event("voiceschanged"));
    await vi.waitFor(() => expect(screen.queryByText(NOTE)).toBeNull());
  });

  it("stories with audio files never show it", () => {
    voices([]);
    show(HU.stories[0]);
    expect(screen.queryByText(NOTE)).toBeNull();
  });
});

describe("StoryPlayer play all", () => {
  it("plays every sentence in turn and moves along with them", async () => {
    show(HU.stories[0]);
    await fireEvent.click(screen.getByText("▶ Play all"));
    await vi.waitFor(() => expect(screen.getByText(/2\/2/)).toBeTruthy());
    expect(vi.mocked(play).mock.calls.map((c) => c[0])).toEqual(["hu/a.mp3", "hu/b.mp3"]);
  });
});
