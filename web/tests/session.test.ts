import { describe, expect, it } from "vitest";
import { audioAhead, buildGaps, doneSummary, MAX_ITEMS, MIN_ITEMS, upcoming } from "../src/lib/session";
import { newCard, review } from "../src/lib/srs";
import { HU } from "./fixtures";

const NOW = new Date("2026-10-09T10:00:00Z");
const rng = () => 0.42;

describe("buildGaps", () => {
  it("covers each new word, from Tatoeba gaps and story sentences", () => {
    const items = buildGaps(HU, HU.stories[0], HU.stories, {}, NOW, rng);
    expect(new Set(items.map((i) => i.lemma))).toEqual(new Set(["macska", "ül"]));
    for (const i of items) {
      expect(i.text).toContain(i.blank);
      expect(i.choices).toContain(i.blank.toLowerCase());
    }
    const blanks = items.filter((i) => i.lemma === "macska").map((i) => i.blank);
    expect(blanks).toContain("macskát"); // from the story sentence "Anna a macskát nézi."
  });
  it("adds due words but not words reviewed recently", () => {
    const later = new Date("2026-10-20T10:00:00Z");
    const cards = { kutya: newCard(NOW), néz: review(newCard(NOW), "right", later) };
    const items = buildGaps({ ...HU, gaps: [...HU.gaps, { lemma: "kutya", story: "x", text: "A kutya ül.", blank: "kutya", audio: null }] }, HU.stories[0], HU.stories, cards, later, rng);
    expect(items.map((i) => i.lemma)).toContain("kutya");
    expect(items.map((i) => i.lemma)).not.toContain("néz");
  });
  it("never more than MAX_ITEMS", () => {
    const many = Array.from({ length: 30 }, (_, n) => ({ lemma: "macska", story: "x", text: `A macska ${n}.`, blank: "macska", audio: null }));
    expect(buildGaps({ ...HU, gaps: many }, HU.stories[0], HU.stories, {}, NOW, rng).length).toBeLessThanOrEqual(MAX_ITEMS);
  });
});

describe("gap sources and length", () => {
  const later = { ...HU.stories[0], id: "002-later", new_words: ["kutya"], sentences: [
    { text: "A macska és a kutya ül.", picture: "🐕", help: { en: "", de: "" }, audio: null },
  ] };
  it("never uses sentences from stories the learner has not read yet", () => {
    const items = buildGaps({ ...HU, gaps: [] }, HU.stories[0], [HU.stories[0], later], {}, NOW, rng);
    expect(items.every((i) => i.text !== "A macska és a kutya ül.")).toBe(true);
  });
  it("fills the round from more sentences when a story has few new words", () => {
    const many = Array.from({ length: 10 }, (_, n) => ({ lemma: "macska", story: "x", text: `A macska ${n} ül.`, blank: "macska", audio: null }));
    const items = buildGaps({ ...HU, gaps: many }, { ...HU.stories[0], new_words: ["macska"] }, HU.stories, {}, NOW, rng);
    expect(items.length).toBe(MIN_ITEMS);
  });
  it("credits the Tatoeba author and recording", () => {
    const g = [{ lemma: "macska", story: "x", text: "Ott a macska.", blank: "macska", audio: "hu/x.mp3", sentence_id: "7", author: "pirgelman", recording: "anna, CC BY 4.0" }];
    const items = buildGaps({ ...HU, gaps: g }, { ...HU.stories[0], new_words: ["macska"] }, [], {}, NOW, rng);
    expect(items.find((i) => i.text === "Ott a macska.")?.credit).toBe("Sentence #7 by pirgelman (Tatoeba, CC BY 2.0 FR) · recording by anna, CC BY 4.0");
  });
});

describe("upcoming and summary", () => {
  it("the open story and the next two", () => {
    const s = (id: string) => ({ ...HU.stories[0], id });
    expect(upcoming([s("a"), s("b"), s("c"), s("d")], "b").map((x) => x.id)).toEqual(["b", "c", "d"]);
    expect(upcoming([s("a")], "a").map((x) => x.id)).toEqual(["a"]);
  });
  it("the done summary", () => {
    expect(doneSummary(["macska", "ül"], 3.4, 5)).toBe("Done: 2 new words · 3 minutes · 5-day streak");
    expect(doneSummary([], 0.2, 1)).toBe("Done: 0 new words · 1 minute · 1-day streak");
  });
});

describe("offline audio", () => {
  it("the gap round's recordings are fetched with the stories they belong to", () => {
    const paths = audioAhead(HU, HU.stories, HU.stories[0].id);
    expect(paths).toContain("hu/g1.mp3");
    expect(paths).toContain("hu/g2.mp3");
  });
});
