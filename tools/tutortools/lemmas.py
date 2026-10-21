"""Words in a sentence and their dictionary forms (lemmas). Hungarian piles endings onto a
word (asztal → asztalon), so the vocabulary rule must count lemmas, not word forms."""

from __future__ import annotations

import re

import simplemma

# Letters, inner hyphens; French/Italian elisions (l', d', dell', un') split off as their own word.
# German 's (geht's) is the word es; aujourd'hui stays whole.
# ponytail: other inner apostrophes (presqu'île) still split; add them here when a story needs one.
_WORD = re.compile(r"[Aa]ujourd'hui|'s(?![^\W\d_])|[^\W\d_]+(?:-[^\W\d_]+)*(?:'(?!s(?![^\W\d_])))?")


def tokens(text: str) -> list[str]:
    """Word forms in reading order; numbers and punctuation are dropped."""
    out = []
    for m in _WORD.finditer(text.replace("’", "'")):
        out.append(m.group(0))
    return out


def lemma(form: str, lang: str, overrides: dict[str, str] | None = None) -> str:
    """The dictionary form, lower-cased for comparison. Per-story overrides fix simplemma's
    mistakes (mostly Hungarian)."""
    key = form.lower()
    if key == "'s":
        return "es"
    if overrides and key in {k.lower() for k in overrides}:
        return {k.lower(): v for k, v in overrides.items()}[key].lower()
    # German capitals mark nouns: lower-cased, Haus/Bett read as the verbs hausen/beten.
    # ponytail: a capitalised verb at a sentence start (Hast du …) needs a story override.
    word = form if lang == "de" else key
    return simplemma.lemmatize(word, lang=lang).lower()  # keeps elisions whole: l' → le
