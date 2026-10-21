import { describe, expect, it } from "vitest";
import { isDue, newCard, review } from "../src/lib/srs";

const NOW = new Date("2026-10-09T10:00:00Z");

describe("srs", () => {
  it("a new card is due now", () => {
    expect(isDue(newCard(NOW), NOW)).toBe(true);
  });
  it("right schedules later than almost, wrong comes back soonest", () => {
    const due = (o: "right" | "almost" | "wrong") => new Date(review(newCard(NOW), o, NOW).due).getTime();
    expect(due("right")).toBeGreaterThan(due("almost"));
    expect(due("almost")).toBeGreaterThanOrEqual(due("wrong"));
    expect(isDue(review(newCard(NOW), "right", NOW), NOW)).toBe(false);
  });
  it("chosen counts like right", () => {
    expect(review(newCard(NOW), "chosen", NOW).due).toEqual(review(newCard(NOW), "right", NOW).due);
  });
});
