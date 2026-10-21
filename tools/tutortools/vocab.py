"""The vocabulary rule: a story uses only words the learner already knows plus a few new
ones, and repeats each new one. Stories are checked in the order learners meet them."""

from __future__ import annotations

from collections import Counter, defaultdict
from dataclasses import dataclass

from .lemmas import lemma, tokens
from .model import LangConfig, Story, Word


@dataclass(frozen=True)
class Problem:
    story: str
    message: str

    def __str__(self) -> str:
        return f"{self.story}: {self.message}"


def story_lemmas(story: Story) -> Counter:
    """How often each lemma occurs; the story's names are not vocabulary."""
    names = {n.lower() for n in story.names}
    counts: Counter = Counter()
    for s in story.sentences:
        for form in tokens(s.text):
            if form.lower() not in names:
                counts[lemma(form, story.lang, story.lemma_overrides)] += 1
    return counts


def story_forms(story: Story) -> dict[str, set[str]]:
    """lemma → the forms written in the story (an override needs the form, not the lemma)."""
    names = {n.lower() for n in story.names}
    out: dict[str, set[str]] = defaultdict(set)
    for s in story.sentences:
        for form in tokens(s.text):
            if form.lower() not in names:
                out[lemma(form, story.lang, story.lemma_overrides)].add(form.lower())
    return out


def _shown(lem: str, forms: set[str]) -> str:
    return ", ".join(f if f == lem else f"{f}→{lem}" for f in sorted(forms))


def shared_overrides(stories: list[Story]) -> dict[str, str]:
    """Story lemma_overrides that hold for a whole language: forms every story that uses them
    maps to the same lemma. Context-dependent ones (hu vagy: "or" / "you are") are left out."""
    seen: dict[str, set[str]] = {}
    for story in stories:
        for s in story.sentences:
            for form in tokens(s.text):
                key = form.lower()
                seen.setdefault(key, set()).add(lemma(form, story.lang, story.lemma_overrides))
    fixed = {f.lower() for story in stories for f in story.lemma_overrides}
    return {f: lems.pop() for f, lems in seen.items() if f in fixed and len(lems) == 1}


def baseline(words: dict[str, Word], cfg: LangConfig) -> set[str]:
    """Lemmas the learner is assumed to know before the first story."""
    return {k for k, w in words.items() if w.rank is not None and w.rank <= cfg.baseline_rank}


def check(stories: list[Story], words: dict[str, Word], cfg: LangConfig) -> list[Problem]:
    problems: list[Problem] = []
    known = baseline(words, cfg)
    for i, story in enumerate(stories):
        new = [w.lower() for w in story.new_words]
        limit = cfg.starter_new if i == 0 else cfg.max_new

        def bad(msg: str, story: Story = story) -> None:
            problems.append(Problem(story.id, msg))

        if len(new) > limit:
            bad(f"{len(new)} new words, at most {limit}")
        for w in new:
            if w in known:
                bad(f"new word {w!r} is already known")
        counts = story_lemmas(story)
        for w in new:
            if counts[w] < 2:
                bad(f"new word {w!r} occurs {counts[w]}x, needs at least 2")
        unknown = sorted(set(counts) - known - set(new))
        if unknown:
            forms = story_forms(story)
            shown = ", ".join(_shown(lem, forms[lem]) for lem in unknown)
            bad(f"unknown words (add to new_words, or rewrite): {shown}")
        missing = sorted(lem for lem in counts if lem not in words)
        if missing:
            bad(f"no gloss in words/{story.lang}.yaml: {', '.join(missing)}")
        known |= set(new)
    return problems


def known_after(stories: list[Story], words: dict[str, Word], cfg: LangConfig) -> list[set[str]]:
    """known_after(...)[i]: what the learner knows once story i is done."""
    known = baseline(words, cfg)
    out = []
    for story in stories:
        known = known | {w.lower() for w in story.new_words}
        out.append(set(known))
    return out
