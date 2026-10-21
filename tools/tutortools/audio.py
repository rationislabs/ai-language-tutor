"""Audio for every story sentence and gap sentence: an openly licensed Tatoeba recording when
there is one, else Piper. Files are named by a hash of language, voice and text, so a cache of
the output folder makes later builds render only what changed."""

from __future__ import annotations

import hashlib
import logging
import subprocess
import sys
import tempfile
import wave
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path

import httpx

from .tatoeba import AUDIO_URL, USER_AGENT

log = logging.getLogger(__name__)

# Piper voices (CC0, or CC BY / CC BY-SA with credit). A sentence's `speaker` picks one; dialogues
# alternate. "model:speaker" picks one speaker of a multi-speaker model.
VOICES = {
    "de": ("de_DE-thorsten-medium",),
    "hu": ("hu_HU-anna-medium", "hu_HU-berta-medium", "hu_HU-imre-medium"),
    "fr": ("fr_FR-siwis-medium", "fr_FR-upmc-medium:pierre"),
    "it": ("it_IT-serena-medium",),
}
# Part of every file name: change it with ffmpeg_mp3's settings so cached audio re-renders.
ENCODING = "mp3-32k-mono"


@dataclass(frozen=True)
class Item:
    lang: str
    text: str
    voice: str | None = None  # Piper voice, or
    tatoeba_audio: str | None = None  # a Tatoeba audio id

    @property
    def path(self) -> str:
        source = self.voice or f"tatoeba:{self.tatoeba_audio}"
        key = hashlib.sha256(f"{self.lang}|{source}|{ENCODING}|{self.text}".encode()).hexdigest()[
            :16
        ]
        return f"{self.lang}/{key}.mp3"


def split_voice(voice: str) -> tuple[str, str | None]:
    """ "fr_FR-upmc-medium:pierre" → ("fr_FR-upmc-medium", "pierre")."""
    model, _, speaker = voice.partition(":")
    return model, speaker or None


def voice_for(lang: str, speaker: int = 0) -> str:
    voices = VOICES[lang]
    return voices[speaker % len(voices)]


def render(
    items: list[Item],
    out: Path,
    synth: Callable[[str, str], bytes],
    fetch: Callable[[str], bytes],
    encode: Callable[[bytes], bytes],
) -> tuple[int, dict[str, str]]:
    """Write every missing file. synth(text, voice) and fetch(audio_id) return audio bytes
    (wav / mp3); encode() turns them into MP3. A recording that cannot be fetched is spoken
    by Piper instead, under Piper's own file name, so one failed download never stops the build
    and the next build tries the recording again. Returns (files made, {recording path: Piper
    path} for the recordings that fell back)."""
    made, fell = 0, {}

    def write(target: Path, raw: Callable[[], bytes]) -> None:
        nonlocal made
        if not target.exists():
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(encode(raw()))
            made += 1

    for item in {i.path: i for i in items}.values():
        if (out / item.path).exists():
            continue
        if not item.tatoeba_audio:
            write(out / item.path, lambda i=item: synth(i.text, i.voice))
            continue
        try:
            raw = fetch(item.tatoeba_audio)
        except Exception as e:  # noqa: BLE001 — any fetch failure: Piper speaks it instead
            log.warning("recording %s unavailable (%s): using Piper", item.tatoeba_audio, e)
            piper = Item(item.lang, item.text, voice=voice_for(item.lang))
            write(out / piper.path, lambda i=piper: synth(i.text, i.voice))
            fell[item.path] = piper.path
            continue
        write(out / item.path, lambda r=raw: r)
    return made, fell


def prune(items: list[Item], out: Path, keep: set[str] = frozenset()) -> int:
    """Delete audio in the items' language folders that no sentence uses any more (edited
    sentences, old formats), so the site stays under GitHub Pages' file limits. keep: more
    paths in use (Piper speaking for failed recordings)."""
    used = {out / p for p in {i.path for i in items} | set(keep)}
    old = [f for d in {(out / i.path).parent for i in items} for f in d.iterdir() if f not in used]
    for f in old:
        f.unlink()
    return len(old)


def ffmpeg_mp3(data: bytes) -> bytes:
    """Any audio in, mono MP3 32 kbps out. MP3, not AAC: Opera ships without an AAC decoder."""
    with tempfile.TemporaryDirectory() as d:
        src, dst = Path(d) / "in", Path(d) / "out.mp3"
        src.write_bytes(data)
        subprocess.run(
            [
                "ffmpeg",
                "-loglevel",
                "error",
                "-y",
                "-i",
                str(src),
                "-ac",
                "1",
                "-c:a",
                "libmp3lame",
                "-b:a",
                "32k",
                str(dst),
            ],
            check=True,
        )
        return dst.read_bytes()


def tatoeba_fetch(audio_id: str) -> bytes:
    r = httpx.get(
        AUDIO_URL.format(audio_id),
        headers={"User-Agent": USER_AGENT},
        timeout=60,
        follow_redirects=True,
    )
    r.raise_for_status()
    return r.content


class PiperSynth:
    """Loads each voice once (downloading it into voices_dir on first use)."""

    def __init__(self, voices_dir: Path) -> None:
        self._dir = voices_dir
        self._voices: dict = {}

    def __call__(self, text: str, voice: str) -> bytes:
        from piper import PiperVoice, SynthesisConfig

        name, speaker = split_voice(voice)
        if name not in self._voices:
            model = self._dir / f"{name}.onnx"
            if not model.exists():
                self._dir.mkdir(parents=True, exist_ok=True)
                subprocess.run(
                    [
                        sys.executable,
                        "-m",
                        "piper.download_voices",
                        name,
                        "--data-dir",
                        str(self._dir),
                    ],
                    check=True,
                )
            self._voices[name] = PiperVoice.load(model)
        v = self._voices[name]
        sid = v.config.speaker_id_map[speaker] if speaker else None
        with tempfile.TemporaryDirectory() as d:
            path = Path(d) / "s.wav"
            with wave.open(str(path), "wb") as w:
                v.synthesize_wav(text, w, syn_config=SynthesisConfig(speaker_id=sid))
            return path.read_bytes()
