import pytest
import yaml

from tests.conftest import sentence, write_story
from tutortools import model

SIX = [
    "A macska ül.",
    "A kutya ül.",
    "A macska néz.",
    "A kutya néz.",
    "A macska alszik.",
    "A kutya alszik.",
]


def test_load_story_fields(content):
    write_story(
        content,
        "hu",
        "001-macska",
        SIX,
        ["macska", "kutya"],
        names=["Anna"],
        lemma_overrides={"ül": "ül"},
    )
    s = model.load_stories(content, "hu")[0]
    assert (s.id, s.lang, s.level, s.title) == ("001-macska", "hu", "A1", "001-macska")
    assert s.sentences[0].help == {"en": "EN: A macska ül.", "de": "DE: A macska ül."}
    assert s.new_words == ("macska", "kutya") and s.names == ("Anna",)


def test_stories_load_in_file_name_order(content):
    write_story(content, "de", "002-b", SIX, [])
    write_story(content, "de", "001-a", SIX, [])
    assert [s.id for s in model.load_stories(content, "de")] == ["001-a", "002-b"]


@pytest.mark.parametrize(
    "change,message",
    [
        (lambda d: d.update(lang="xx"), "lang"),
        (lambda d: d.update(level="C2"), "level"),
        (lambda d: d.update(sentences=d["sentences"][:5]), "5 sentences"),
        (
            lambda d: d["sentences"][2]["help"].pop("de"),
            "sentence 3 help: missing 'de'",
        ),
        (lambda d: d["sentences"][0].pop("picture"), "sentence 1: missing 'picture'"),
        (lambda d: d.pop("title"), "missing 'title'"),
    ],
)
def test_malformed_story_names_the_problem(content, change, message):
    write_story(content, "hu", "001-x", SIX, [])
    path = content / "stories" / "hu" / "001-x.yaml"
    data = yaml.safe_load(path.read_text())
    change(data)
    path.write_text(yaml.safe_dump(data, allow_unicode=True))
    with pytest.raises(model.ContentError, match=message):
        model.load_story(path)


def test_story_in_wrong_folder(content):
    write_story(content, "de", "001-x", SIX, [])
    path = content / "stories" / "de" / "001-x.yaml"
    data = yaml.safe_load(path.read_text())
    data["lang"] = "hu"
    path.write_text(yaml.safe_dump(data))
    with pytest.raises(model.ContentError, match="match its folder"):
        model.load_story(path)


def test_words_and_config(content):
    (content / "words").mkdir()
    (content / "words" / "de.yaml").write_text("Haus: {en: house, de: Haus, rank: 120}\n")
    w = model.load_words(content, "de")["haus"]
    assert (w.lemma, w.en, w.rank) == ("Haus", "house", 120)
    assert model.load_words(content, "it") == {}
    assert model.load_config(content)["de"].max_new == 6
    assert sentence("x")["speaker"] == 0
