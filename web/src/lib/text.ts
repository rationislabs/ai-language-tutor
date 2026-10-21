/** Words in a sentence, the same way tools/tutortools/lemmas.py splits them. */
const WORD = /[Aa]ujourd'hui|'s(?!\p{L})|\p{L}+(?:-\p{L}+)*(?:'(?!s(?!\p{L})))?/gu;

export function tokens(text: string): string[] {
  return text.replaceAll("’", "'").match(WORD) ?? [];
}

/** The dictionary form of a word as written, from the content's form table. */
export function lemmaOf(form: string, forms: Record<string, string>): string | undefined {
  return forms[form.toLowerCase()];
}

/** Lower-case and without accents (Hungarian stems lengthen their last vowel: kutya → kutyát). */
export function fold(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replaceAll("ß", "ss");
}

/** The sentence with its gap: the blank word replaced as a whole word, never inside another
 * (blank "a" must not hit the "a" in "macska"). An elided blank (l', dell') may touch the next word. */
export function blankOut(text: string, blank: string): string {
  const esc = blank.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const after = blank.endsWith("'") ? "" : "(?![\\p{L}])";
  return text.replace(new RegExp(`(?<![\\p{L}])${esc}${after}`, "u"), "____");
}

/** The sentence as words and the text between them (spaces, punctuation, numbers), in order. */
export function segments(text: string): { text: string; word: boolean }[] {
  const out: { text: string; word: boolean }[] = [];
  let last = 0;
  for (const m of text.replaceAll("’", "'").matchAll(WORD)) {
    const start = m.index ?? 0;
    if (start > last) out.push({ text: text.slice(last, start), word: false });
    out.push({ text: text.slice(start, start + m[0].length), word: true });
    last = start + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last), word: false });
  return out;
}
