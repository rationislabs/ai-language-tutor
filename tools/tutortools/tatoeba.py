"""Gap-exercise sentences from Tatoeba. Text is CC BY 2.0 FR; audio is licensed per
contributor, and only openly licensed recordings are used (credited). A sentence qualifies
for a word when the word occurs once and every other word is already known by then."""

from __future__ import annotations

import bz2
import csv
import io
import logging
import tarfile
import time
from collections.abc import Iterable, Iterator
from dataclasses import dataclass
from pathlib import Path

import httpx

from .lemmas import lemma, tokens

log = logging.getLogger(__name__)

ISO3 = {"de": "deu", "hu": "hun", "fr": "fra", "it": "ita"}
EXPORTS = "https://downloads.tatoeba.org/exports"
AUDIO_URL = "https://tatoeba.org/audio/download/{}"
# Recordings we may republish, per language (spec): German and Italian CC BY / CC0, French also
# CC BY-SA, Hungarian none (Piper only).
OPEN_AUDIO = {
    "de": {"CC BY 4.0", "CC0 1.0"},
    "it": {"CC BY 4.0", "CC0 1.0"},
    "fr": {"CC BY 4.0", "CC BY-SA 4.0", "CC0 1.0"},
    "hu": set(),
}
ANY_OPEN = set().union(*OPEN_AUDIO.values())
MAX_AGE = 30 * 86400  # re-download the exports monthly: recordings get deleted or relicensed
NAMES = {"tom", "mary", "john", "alice"}  # Tatoeba's stock characters
MIN_TOKENS, MAX_TOKENS, PER_WORD = 4, 12, 5
USER_AGENT = "RationisLabsTutor/1.0 (+https://github.com/rationislabs/ai-language-tutor)"


@dataclass(frozen=True)
class Audio:
    audio_id: str
    user: str
    licence: str


@dataclass(frozen=True)
class Gap:
    lemma: str
    story: str  # the story that introduced the word
    sentence_id: str
    text: str
    form: str  # the word as written in the sentence: the blank
    audio: Audio | None  # an openly licensed recording, else None (Piper speaks it)
    author: str = ""  # the sentence's Tatoeba contributor (CC BY 2.0 FR credit)


def read_sentences(lines: Iterable[str]) -> Iterator[tuple[str, str, str]]:
    """Per-language detailed export rows: id, iso3, text, username, added, modified.
    Yields (id, text, author); author is "" when the row has none."""
    for line in lines:
        parts = line.rstrip("\n").split("\t")
        if len(parts) >= 3:
            yield parts[0], parts[2], parts[3] if len(parts) > 3 else ""


def read_audio(lines: Iterable[str]) -> dict[str, Audio]:
    """sentences_with_audio rows: sentence id, audio id, user, licence, attribution URL.
    Keeps only openly licensed recordings, the first one per sentence."""
    out: dict[str, Audio] = {}
    for row in csv.reader(lines, delimiter="\t"):
        if len(row) >= 4 and row[3] in ANY_OPEN and row[0] not in out:
            out[row[0]] = Audio(audio_id=row[1], user=row[2], licence=row[3])
    return out


def select(
    lang: str,
    sentences: Iterable[tuple[str, str, str]],
    audio: dict[str, Audio],
    targets: list[tuple[str, str, set[str]]],
    overrides: dict[str, str] | None = None,
) -> list[Gap]:
    """targets: (lemma, story id, lemmas known once that story is done). Up to PER_WORD
    sentences per lemma, recorded ones first, then shorter ones. overrides: form → lemma
    fixes the stories agree on (vocab.shared_overrides)."""
    want = {lem: (story, known) for lem, story, known in targets}
    found: dict[str, list[tuple[int, int, Gap]]] = {lem: [] for lem in want}
    for sid, text, author in sentences:
        forms = tokens(text)
        if not MIN_TOKENS <= len(forms) <= MAX_TOKENS:
            continue
        lemmas = [lemma(f, lang, overrides) for f in forms]
        for lem in set(lemmas) & want.keys():
            if lemmas.count(lem) != 1:
                continue
            story, known = want[lem]
            others = [x for x, f in zip(lemmas, forms, strict=True) if x != lem]
            if all(x in known or x in NAMES for x in others):
                rec = audio.get(sid)
                if rec and rec.licence not in OPEN_AUDIO[lang]:
                    rec = None
                gap = Gap(lem, story, sid, text, forms[lemmas.index(lem)], rec, author)
                found[lem].append((rec is None, len(forms), gap))
    out = []
    for lem in want:
        out += [g for *_, g in sorted(found[lem], key=lambda t: (t[0], t[1], t[2].sentence_id))][
            :PER_WORD
        ]
    return out


def _stream(url: str, target: Path) -> None:
    part = target.with_suffix(target.suffix + ".part")
    with httpx.stream(
        "GET", url, headers={"User-Agent": USER_AGENT}, timeout=300, follow_redirects=True
    ) as r:
        r.raise_for_status()
        if "html" in r.headers.get("content-type", ""):  # a maintenance page served with 200
            raise OSError(f"{url} answered with a web page, not the file")
        with part.open("wb") as f:
            for chunk in r.iter_bytes():
                f.write(chunk)
    with part.open("rb") as f:
        magic = f.read(3)
    if target.suffix == ".bz2" and magic != b"BZh":
        part.unlink()
        raise OSError(f"{url} is not a bzip2 file")
    part.replace(target)  # never leave a half file that looks complete


def download(url: str, target: Path, max_age: float = MAX_AGE, fetch=_stream) -> Path:
    """Fetch into the cache folder; reuse a copy younger than max_age seconds."""
    if not target.exists() or time.time() - target.stat().st_mtime > max_age:
        target.parent.mkdir(parents=True, exist_ok=True)
        try:
            fetch(url, target)
        except (OSError, httpx.HTTPError) as e:
            if not target.exists():
                raise
            # A Tatoeba outage must not fail the deploy: a month-old export still works.
            log.warning("%s unavailable (%s): using the cached copy", url, e)
    return target


def sentences_file(cache: Path, lang: str) -> Iterator[tuple[str, str, str]]:
    iso = ISO3[lang]
    path = download(
        f"{EXPORTS}/per_language/{iso}/{iso}_sentences_detailed.tsv.bz2",
        cache / f"{iso}_detailed.tsv.bz2",
    )
    with bz2.open(path, "rt", encoding="utf-8") as f:
        yield from read_sentences(f)


def audio_file(cache: Path) -> dict[str, Audio]:
    path = download(
        f"{EXPORTS}/sentences_with_audio.tar.bz2",
        cache / "sentences_with_audio.tar.bz2",
    )
    with tarfile.open(path, "r:bz2") as tar:
        member = next(m for m in tar.getmembers() if m.name.endswith(".csv"))
        return read_audio(io.TextIOWrapper(tar.extractfile(member), encoding="utf-8"))
