"""The app's content file per language: stories with audio paths, glosses, a word-form →
lemma table (tap a word, check AI stories), gap sentences and credits."""

from __future__ import annotations

from .audio import Item, voice_for
from .lemmas import lemma, tokens
from .model import Story, Word
from .tatoeba import Gap
from .vocab import shared_overrides

TATOEBA_CREDIT = "Tatoeba (tatoeba.org), sentence text CC BY 2.0 FR"


def credits(gaps: list[dict]) -> list[str]:
    """Every Tatoeba contributor whose sentence or recording is used."""
    out = {TATOEBA_CREDIT} if gaps else set()
    for g in gaps:
        if g.get("author"):
            out.add(f"Tatoeba sentences by {g['author']}, CC BY 2.0 FR")
        if g.get("recording"):
            out.add(f"Tatoeba recordings by {g['recording']}")
    return sorted(out)


def drop_recordings(content: dict, fell: dict[str, str]) -> None:
    """Gaps whose recording could not be fetched were spoken by Piper: its file, no recording
    credit."""
    for g in content["gaps"]:
        if g["audio"] in fell:
            g["audio"] = fell[g["audio"]]
            g.pop("recording", None)
    content["credits"] = credits(content["gaps"])


def sentence_item(story: Story, i: int) -> Item:
    s = story.sentences[i]
    return Item(story.lang, s.text, voice=voice_for(story.lang, s.speaker))


def gap_item(lang: str, gap: Gap) -> Item:
    if gap.audio:
        return Item(lang, gap.text, tatoeba_audio=gap.audio.audio_id)
    return Item(lang, gap.text, voice=voice_for(lang))


def build(
    lang: str,
    stories: list[Story],
    words: dict[str, Word],
    gaps: list[Gap],
    baseline_rank: int = 0,
) -> tuple[dict, list[Item]]:
    items: list[Item] = []
    forms: dict[str, str] = {}
    out_stories = []
    for story in stories:
        sentences = []
        for i, s in enumerate(story.sentences):
            item = sentence_item(story, i)
            items.append(item)
            for f in tokens(s.text):
                if f.lower() not in {n.lower() for n in story.names}:
                    forms[f.lower()] = lemma(f, lang, story.lemma_overrides)
            sentences.append(
                {
                    "text": s.text,
                    "picture": s.picture,
                    "help": s.help,
                    "audio": item.path,
                }
            )
        out_stories.append(
            {
                "id": story.id,
                "level": story.level,
                "title": story.title,
                "sentences": sentences,
                "new_words": [w.lower() for w in story.new_words],
                "names": list(story.names),
            }
        )
    out_gaps = []
    shared = shared_overrides(stories)
    for g in gaps:
        item = gap_item(lang, g)
        items.append(item)
        for f in tokens(g.text):
            forms.setdefault(f.lower(), lemma(f, lang, shared))
        entry = {
            "lemma": g.lemma,
            "story": g.story,
            "text": g.text,
            "blank": g.form,
            "audio": item.path,
            "sentence_id": g.sentence_id,
        }
        if g.author:
            entry["author"] = g.author
        if g.audio:
            entry["recording"] = f"{g.audio.user}, {g.audio.licence}"
        out_gaps.append(entry)
    content = {
        "lang": lang,
        "stories": out_stories,
        "baseline_rank": baseline_rank,
        "words": {
            k: {"lemma": w.lemma, "en": w.en, "de": w.de, "rank": w.rank}
            for k, w in sorted(words.items())
        },
        "forms": dict(sorted(forms.items())),
        "gaps": out_gaps,
        "credits": credits(out_gaps),
    }
    return content, items
