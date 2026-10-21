import { describe, expect, it } from "vitest";
import { blankOut, segments, tokens } from "../src/lib/text";

describe("blankOut", () => {
  it("blanks the whole word, not the first matching letters", () => {
    expect(blankOut("A macska alszik a kanapén.", "a")).toBe("A macska alszik ____ kanapén.");
    expect(blankOut("Das Haus ist alt.", "Haus")).toBe("Das ____ ist alt.");
  });
  it("leaves the text alone when the word is missing", () => {
    expect(blankOut("Szia!", "macska")).toBe("Szia!");
  });
});

describe("segments", () => {
  it("keeps punctuation, spaces and numbers between the words", () => {
    const parts = segments("Hány óra van? 3 óra, l'école!");
    expect(parts.map((p) => p.text).join("")).toBe("Hány óra van? 3 óra, l'école!");
    expect(parts.filter((p) => p.word).map((p) => p.text)).toEqual(["Hány", "óra", "van", "óra", "l'", "école"]);
  });
});

describe("tokens", () => {
  it("splits like the content tools: aujourd'hui whole, geht's as geht + 's", () => {
    expect(tokens("Aujourd'hui, ça va ? Wie geht’s dir?")).toEqual(["Aujourd'hui", "ça", "va", "Wie", "geht", "'s", "dir"]);
    expect(tokens("Il s'appelle Marc.")).toEqual(["Il", "s'", "appelle", "Marc"]);
  });
});
