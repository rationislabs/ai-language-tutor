"""Frequency ranks for the word lists, from hermitdave/FrequencyWords (OpenSubtitles 2018,
CC BY-SA 4.0). Word forms are folded into lemmas; a lemma's rank is where it first appears."""

from __future__ import annotations

from collections.abc import Iterable
from pathlib import Path

import yaml

from .lemmas import lemma
from .tatoeba import download

URL = "https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/{0}/{0}_50k.txt"


def ranks(lines: Iterable[str], lang: str) -> dict[str, int]:
    out: dict[str, int] = {}
    rank = 0
    for line in lines:
        form = line.split(" ", 1)[0].strip()
        if not form:
            continue
        lem = lemma(form, lang)
        if lem not in out:
            rank += 1
            out[lem] = rank
        if lang == "de":  # the lists are lower-case; the word may be a noun (haus → Haus)
            out.setdefault(lemma(form.capitalize(), lang), out[lem])
    return out


def fill_ranks(words_file: Path, lang: str, cache: Path) -> int:
    """Write `rank` into every entry of a words file; returns how many got one."""
    path = download(URL.format(lang), cache / f"freq_{lang}.txt")
    table = ranks(path.read_text(encoding="utf-8").splitlines(), lang)
    data = yaml.safe_load(words_file.read_text()) or {}
    hits = 0
    for key, entry in data.items():
        entry["rank"] = table.get(str(key).lower())
        hits += entry["rank"] is not None
    words_file.write_text(yaml.safe_dump(data, allow_unicode=True, sort_keys=True))
    return hits
