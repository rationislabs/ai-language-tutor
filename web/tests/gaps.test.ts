import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import Gaps from "../src/components/Gaps.svelte";
import type { GapItem } from "../src/lib/session";

const ITEMS: GapItem[] = [
  { lemma: "macska", text: "A macska ül.", blank: "macska", audio: null, choices: ["macska", "kutya"] },
  { lemma: "ő", text: "Ő ül.", blank: "Ő", audio: null, choices: ["ő", "ül"] },
];

describe("Gaps", () => {
  it("typing: right, then almost, then reports the outcomes", async () => {
    const onDone = vi.fn();
    render(Gaps, { items: ITEMS, lang: "hu", mode: "type", speed: 1, onDone });
    expect(screen.getByText("A ____ ül.")).toBeTruthy();
    await fireEvent.input(screen.getByLabelText("Missing word"), { target: { value: "macska" } });
    await fireEvent.click(screen.getByText("Check"));
    expect(screen.getByText("Right!")).toBeTruthy();
    await fireEvent.click(screen.getByText("Next"));
    await fireEvent.input(screen.getByLabelText("Missing word"), { target: { value: "o" } });
    await fireEvent.click(screen.getByText("Check"));
    expect(screen.getByText(/Almost/)).toBeTruthy();
    await fireEvent.click(screen.getByText("Finish"));
    expect(onDone).toHaveBeenCalledWith([
      { lemma: "macska", outcome: "right" },
      { lemma: "ő", outcome: "almost" },
    ]);
  });

  it("choosing: a right choice counts as chosen", async () => {
    const onDone = vi.fn();
    render(Gaps, { items: ITEMS.slice(0, 1), lang: "hu", mode: "choose", speed: 1, onDone });
    await fireEvent.click(screen.getByText("macska"));
    await fireEvent.click(screen.getByText("Finish"));
    expect(onDone).toHaveBeenCalledWith([{ lemma: "macska", outcome: "chosen" }]);
  });
});

describe("Gaps focus", () => {
  it("moves to Next after checking, back to the answer box after Next; only the verdict is announced", async () => {
    render(Gaps, { items: ITEMS, lang: "hu", mode: "type", speed: 1, onDone: vi.fn() });
    await fireEvent.input(screen.getByLabelText("Missing word"), { target: { value: "macska" } });
    await fireEvent.click(screen.getByText("Check"));
    await vi.waitFor(() => expect(document.activeElement).toBe(screen.getByText("Next")));
    expect(screen.getByText("Right!").closest("[aria-live]")).toBeTruthy();
    expect(screen.getByText("Gap 1 of 2").closest("[aria-live]")).toBeNull();
    await fireEvent.click(screen.getByText("Next"));
    await vi.waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText("Missing word")));
  });
});

describe("Gaps blanks", () => {
  it("blanks the word, not a letter inside another word", () => {
    const item = { lemma: "a", text: "A macska alszik a kanapén.", blank: "a", audio: null, choices: ["a", "az"] };
    render(Gaps, { items: [item], lang: "hu", mode: "type", speed: 1, onDone: vi.fn() });
    expect(screen.getByText("A macska alszik ____ kanapén.")).toBeTruthy();
  });
});
