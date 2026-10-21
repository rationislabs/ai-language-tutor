from tests.conftest import gloss, write_story, write_words
from tutortools import export, model
from tutortools.tatoeba import Audio, Gap

S1 = [
    "A macska ül.",
    "A kutya ül.",
    "A macska néz.",
    "A kutya néz.",
    "Anna néz.",
    "Anna ül.",
]


def test_build_content_and_audio_items(content):
    write_words(content, "hu", gloss("a", "macska", "kutya", "ül", "néz"))
    write_story(
        content,
        "hu",
        "001-a",
        S1,
        ["a", "macska", "kutya", "ül", "néz"],
        names=["Anna"],
    )
    gaps = [
        Gap(
            "macska",
            "001-a",
            "1",
            "A macska az asztalon ül.",
            "macska",
            Audio("900", "anna", "CC BY 4.0"),
            "pirgelman",
        ),
        Gap("kutya", "001-a", "5", "A kutya ül.", "kutya", None),
    ]
    data, items = export.build(
        "hu", model.load_stories(content, "hu"), model.load_words(content, "hu"), gaps
    )
    story = data["stories"][0]
    assert story["id"] == "001-a" and len(story["sentences"]) == 6 and story["names"] == ["Anna"]
    assert story["sentences"][0]["audio"] == items[0].path
    assert data["forms"]["macska"] == "macska" and "anna" not in data["forms"]
    assert data["forms"]["asztalon"] == "asztal"  # from the gap sentence
    assert data["words"]["macska"] == {
        "lemma": "macska",
        "en": "en-macska",
        "de": "de-macska",
        "rank": None,
    }
    assert data["baseline_rank"] == 0
    assert data["gaps"][0] == {
        "lemma": "macska",
        "story": "001-a",
        "text": "A macska az asztalon ül.",
        "blank": "macska",
        "audio": items[6].path,
        "sentence_id": "1",
        "author": "pirgelman",
        "recording": "anna, CC BY 4.0",
    }
    assert "author" not in data["gaps"][1] and "recording" not in data["gaps"][1]
    assert items[6].tatoeba_audio == "900" and items[7].voice == "hu_HU-anna-medium"
    assert "Tatoeba recordings by anna, CC BY 4.0" in data["credits"]
    assert "Tatoeba sentences by pirgelman, CC BY 2.0 FR" in data["credits"]
    assert export.TATOEBA_CREDIT in data["credits"]
    export.drop_recordings(data, {items[6].path: "hu/piper.mp3"})  # the recording failed
    assert "recording" not in data["gaps"][0] and data["gaps"][0]["audio"] == "hu/piper.mp3"
    assert "Tatoeba recordings by anna, CC BY 4.0" not in data["credits"]


def test_gap_sentence_forms_use_the_stories_overrides(content):
    write_words(content, "hu", gloss("a", "macska", "kutya", "ül", "néz", "eső"))
    write_story(
        content,
        "hu",
        "001-a",
        [*S1, "Az eső ül."],
        ["a", "macska", "kutya", "ül", "néz"],
        names=["Anna"],
        lemma_overrides={"eső": "eső"},  # simplemma: eső → esik,
    )
    gaps = [Gap("macska", "001-a", "1", "A macska nézi az esőt, nem az eső néz.", "macska", None)]
    data, _ = export.build(
        "hu", model.load_stories(content, "hu"), model.load_words(content, "hu"), gaps
    )
    assert data["forms"]["eső"] == "eső"
