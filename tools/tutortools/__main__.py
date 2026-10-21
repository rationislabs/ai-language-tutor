"""python -m tutortools check | ranks LANG | build [--no-audio] [--langs de,hu,…]

check  vocabulary rule for every language (offline; exit 1 on problems)
ranks  fill frequency ranks into content/words/LANG.yaml (downloads the list once)
build  Tatoeba gaps + audio + web/public/content/{lang}.json (network; caches in tools/.cache)"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from . import audio, export, frequency, tatoeba, vocab
from .model import LANGS, load_config, load_stories, load_words

ROOT = Path(__file__).resolve().parents[2]
CONTENT = ROOT / "content"
CACHE = ROOT / "tools" / ".cache"
PUBLIC = ROOT / "web" / "public"


def run_check(content: Path, langs) -> int:
    cfg = load_config(content)
    problems = []
    for lang in langs:
        stories = load_stories(content, lang)
        problems += vocab.check(stories, load_words(content, lang), cfg[lang])
        print(f"{lang}: {len(stories)} stories")
    for p in problems:
        print(f"  {p}")
    return 1 if problems else 0


def run_build(content: Path, public: Path, cache: Path, langs, with_audio: bool) -> int:
    if run_check(content, langs):
        return 1
    cfg = load_config(content)
    audio_index = tatoeba.audio_file(cache)
    synth = audio.PiperSynth(cache / "voices")
    for lang in langs:
        stories, words = load_stories(content, lang), load_words(content, lang)
        known = vocab.known_after(stories, words, cfg[lang])
        targets = [(w.lower(), s.id, known[i]) for i, s in enumerate(stories) for w in s.new_words]
        gaps = tatoeba.select(
            lang,
            tatoeba.sentences_file(cache, lang),
            audio_index,
            targets,
            vocab.shared_overrides(stories),
        )
        data, items = export.build(lang, stories, words, gaps, cfg[lang].baseline_rank)
        made = pruned = 0
        if with_audio:  # before writing: recordings that failed lose their credit
            made, fell = audio.render(
                items, public / "audio", synth, audio.tatoeba_fetch, audio.ffmpeg_mp3
            )
            export.drop_recordings(data, fell)
            pruned = audio.prune(items, public / "audio", set(fell.values()))
        (public / "content").mkdir(parents=True, exist_ok=True)
        (public / "content" / f"{lang}.json").write_text(json.dumps(data, ensure_ascii=False))
        print(
            f"{lang}: {len(stories)} stories, {len(gaps)} gap sentences, {made} new audio files, {pruned} unused deleted"
        )
    return 0


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(prog="python -m tutortools")
    sub = p.add_subparsers(dest="cmd", required=True)
    sub.add_parser("check")
    r = sub.add_parser("ranks")
    r.add_argument("lang", choices=LANGS)
    b = sub.add_parser("build")
    b.add_argument("--no-audio", action="store_true")
    for s in (sub.choices["check"], b):
        s.add_argument("--langs", default=",".join(LANGS))
    a = p.parse_args(argv)
    if a.cmd == "ranks":
        hits = frequency.fill_ranks(CONTENT / "words" / f"{a.lang}.yaml", a.lang, CACHE)
        print(f"{a.lang}: {hits} words ranked")
        return 0
    langs = [x for x in a.langs.split(",") if x]
    if a.cmd == "check":
        return run_check(CONTENT, langs)
    return run_build(CONTENT, PUBLIC, CACHE, langs, not a.no_audio)


if __name__ == "__main__":
    sys.exit(main())
