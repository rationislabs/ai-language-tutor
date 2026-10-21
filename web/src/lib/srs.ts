/** Spaced repetition per word with FSRS (ts-fsrs). */
import { createEmptyCard, fsrs, Rating, type Card, type Grade } from "ts-fsrs";

export type Outcome = "right" | "almost" | "wrong" | "chosen";
export type { Card };

const scheduler = fsrs();
const GRADE: Record<Outcome, Grade> = {
  right: Rating.Good,
  chosen: Rating.Good,
  almost: Rating.Hard,
  wrong: Rating.Again,
};

export function newCard(now: Date): Card {
  return createEmptyCard(now);
}

export function review(card: Card, outcome: Outcome, now: Date): Card {
  return scheduler.next(card, now, GRADE[outcome]).card;
}

export function isDue(card: Card, now: Date): boolean {
  return new Date(card.due).getTime() <= now.getTime();
}
