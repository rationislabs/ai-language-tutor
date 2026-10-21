from tutortools import frequency


def test_forms_fold_into_lemma_ranks():
    lines = ["a 100", "macskák 50", "macska 40", "kutya 30", ""]
    assert frequency.ranks(lines, "hu") == {"a": 1, "macska": 2, "kutya": 3}


def test_fill_ranks_writes_into_the_words_file(tmp_path, monkeypatch):
    words = tmp_path / "hu.yaml"
    words.write_text("macska: {en: cat, de: Katze}\nzsiráf: {en: giraffe, de: Giraffe}\n")
    cache = tmp_path / "cache"
    cache.mkdir()
    (cache / "freq_hu.txt").write_text("a 100\nmacskák 50\n")
    assert frequency.fill_ranks(words, "hu", cache) == 1
    assert "rank: 2" in words.read_text() and "rank: null" in words.read_text()


def test_german_ranks_count_the_noun_reading_too():
    table = frequency.ranks(["ich 100", "haus 50", "bett 20"], "de")
    assert table["haus"] == 2 and table["bett"] == 3
