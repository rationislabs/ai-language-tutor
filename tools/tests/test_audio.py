import shutil
import wave

import pytest

from tutortools import audio
from tutortools.audio import Item


def test_paths_are_stable_and_depend_on_voice_and_text():
    a = Item("hu", "Szia!", voice="hu_HU-anna-medium")
    assert a.path == Item("hu", "Szia!", voice="hu_HU-anna-medium").path
    assert a.path != Item("hu", "Szia!", voice="hu_HU-imre-medium").path
    assert a.path != Item("hu", "Szia", voice="hu_HU-anna-medium").path
    assert a.path.startswith("hu/") and a.path.endswith(".mp3")
    assert Item("de", "Hallo.", tatoeba_audio="7").path != Item("de", "Hallo.", voice="x").path


def test_paths_change_with_the_encoding(monkeypatch):
    a = Item("hu", "Szia!", voice="v").path
    monkeypatch.setattr(audio, "ENCODING", "mp3-64k")
    assert Item("hu", "Szia!", voice="v").path != a  # cached files in the old format re-render


def test_voices_alternate_by_speaker():
    assert audio.voice_for("hu", 0) == "hu_HU-anna-medium"
    assert audio.voice_for("hu", 4) == "hu_HU-berta-medium"
    assert audio.voice_for("de", 3) == "de_DE-thorsten-medium"


def test_french_dialogue_voices_both_speak_nasals():
    # gilles-low had no nasal vowels (bien, mon): garbled, unstable lines
    assert audio.VOICES["fr"] == ("fr_FR-siwis-medium", "fr_FR-upmc-medium:pierre")
    assert audio.split_voice("fr_FR-upmc-medium:pierre") == ("fr_FR-upmc-medium", "pierre")
    assert audio.split_voice("fr_FR-siwis-medium") == ("fr_FR-siwis-medium", None)


def test_render_makes_only_missing_files(tmp_path):
    calls = []
    items = [
        Item("hu", "Szia!", voice="v"),
        Item("hu", "Szia!", voice="v"),
        Item("de", "Hallo.", tatoeba_audio="9"),
    ]
    made, fell = audio.render(
        items,
        tmp_path,
        synth=lambda t, v: calls.append(("synth", t, v)) or b"wav",
        fetch=lambda i: calls.append(("fetch", i)) or b"mp3",
        encode=lambda b: b"mp3:" + b,
    )
    assert made == 2 and fell == {} and calls == [("synth", "Szia!", "v"), ("fetch", "9")]
    assert (tmp_path / items[0].path).read_bytes() == b"mp3:wav"
    assert audio.render(items, tmp_path, None, None, None) == (0, {})  # all cached


def test_a_failed_recording_falls_back_to_piper(tmp_path):
    def fetch(audio_id):
        raise OSError("tatoeba down")

    item = Item("de", "Hallo.", tatoeba_audio="9")
    piper = Item("de", "Hallo.", voice=audio.voice_for("de")).path
    made, fell = audio.render(
        [item], tmp_path, synth=lambda t, v: b"wav", fetch=fetch, encode=lambda b: b"mp3:" + b
    )
    assert (made, fell) == (1, {item.path: piper})
    assert (tmp_path / piper).read_bytes() == b"mp3:wav"
    # never under the recording's name: the next build tries the recording again
    assert not (tmp_path / item.path).exists()
    tries = []
    again = audio.render(
        [item],
        tmp_path,
        synth=None,
        fetch=lambda i: tries.append(i) or fetch(i),
        encode=None,
    )
    assert tries == ["9"] and again == (0, {item.path: piper})  # Piper's file is reused


def test_prune_deletes_audio_no_sentence_uses(tmp_path):
    keep = Item("hu", "Szia!", voice="v")
    (tmp_path / "hu").mkdir()
    (tmp_path / "de").mkdir()
    for name in [keep.path, "hu/old.mp3", "hu/old.m4a", "hu/fallback.mp3", "de/other.mp3"]:
        (tmp_path / name).write_bytes(b"x")
    assert audio.prune([keep], tmp_path, keep={"hu/fallback.mp3"}) == 2
    assert {str(p.relative_to(tmp_path)) for p in tmp_path.rglob("*.*")} == {
        "de/other.mp3",  # a language not built this time is left alone
        "hu/fallback.mp3",  # Piper speaking for a failed recording
        keep.path,
    }


@pytest.mark.skipif(shutil.which("ffmpeg") is None, reason="needs ffmpeg")
def test_ffmpeg_makes_mp3_every_browser_plays(tmp_path):
    # Opera ships without an AAC decoder; MP3 plays in every browser
    wav = tmp_path / "s.wav"
    with wave.open(str(wav), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(22050)
        w.writeframes(b"\0\0" * 22050)
    out = audio.ffmpeg_mp3(wav.read_bytes())
    assert out[:3] == b"ID3" or out[0] == 0xFF
