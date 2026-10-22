# ai-language-tutor

Learn **German, Hungarian, French and Italian** the way a child does: listen to short stories
you almost understand, read along, tap any word, and fill gaps in sentences you hear. Words
come back for review on a spaced-repetition schedule (FSRS). An installable web app that works
offline; optional AI stories with your own key. A Rationis Labs project.

```
content/  stories + word lists (YAML)  ──►  tools/ (Python)  ──►  web/public/content/*.json + audio/*.mp3
                                            vocabulary check · Tatoeba gaps · Piper audio
web/      Svelte 5 PWA  ──  progress on the device (IndexedDB)  ──  AI: browser ─► your provider
```

## How a session works

1. **Listen**: the story plays with the text hidden; each sentence shows a picture hint.
2. **Listen and read**: tap a word for its meaning, or a sentence for an explanation, shown and
   spoken in your help language (English or German, per language you learn).
3. **Gaps**: hear a sentence, fill the missing word by typing or by choosing from four. An
   answer that differs only in accents (o/ó/ö/ő, ß/ss) counts as "almost".
4. Words you met come back in later sessions, in new sentences.

## The library

| Language | Stories | Level |
|---|---|---|
| German | 40 | A2 → B1 (the 1,000 most frequent words count as known) |
| Hungarian | 40 | A1 → A2 |
| French | 15 | A1, from zero |
| Italian | 15 | A1, from zero |

Every story uses only words you already know plus at most 6 new ones, each at least twice.
`python -m tutortools check` enforces it; the build fails otherwise.

## Your own AI (optional)

Settings → *Your own AI*: OpenAI-compatible (any address), Anthropic, or Google Gemini (its
free tier works). The app asks for a short story using the words you know plus the next new
ones, and checks it; more than 15 % unknown words → it asks once more, then marks the story.
**Your key and the words you know go straight from your browser to your provider. Nothing
passes through us.** The key stays in this tab unless you tick "Remember on this device", and
is never part of a progress export.

A model on your own computer works too: an address such as `http://localhost:11434/v1`
(Ollama) or `http://127.0.0.1:1234/v1` (LM Studio). The server must allow requests from this
site's address (for Ollama, `OLLAMA_ORIGINS`), and Chrome asks once for permission to reach
your local network. Safari may refuse such an address from an `https://` page. Any other
address must be `https://`.

## Run it locally

```bash
# tools (Python 3.12, uv)
cd tools && uv sync
uv run pytest
uv run python -m tutortools check                 # the vocabulary rule
uv run python -m tutortools ranks hu              # fill frequency ranks (network, cached)
uv sync --group audio && uv run python -m tutortools build   # gaps, audio, content JSON (network, ffmpeg)
uv run python -m tutortools build --no-audio      # quick try (~5 minutes): the device's voice reads aloud

# web (Node 22: `nvm install 22` once, then `nvm use` reads .nvmrc)
cd web && npm install
npm test && npm run check
npm run dev        # http://127.0.0.1:5173
```

## Try it on your phone, privately

Offline use needs HTTPS. [Tailscale](https://tailscale.com) gives it to your own devices only:

```bash
cd tools && uv run python -m tutortools build      # once: content and audio into web/public
cd web && npm run build && npx vite preview --port 4173
sudo tailscale serve --bg --https=8443 http://127.0.0.1:4173   # https://<machine>.<tailnet>.ts.net:8443
sudo tailscale serve --https=8443 off                           # stop serving
```

Port 8443 leaves anything already served at the machine's root address alone; avoid
`tailscale serve reset`, which removes every served address.

## One-time setup (free plans only)

1. A Cloudflare account; create a Pages project (direct upload), and an API token that may
   edit Pages.
2. In the GitHub repo: secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`; variable
   `CLOUDFLARE_PROJECT` (the project name). Deploy stays off until it is set.
3. Push to `main`: the first build renders all audio (about an hour); later builds only what
   changed.
4. Ask a native speaker to read the Hungarian (and French and Italian) stories.
5. On your phone: open the site, **install it** (Chrome on Android offers "Install app"; on
   iPhone, add it to the home screen, or Safari deletes the data of sites unused for 7 days),
   and try a story offline.

## Credits and licences

- Code: [MIT](LICENSE). Everything in `content/`: [CC BY-SA 4.0](content/LICENSE), except
  material credited below under its own licence.
- Stories, glosses and explanations © Rationis Labs, licensed CC BY-SA 4.0.
- Word frequencies: [FrequencyWords](https://github.com/hermitdave/FrequencyWords) by Hermit
  Dave (OpenSubtitles 2018), CC BY-SA 4.0; `content/words/*.yaml` is derived from it and is
  CC BY-SA 4.0 as well.
- Gap sentences: [Tatoeba](https://tatoeba.org), CC BY 2.0 FR; recordings only under CC BY
  4.0, CC BY-SA 4.0 or CC0, each credited in the app.
- Voices: [Piper](https://github.com/OHF-Voice/piper1-gpl) (used only at build time).
  thorsten, anna, berta, imre: CC0; siwis (SIWIS French Speech Synthesis Database)
  and serena: CC BY 4.0; pierre (UPMC, [upmc-pierre-data](https://github.com/marytts/upmc-pierre-data)):
  CC BY-SA 4.0.

Contact: [github.com/rationislabs](https://github.com/rationislabs)
