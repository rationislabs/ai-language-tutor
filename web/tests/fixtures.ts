import type { Content } from "../src/lib/types";

export const HU: Content = {
  lang: "hu",
  baseline_rank: 0,
  stories: [
    {
      id: "001-cat",
      level: "A1",
      title: "A macska",
      names: ["Anna"],
      new_words: ["macska", "ül"],
      sentences: [
        { text: "A macska ül.", picture: "🐈", help: { en: "The cat sits.", de: "Die Katze sitzt." }, audio: "hu/a.mp3" },
        { text: "Anna a macskát nézi.", picture: "👀", help: { en: "Anna looks at the cat.", de: "Anna sieht die Katze an." }, audio: "hu/b.mp3" },
      ],
    },
  ],
  words: {
    a: { lemma: "a", en: "the", de: "der/die/das", rank: 1 },
    macska: { lemma: "macska", en: "cat", de: "Katze", rank: 900 },
    ül: { lemma: "ül", en: "sit", de: "sitzen", rank: 700 },
    néz: { lemma: "néz", en: "look", de: "schauen", rank: 300 },
    kutya: { lemma: "kutya", en: "dog", de: "Hund", rank: 800 },
  },
  forms: { a: "a", macska: "macska", macskát: "macska", ül: "ül", nézi: "néz", kutya: "kutya" },
  gaps: [
    { lemma: "macska", story: "001-cat", text: "A macska alszik.", blank: "macska", audio: "hu/g1.mp3", sentence_id: "1", author: "x" },
    { lemma: "ül", story: "001-cat", text: "A kutya ül.", blank: "ül", audio: "hu/g2.mp3" },
  ],
  credits: [],
};
