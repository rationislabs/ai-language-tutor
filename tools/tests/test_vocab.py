from tests.conftest import gloss, write_story, write_words
from tutortools import model, vocab

S1 = [
    "A macska ül.",
    "A kutya ül.",
    "A macska néz.",
    "A kutya néz.",
    "Anna néz.",
    "Anna ül.",
]
S2 = [
    "A macska alszik.",
    "A kutya alszik.",
    "A macska eszik.",
    "A kutya eszik.",
    "Anna alszik.",
    "Anna eszik.",
]


def run(content, lang="hu"):
    return [
        str(p)
        for p in vocab.check(
            model.load_stories(content, lang),
            model.load_words(content, lang),
            model.load_config(content)[lang],
        )
    ]


def test_clean_library(content):
    write_words(content, "hu", gloss("a", "macska", "kutya", "ül", "néz", "alszik", "eszik"))
    write_story(
        content,
        "hu",
        "001-a",
        S1,
        ["a", "macska", "kutya", "ül", "néz"],
        names=["Anna"],
    )
    write_story(content, "hu", "002-b", S2, ["alszik", "eszik"], names=["Anna"])
    assert run(content) == []


def test_unknown_word_and_missing_gloss(content):
    write_words(content, "hu", gloss("a", "macska", "kutya", "ül", "néz"))
    write_story(
        content,
        "hu",
        "001-a",
        S1,
        ["a", "macska", "kutya", "ül", "néz"],
        names=["Anna"],
    )
    write_story(content, "hu", "002-b", S2, ["alszik"], names=["Anna"])
    problems = run(content)
    assert "002-b: unknown words (add to new_words, or rewrite): eszik" in problems
    assert "002-b: no gloss in words/hu.yaml: alszik, eszik" in problems


def test_too_many_new_words_after_the_first_story(content):
    write_words(content, "hu", gloss("a", "macska", "kutya", "ül", "néz", "alszik", "eszik"))
    write_story(
        content,
        "hu",
        "001-a",
        S1,
        ["a", "macska", "kutya", "ül", "néz"],
        names=["Anna"],
    )
    cfg = content / "languages.yaml"
    cfg.write_text(cfg.read_text().replace("max_new: 6", "max_new: 1"))
    write_story(content, "hu", "002-b", S2, ["alszik", "eszik"], names=["Anna"])
    assert any("2 new words, at most 1" in p for p in run(content))


def test_new_word_needs_two_uses_and_must_be_new(content):
    write_words(content, "hu", gloss("a", "macska", "kutya", "ül", "néz", "alszik", "eszik"))
    write_story(
        content,
        "hu",
        "001-a",
        S1,
        ["a", "macska", "kutya", "ül", "néz"],
        names=["Anna"],
    )
    once = [
        "A macska alszik.",
        "A kutya ül.",
        "A macska eszik.",
        "A kutya eszik.",
        "Anna ül.",
        "Anna eszik.",
    ]
    write_story(content, "hu", "002-b", once, ["alszik", "eszik", "macska"], names=["Anna"])
    problems = run(content)
    assert "002-b: new word 'alszik' occurs 1x, needs at least 2" in problems
    assert "002-b: new word 'macska' is already known" in problems


def test_baseline_rank_counts_as_known(content):
    write_words(content, "de", {**gloss("der", "katze", rank=5), **gloss("schlafen", rank=900)})
    cfg = content / "languages.yaml"
    cfg.write_text(cfg.read_text().replace("de:\n  baseline_rank: 0", "de:\n  baseline_rank: 1000"))
    texts = [
        "Die Katze schläft.",
        "Der Katze schläft.",
        "Die Katze schläft.",
        "Die Katze schläft.",
        "Die Katze schläft.",
        "Die Katze schläft.",
    ]
    write_story(content, "de", "001-a", texts, [])
    assert run(content, "de") == []
    k = vocab.known_after(
        model.load_stories(content, "de"),
        model.load_words(content, "de"),
        model.load_config(content)["de"],
    )
    assert k[0] == {"der", "katze", "schlafen"}


def test_unknown_words_show_the_form_that_was_written(content):
    write_words(content, "hu", gloss("a", "macska", "kutya", "ül", "néz", "asztal"))
    texts = [
        "A macska ül.",
        "A kutya ül.",
        "A macska néz.",
        "A kutya néz.",
        "Anna néz.",
        "A macska az asztalon ül.",
    ]
    write_story(
        content, "hu", "001-a", texts, ["a", "macska", "kutya", "ül", "néz"], names=["Anna"]
    )
    problems = run(content)
    assert "001-a: unknown words (add to new_words, or rewrite): asztalon→asztal, az" in problems


def test_shared_overrides_keep_only_forms_every_story_agrees_on(content):
    texts = ["Je vois le chat.", "Je vois le chat ici.", "Le chat dort.", "Le chat mange."] * 2
    write_story(content, "fr", "001-a", texts, [], lemma_overrides={"Je": "je", "vois": "voir"})
    write_story(content, "fr", "002-b", texts, [], lemma_overrides={"je": "je", "vois": "x"})
    stories = model.load_stories(content, "fr")
    assert vocab.shared_overrides(stories) == {"je": "je"}


def test_shared_overrides_skip_forms_another_story_reads_plainly(content):
    # 001 reads "vagy" as van ("you are"); 002 uses it plainly as "or"
    a = ["Te vagy Anna.", "Te vagy itt.", "Anna itt.", "Anna ott.", "Te ott.", "Te itt."]
    b = ["Kávé vagy tea?", "Tea.", "Kávé.", "Tea itt.", "Kávé ott.", "Tea ott."]
    write_story(content, "hu", "001-a", a, [], lemma_overrides={"vagy": "van"})
    write_story(content, "hu", "002-b", b, [])
    assert "vagy" not in vocab.shared_overrides(model.load_stories(content, "hu"))
