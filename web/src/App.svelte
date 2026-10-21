<script lang="ts">
  import About from "./components/About.svelte";
  import Library from "./components/Library.svelte";
  import Settings from "./components/Settings.svelte";
  import StoryPlayer from "./components/StoryPlayer.svelte";
  import { AiError, generateStory, MESSAGES, type AiSettings } from "./lib/ai";
  import { prefetch } from "./lib/audio";
  import { loadKey } from "./lib/keys";
  import { buildGaps, doneSummary, upcoming } from "./lib/session";
  import { newCard, review, type Outcome } from "./lib/srs";
  import { DEFAULT_SETTINGS, openStore, streak, type LangSettings, type Progress, type Store } from "./lib/store";
  import { LANG_NAMES, type Content, type Lang, type Story } from "./lib/types";

  type AiConfig = Omit<AiSettings, "key">;
  const today = () => new Date().toISOString().slice(0, 10);
  const read = <T,>(key: string, fallback: T): T => {
    try {
      return JSON.parse(localStorage.getItem(key) ?? "null") ?? fallback;
    } catch {
      return fallback;
    }
  };

  let store: Store | undefined;
  let lang = $state<Lang>(read<Lang>("tutor-lang", "de"));
  let content = $state<Content | null>(null);
  let missing = $state(false);
  let unreachable = $state(false);
  let progress = $state<Progress>({ cards: {}, done: [], minutes: 0, days: [] });
  let settings = $state<LangSettings>({ ...DEFAULT_SETTINGS });
  let generated = $state<Story[]>([]);
  let view = $state<"library" | "settings" | "about">("library");
  let open = $state<Story | null>(null);
  let ai = $state<AiConfig>(read("tutor-ai", { provider: "openai", baseUrl: "https://api.openai.com/v1", model: "" }));
  let aiBusy = $state(false);
  let aiNote = $state("");
  let notice = $state("");
  const stories = $derived(content ? [...content.stories, ...generated] : []);

  async function load(l: Lang) {
    localStorage.setItem("tutor-lang", JSON.stringify(l));
    content = null;
    missing = false;
    unreachable = false;
    open = null;
    notice = "";
    store ??= await openStore();
    const [p, s, g] = await Promise.all([store.progress(l), store.settings(l), store.stories(l)]);
    const r = await fetch(`${import.meta.env.BASE_URL}content/${l}.json`).catch(() => null);
    // a host without the file may answer with the app's own HTML page: not JSON, not content
    const data = r?.ok ? await r.json().catch(() => null) : null;
    if (l !== lang) return; // the learner switched language while this was loading
    [progress, settings, generated] = [p, s, g];
    if (Array.isArray(data?.stories) && data.stories.length) content = data;
    else if (!r || (!r.ok && r.status !== 404)) unreachable = true; // offline, or the server is down
    else missing = true;
  }

  function openStory(s: Story) {
    open = s;
    prefetch(upcoming(stories, s.id).flatMap((x) => x.sentences.map((y) => y.audio)));
  }

  $effect(() => {
    load(lang);
  });

  async function finish(results: { lemma: string; outcome: Outcome }[], minutes: number) {
    const now = new Date();
    const cards = { ...progress.cards };
    for (const { lemma, outcome } of results) cards[lemma] = review(cards[lemma] ?? newCard(now), outcome, now);
    progress = {
      cards,
      done: open && !progress.done.includes(open.id) ? [...progress.done, open.id] : progress.done,
      minutes: progress.minutes + minutes,
      days: progress.days.includes(today()) ? progress.days : [...progress.days, today()],
    };
    await store!.saveProgress(lang, $state.snapshot(progress));
    notice = doneSummary(open?.new_words ?? [], minutes, streak(progress.days, today()));
    open = null;
  }

  async function generate() {
    if (!content) return;
    const c = content;
    const rank = (k: string) => c.words[k]?.rank ?? Number.MAX_SAFE_INTEGER;
    const known = new Set(Object.keys(c.words).filter((k) => rank(k) <= c.baseline_rank));
    for (const s of stories) if (progress.done.includes(s.id)) s.new_words.forEach((w) => known.add(w));
    const fresh = Object.keys(c.words).filter((k) => !known.has(k)).sort((a, b) => rank(a) - rank(b)).slice(0, 5);
    if (!fresh.length) return void (aiNote = "No new words left in this language's list.");
    const lastDone = stories.filter((s) => progress.done.includes(s.id)).at(-1);
    aiBusy = true;
    aiNote = "";
    try {
      const { story, note } = await generateStory(
        { ...ai, key: loadKey() },
        {
          lang,
          level: lastDone?.level ?? stories[0]?.level ?? "A1",
          help: settings.help,
          known: [...known].sort((a, b) => rank(a) - rank(b)).slice(0, 300),
          fresh,
        },
        c,
        `ai-${Date.now()}`,
      );
      generated = [...generated, story];
      await store!.saveStories(lang, $state.snapshot(generated));
      aiNote = note ?? `New story: ${story.title}`;
    } catch (e) {
      aiNote = e instanceof AiError ? e.message : MESSAGES.bad;
    } finally {
      aiBusy = false;
    }
  }

  async function exportProgress() {
    const blob = new Blob([await store!.exportAll()], { type: "application/json" });
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: `tutor-progress-${today()}.json` });
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000); // some Safari versions cancel a download revoked at once
  }

  async function importProgress(file: File): Promise<string> {
    try {
      await store!.importAll(await file.text());
    } catch (e) {
      return e instanceof Error ? e.message : "Import failed.";
    }
    await load(lang);
    return "Progress imported.";
  }
</script>

<main>
  <header class="row" style="justify-content: space-between">
    <h1>Listening Tutor</h1>
    <label class="row">Learn
      <select bind:value={lang}>
        {#each Object.entries(LANG_NAMES) as [code, name] (code)}<option value={code}>{name}</option>{/each}
      </select>
    </label>
  </header>
  <nav class="row">
    <button onclick={() => { view = "library"; open = null; }} aria-current={view === "library"}>Stories</button>
    <button onclick={() => (view = "settings")} aria-current={view === "settings"}>Settings</button>
    <button onclick={() => (view = "about")} aria-current={view === "about"}>About</button>
  </nav>

  {#if view === "settings"}
    {#key lang}
      <Settings {lang} {settings} {ai}
        onSettings={async (s) => { settings = s; await store!.saveSettings(lang, s); }}
        onAi={(a) => { ai = a; localStorage.setItem("tutor-ai", JSON.stringify(a)); }}
        onExport={exportProgress} onImport={importProgress} />
    {/key}
  {:else if view === "about"}
    <About credits={content?.credits ?? []} />
  {:else if unreachable}
    <p class="card">Can't load the {LANG_NAMES[lang]} stories. Check your connection.
      <button onclick={() => load(lang)}>Retry</button></p>
  {:else if missing}
    <p class="card">No stories for {LANG_NAMES[lang]} yet.</p>
  {:else if !content}
    <p class="muted">Loading…</p>
  {:else if open}
    {#key open.id}
      <StoryPlayer story={open} {content} help={settings.help} mode={settings.mode} speed={settings.speed}
        makeGaps={() => buildGaps(content!, open!, stories, progress.cards, new Date())}
        onDone={finish} onBack={() => (open = null)} />
    {/key}
  {:else}
    <Library {stories} done={progress.done} streakDays={streak(progress.days, today())} minutes={progress.minutes}
      aiReady={!!ai.model && !!loadKey()} {aiBusy} {aiNote} {notice} onOpen={openStory} onGenerate={generate} />
  {/if}
</main>
