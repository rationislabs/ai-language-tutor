"""The content model: languages, stories and word lists, loaded from content/ and checked
for shape. Vocabulary rules live in vocab.py."""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path

import yaml

LANGS = ("de", "hu", "fr", "it")
HELP_LANGS = ("en", "de")
LEVELS = ("A1", "A2", "B1", "B2")
MIN_SENTENCES, MAX_SENTENCES = 6, 12


class ContentError(ValueError):
    """A content file is malformed; the message names the file and the field."""


@dataclass(frozen=True)
class Sentence:
    text: str
    picture: str
    help: dict[str, str]
    speaker: int = 0


@dataclass(frozen=True)
class Story:
    id: str
    lang: str
    level: str
    title: str
    sentences: tuple[Sentence, ...]
    new_words: tuple[str, ...]
    names: tuple[str, ...] = ()
    lemma_overrides: dict[str, str] = field(default_factory=dict)


@dataclass(frozen=True)
class Word:
    lemma: str
    en: str
    de: str
    rank: int | None = None  # frequency rank (1 = most common); None = not in the list


@dataclass(frozen=True)
class LangConfig:
    baseline_rank: int  # lemmas up to this rank count as already known (0 = start from zero)
    starter_new: int  # new words allowed in the first story
    max_new: int  # new words allowed in every later story


def _need(data: dict, key: str, where: str):
    if key not in data or data[key] in (None, ""):
        raise ContentError(f"{where}: missing {key!r}")
    return data[key]


def load_story(path: Path) -> Story:
    where = str(path)
    data = yaml.safe_load(path.read_text()) or {}
    lang = _need(data, "lang", where)
    if lang not in LANGS or path.parent.name != lang:
        raise ContentError(f"{where}: lang {lang!r} must be one of {LANGS} and match its folder")
    level = _need(data, "level", where)
    if level not in LEVELS:
        raise ContentError(f"{where}: level {level!r} must be one of {LEVELS}")
    raw = _need(data, "sentences", where)
    if not MIN_SENTENCES <= len(raw) <= MAX_SENTENCES:
        raise ContentError(f"{where}: {len(raw)} sentences, need {MIN_SENTENCES}-{MAX_SENTENCES}")
    sentences = []
    for i, s in enumerate(raw, 1):
        at = f"{where} sentence {i}"
        help_ = _need(s, "help", at)
        for h in HELP_LANGS:
            _need(help_, h, f"{at} help")
        sentences.append(
            Sentence(
                text=_need(s, "text", at),
                picture=_need(s, "picture", at),
                help={h: help_[h] for h in HELP_LANGS},
                speaker=int(s.get("speaker", 0)),
            )
        )
    return Story(
        id=path.stem,
        lang=lang,
        level=level,
        title=_need(data, "title", where),
        sentences=tuple(sentences),
        new_words=tuple(_need(data, "new_words", where)),
        names=tuple(data.get("names") or ()),
        lemma_overrides=dict(data.get("lemma_overrides") or {}),
    )


def load_stories(content: Path, lang: str) -> list[Story]:
    """A language's stories in file-name order (001-…, 002-…): the order learners meet them."""
    return [load_story(p) for p in sorted((content / "stories" / lang).glob("*.yaml"))]


def load_words(content: Path, lang: str) -> dict[str, Word]:
    path = content / "words" / f"{lang}.yaml"
    if not path.exists():
        return {}
    out = {}
    for lemma, w in (yaml.safe_load(path.read_text()) or {}).items():
        where = f"{path}: {lemma}"
        out[str(lemma).lower()] = Word(
            lemma=str(lemma),
            en=_need(w, "en", where),
            de=_need(w, "de", where),
            rank=w.get("rank"),
        )
    return out


def load_config(content: Path) -> dict[str, LangConfig]:
    data = yaml.safe_load((content / "languages.yaml").read_text())
    return {lang: LangConfig(**data[lang]) for lang in LANGS if lang in data}
