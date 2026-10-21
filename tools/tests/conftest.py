from pathlib import Path

import pytest
import yaml

LANGS_YAML = {
    "de": {"baseline_rank": 0, "starter_new": 20, "max_new": 6},
    "hu": {"baseline_rank": 0, "starter_new": 20, "max_new": 6},
    "fr": {"baseline_rank": 0, "starter_new": 20, "max_new": 6},
    "it": {"baseline_rank": 0, "starter_new": 20, "max_new": 6},
}


def sentence(text, picture="🙂", speaker=0):
    return {
        "text": text,
        "picture": picture,
        "help": {"en": f"EN: {text}", "de": f"DE: {text}"},
        "speaker": speaker,
    }


def write_story(content: Path, lang: str, name: str, texts, new_words, **extra):
    d = content / "stories" / lang
    d.mkdir(parents=True, exist_ok=True)
    data = {
        "lang": lang,
        "level": "A1",
        "title": name,
        "sentences": [sentence(t) for t in texts],
        "new_words": new_words,
        **extra,
    }
    (d / f"{name}.yaml").write_text(yaml.safe_dump(data, allow_unicode=True))


def write_words(content: Path, lang: str, words: dict):
    (content / "words").mkdir(parents=True, exist_ok=True)
    (content / "words" / f"{lang}.yaml").write_text(yaml.safe_dump(words, allow_unicode=True))


@pytest.fixture
def content(tmp_path) -> Path:
    c = tmp_path / "content"
    c.mkdir()
    (c / "languages.yaml").write_text(yaml.safe_dump(LANGS_YAML))
    return c


def gloss(*lemmas, rank=None):
    return {lem: {"en": f"en-{lem}", "de": f"de-{lem}", "rank": rank} for lem in lemmas}
