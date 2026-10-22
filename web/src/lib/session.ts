/** One round of gap exercises: the story's new words plus the words due for review. */
import { choices, shuffle } from "./answer";
import { isDue, type Card } from "./srs";
import { lemmaOf, tokens } from "./text";
import type { Content, Story } from "./types";

export interface GapItem {
  lemma: string;
  text: string;
  blank: string;
  audio: string | null;
  credit?: string;
  choices: string[];
}

export const MIN_ITEMS = 8;
export const MAX_ITEMS = 12;

/** Sentences that can test a word: Tatoeba gaps, then sentences of stories already read. */
function candidates(content: Content, read: Story[], lemma: string) {
  const out: { text: string; blank: string; audio: string | null; credit?: string }[] = [];
  for (const g of content.gaps)
    if (g.lemma === lemma) {
      const credit = [
        g.author && `Sentence #${g.sentence_id} by ${g.author} (Tatoeba, CC BY 2.0 FR)`,
        g.recording && `recording by ${g.recording}`,
      ]
        .filter(Boolean)
        .join(" · ");
      out.push({ text: g.text, blank: g.blank, audio: g.audio, ...(credit ? { credit } : {}) });
    }
  for (const story of read)
    for (const s of story.sentences) {
      const form = tokens(s.text).find((t) => lemmaOf(t, content.forms) === lemma);
      if (form) out.push({ text: s.text, blank: form, audio: s.audio });
    }
  return out;
}

export function buildGaps(
  content: Content,
  story: Story,
  stories: Story[],
  cards: Record<string, Card>,
  now: Date,
  rng: () => number = Math.random,
): GapItem[] {
  const at = stories.findIndex((s) => s.id === story.id);
  const read = at >= 0 ? stories.slice(0, at + 1) : [story];
  const due = Object.entries(cards)
    .filter(([lemma, card]) => isDue(card, now) && !story.new_words.includes(lemma))
    .map(([lemma]) => lemma);
  const targets = [...story.new_words, ...shuffle(due, rng)].slice(0, MAX_ITEMS);
  const pool = Object.keys(content.forms);
  const pools = targets.map((lemma) => shuffle(candidates(content, read, lemma), rng));
  const depth = Math.max(0, ...pools.map((p) => p.length));
  const items: GapItem[] = [];
  // one sentence per word first, then further sentences until the round is long enough
  for (let round = 0; round < depth && (round === 0 || items.length < MIN_ITEMS); round++)
    pools.forEach((cands, i) => {
      const c = cands[round];
      if (c && items.length < MAX_ITEMS && (round === 0 || items.length < MIN_ITEMS))
        items.push({ lemma: targets[i], ...c, choices: choices(c.blank, pool, rng) });
    });
  return items;
}

/** The open story and the next ones, whose audio is fetched ahead for offline listening. */
export function upcoming(stories: Story[], id: string, ahead = 2): Story[] {
  const at = stories.findIndex((s) => s.id === id);
  return at < 0 ? [] : stories.slice(at, at + 1 + ahead);
}

/** Recordings to fetch ahead while online: the next stories' sentences and their gap
 * round's sentences. Audio a player streams is fetched in ranges and never cached. */
export function audioAhead(content: Content, stories: Story[], id: string): string[] {
  const next = upcoming(stories, id);
  const ids = new Set(next.map((s) => s.id));
  const paths = [
    ...next.flatMap((s) => s.sentences.map((x) => x.audio)),
    ...content.gaps.filter((g) => ids.has(g.story)).map((g) => g.audio),
  ];
  return paths.filter((p): p is string => !!p);
}

export function doneSummary(newWords: string[], minutes: number, streakDays: number): string {
  const m = Math.max(1, Math.round(minutes));
  return `Done: ${newWords.length} new words · ${m} minute${m === 1 ? "" : "s"} · ${streakDays}-day streak`;
}
