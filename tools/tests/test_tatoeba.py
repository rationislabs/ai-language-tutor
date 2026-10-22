import pytest

from tutortools import tatoeba
from tutortools.tatoeba import Audio

SENTENCES = [
    "1\thun\tA macska az asztalon ül.",  # all known -> qualifies for macska
    "2\thun\tA macska a macskát nézi.",  # macska twice -> skipped
    "3\thun\tTom macskája alszik.",  # Tom is a stock name; alszik unknown -> skipped
    "4\thun\tMacska.",  # too short
    "5\thun\tA kutya és a macska ül.",  # qualifies
    "bad line",
]
AUDIO = [
    "1\t900\tanna\tCC BY 4.0\thttps://x",
    "5\t901\tbob\tCC BY-NC 4.0\t",
    "5\t902\tcarl\t\t",
]
KNOWN = {"a", "az", "macska", "asztal", "ül", "kutya", "és", "néz"}


def test_read_sentences_skips_malformed():
    assert list(tatoeba.read_sentences(SENTENCES))[:2] == [
        ("1", "A macska az asztalon ül.", ""),
        ("2", "A macska a macskát nézi.", ""),
    ]
    assert len(list(tatoeba.read_sentences(SENTENCES))) == 5


def test_only_open_audio_licences():
    assert tatoeba.read_audio(AUDIO) == {"1": Audio("900", "anna", "CC BY 4.0")}


def test_select_known_words_once_recorded_first():
    gaps = tatoeba.select(
        "hu",
        tatoeba.read_sentences(SENTENCES),
        tatoeba.read_audio(AUDIO),
        [("macska", "001", KNOWN)],
    )
    assert [(g.sentence_id, g.form, g.story) for g in gaps] == [
        ("1", "macska", "001"),
        ("5", "macska", "001"),
    ]
    assert all(g.audio is None for g in gaps)  # Hungarian: Piper only, even for a CC BY recording


def test_recorded_sentences_come_first():
    rows = ["1\tdeu\tDie Katze schläft heute.\tx", "2\tdeu\tDie Katze schläft hier heute.\ty"]
    rec = {"2": Audio("77", "bob", "CC BY 4.0")}
    known = {"der", "katze", "schlafen", "hier", "heute"}
    gaps = tatoeba.select("de", tatoeba.read_sentences(rows), rec, [("katze", "001", known)])
    assert [g.sentence_id for g in gaps] == ["2", "1"] and gaps[0].audio.user == "bob"


def test_per_word_limit():
    many = [f"{i}\thun\tA macska az asztalon ül." for i in range(10)]
    gaps = tatoeba.select("hu", tatoeba.read_sentences(many), {}, [("macska", "001", KNOWN)])
    assert len(gaps) == tatoeba.PER_WORD


def test_stock_names_are_allowed():
    gaps = tatoeba.select(
        "hu",
        tatoeba.read_sentences(["7\thun\tTom a macskát nézi."]),
        {},
        [("macska", "002", KNOWN)],
    )
    assert [g.form for g in gaps] == ["macskát"]


def test_sentence_authors_are_read_from_the_detailed_export():
    rows = ["1\thun\tA macska az asztalon ül.\tpirgelman\t2009-01-21\t2010-04-26"]
    assert list(tatoeba.read_sentences(rows)) == [("1", "A macska az asztalon ül.", "pirgelman")]
    gaps = tatoeba.select("hu", tatoeba.read_sentences(rows), {}, [("macska", "001", KNOWN)])
    assert gaps[0].author == "pirgelman"


def test_recording_licences_are_per_language():
    rec = {"1": Audio("900", "anna", "CC BY 4.0"), "2": Audio("901", "zoe", "CC BY-SA 4.0")}
    hu = tatoeba.select("hu", tatoeba.read_sentences(SENTENCES), rec, [("macska", "001", KNOWN)])
    assert all(g.audio is None for g in hu)  # Hungarian is always Piper
    fr_rows = ["2\tfra\tLe chat dort ici.\tx"]
    fr = tatoeba.select(
        "fr",
        tatoeba.read_sentences(fr_rows),
        rec,
        [("chat", "001", {"le", "chat", "dormir", "ici"})],
    )
    assert fr[0].audio.licence == "CC BY-SA 4.0"
    de_rows = ["2\tdeu\tDie Katze schläft hier.\tx"]
    de = tatoeba.select(
        "de",
        tatoeba.read_sentences(de_rows),
        rec,
        [("katze", "001", {"der", "katze", "schlafen", "hier"})],
    )
    assert de[0].audio is None  # German: CC BY / CC0 only


def test_exports_are_downloaded_again_when_older_than_a_month(tmp_path):
    import os
    import time

    calls = []
    fetch = lambda url, target: calls.append(url) or target.write_text("new")  # noqa: E731
    target = tmp_path / "x.bz2"
    tatoeba.download("u", target, fetch=fetch)
    tatoeba.download("u", target, fetch=fetch)
    assert calls == ["u"]  # fresh: reused
    old = time.time() - 40 * 86400
    os.utime(target, (old, old))
    tatoeba.download("u", target, fetch=fetch)
    assert calls == ["u", "u"]


def test_story_overrides_apply_to_gap_sentences():
    rows = ["8\tfra\tJe vois le chat ici.\tx"]  # simplemma: je → moi
    known = {"je", "voir", "le", "ici"}
    plain = tatoeba.select("fr", tatoeba.read_sentences(rows), {}, [("chat", "001", known)])
    fixed = tatoeba.select(
        "fr", tatoeba.read_sentences(rows), {}, [("chat", "001", known)], {"je": "je"}
    )
    assert plain == [] and [g.sentence_id for g in fixed] == ["8"]


def test_an_outage_reuses_a_stale_export(tmp_path):
    import os
    import time

    target = tmp_path / "x.bz2"
    target.write_text("old")
    old = time.time() - 40 * 86400
    os.utime(target, (old, old))

    def down(url, target):
        raise OSError("tatoeba down")

    assert tatoeba.download("u", target, fetch=down) == target
    assert target.read_text() == "old"
    with pytest.raises(OSError):
        tatoeba.download("u", tmp_path / "none.bz2", fetch=down)


class _Served:
    """What httpx.stream gives back: a status of 200 and some body."""

    def __init__(self, body: bytes, content_type: str):
        self.body, self.headers = body, {"content-type": content_type}

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False

    def raise_for_status(self):
        pass

    def iter_bytes(self):
        yield self.body


@pytest.mark.parametrize(
    "body,content_type",
    [(b"<!doctype html><p>Maintenance</p>", "text/html; charset=utf-8"), (b"oops", "text/plain")],
)
def test_an_error_page_served_with_200_never_replaces_a_good_export(
    tmp_path, monkeypatch, body, content_type
):
    import os
    import time

    target = tmp_path / "deu_detailed.tsv.bz2"
    target.write_bytes(b"BZh91AY&SY good")
    old = time.time() - 40 * 86400
    os.utime(target, (old, old))
    monkeypatch.setattr(tatoeba.httpx, "stream", lambda *a, **k: _Served(body, content_type))
    assert tatoeba.download("u", target) == target
    assert target.read_bytes() == b"BZh91AY&SY good"
    assert not target.with_suffix(".bz2.part").exists()


def test_a_real_export_still_replaces_the_old_one(tmp_path, monkeypatch):
    target = tmp_path / "deu_detailed.tsv.bz2"
    monkeypatch.setattr(
        tatoeba.httpx, "stream", lambda *a, **k: _Served(b"BZh91AY&SY new", "application/x-bzip2")
    )
    tatoeba.download("u", target)
    assert target.read_bytes() == b"BZh91AY&SY new"
