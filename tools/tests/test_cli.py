import json

from tests.conftest import gloss, write_story, write_words
from tutortools import __main__ as cli
from tutortools import audio, tatoeba

S1 = [
    "A macska ül.",
    "A kutya ül.",
    "A macska néz.",
    "A kutya néz.",
    "Anna néz.",
    "Anna ül.",
]


def library(content):
    write_words(content, "hu", gloss("a", "macska", "kutya", "ül", "néz"))
    write_story(
        content,
        "hu",
        "001-a",
        S1,
        ["a", "macska", "kutya", "ül", "néz"],
        names=["Anna"],
    )


def test_check_passes_and_fails(content, capsys):
    library(content)
    assert cli.run_check(content, ["hu"]) == 0
    write_story(content, "hu", "002-b", S1[:5] + ["Anna alszik."], [], names=["Anna"])
    assert cli.run_check(content, ["hu"]) == 1
    assert "002-b: unknown words" in capsys.readouterr().out


def test_build_writes_content_and_audio(content, tmp_path, monkeypatch):
    library(content)
    monkeypatch.setattr(tatoeba, "audio_file", lambda cache: {})
    monkeypatch.setattr(
        tatoeba,
        "sentences_file",
        lambda cache, lang: iter([("5", "A kutya a macskát nézi.", "x")]),
    )
    monkeypatch.setattr(audio, "PiperSynth", lambda d: lambda text, voice: b"wav")
    monkeypatch.setattr(audio, "ffmpeg_mp3", lambda b: b"mp3")
    public = tmp_path / "public"
    assert cli.run_build(content, public, tmp_path / "cache", ["hu"], with_audio=True) == 0
    data = json.loads((public / "content" / "hu.json").read_text())
    assert len(data["stories"]) == 1 and {g["lemma"] for g in data["gaps"]} >= {"macska"}
    assert len(list((public / "audio" / "hu").glob("*.mp3"))) >= 6


def test_build_stops_when_check_fails(content, tmp_path):
    write_story(content, "hu", "001-a", S1, [], names=["Anna"])
    assert cli.run_build(content, tmp_path / "p", tmp_path / "c", ["hu"], with_audio=False) == 1
