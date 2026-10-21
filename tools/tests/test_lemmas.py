from tutortools.lemmas import lemma, tokens


def test_tokens_drop_numbers_and_punctuation():
    assert tokens("Anna (12) isst 3 Äpfel, oder?") == ["Anna", "isst", "Äpfel", "oder"]


def test_elisions_are_their_own_words():
    assert tokens("L’enfant va à l'école.") == [
        "L'",
        "enfant",
        "va",
        "à",
        "l'",
        "école",
    ]
    assert tokens("Dell'acqua") == ["Dell'", "acqua"]


def test_hungarian_endings_fold_to_the_dictionary_form():
    assert [lemma(t, "hu") for t in ["asztalon", "macskák", "kutyát", "nézik"]] == [
        "asztal",
        "macska",
        "kutya",
        "néz",
    ]


def test_other_languages():
    assert lemma("Kinder", "de") == "kind"
    assert lemma("bambini", "it") == "bambino"
    assert lemma("l'", "fr") == "le"


def test_override_wins_case_insensitively():
    assert lemma("Lánya", "hu", {"lánya": "lány"}) == "lány"


def test_german_capitals_mark_nouns():
    # lower-cased, simplemma reads these as verbs (hausen, beten, tagen)
    assert [lemma(t, "de") for t in ["Haus", "Bett", "Tage", "Häuser"]] == [
        "haus",
        "bett",
        "tag",
        "haus",
    ]
    assert [lemma(t, "de") for t in ["Kommst", "Die", "gehen"]] == ["kommen", "der", "gehen"]


def test_apostrophes_inside_a_word_or_for_es():
    assert tokens("Aujourd'hui, ça va ? Wie geht's dir?") == [
        "Aujourd'hui",
        "ça",
        "va",
        "Wie",
        "geht",
        "'s",
        "dir",
    ]
    assert tokens("Il s'appelle Marc.") == ["Il", "s'", "appelle", "Marc"]
    assert lemma("'s", "de") == "es"
