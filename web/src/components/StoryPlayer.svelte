<script lang="ts">
  import { play } from "../lib/audio";
  import type { GapItem } from "../lib/session";
  import { hasVoice, speak } from "../lib/speech";
  import type { Outcome } from "../lib/srs";
  import { lemmaOf, segments } from "../lib/text";
  import { LANG_NAMES, type Content, type HelpLang, type Story } from "../lib/types";
  import Gaps from "./Gaps.svelte";

  let {
    story,
    content,
    help,
    mode,
    speed,
    makeGaps,
    onDone,
    onBack,
  }: {
    story: Story;
    content: Content;
    help: HelpLang;
    mode: "type" | "choose";
    speed: number;
    makeGaps: () => GapItem[];
    onDone: (results: { lemma: string; outcome: Outcome }[], minutes: number) => void;
    onBack: () => void;
  } = $props();

  let phase = $state<"listen" | "read" | "gaps">("listen");
  let at = $state(0);
  let rate = $state(1);
  let tip = $state("");
  let items = $state<GapItem[]>([]);
  const started = Date.now();
  const s = $derived(story.sentences[at]);

  $effect(() => {
    rate = speed;
  });

  // Stories without audio files (AI ones) use the device's voice. Chrome lists its voices only
  // after voiceschanged, so check again then.
  let voice = $state(false);
  $effect(() => {
    const update = () => (voice = hasVoice(content.lang));
    update();
    if (typeof speechSynthesis === "undefined") return;
    const synth = speechSynthesis; // remove from the one we listened on, even if the global changed
    synth.addEventListener("voiceschanged", update);
    return () => synth.removeEventListener("voiceschanged", update);
  });
  const silent = $derived(!voice && story.sentences.some((x) => !x.audio));

  const say = () => play(s.audio, s.text, content.lang, rate);
  let run = 0; // any other control stops a play-through

  async function playAll() {
    const me = ++run;
    for (;;) {
      await say();
      if (me !== run || at >= story.sentences.length - 1) return;
      at += 1;
    }
  }

  function gloss(form: string) {
    const lemma = lemmaOf(form, content.forms);
    const word = lemma ? content.words[lemma] : undefined;
    if (story.names.includes(form)) tip = `${form}: a name`;
    else if (word) {
      tip = `${form} → ${word.lemma}: ${word[help]}`;
      speak(word[help], help);
    } else tip = `${form}: no gloss yet`;
  }

  function explain() {
    tip = s.help[help] || s.help.en || s.help.de;
    if (tip) speak(tip, help);
  }

  function step(d: number) {
    run++;
    at = Math.max(0, Math.min(story.sentences.length - 1, at + d));
    tip = "";
    say();
  }

  function toGaps() {
    items = makeGaps();
    if (items.length) phase = "gaps";
    else onDone([], (Date.now() - started) / 60000);
  }
</script>

<div class="row">
  <button onclick={onBack}>← Stories</button>
  <h2>{story.title}</h2>
</div>

{#if phase !== "gaps"}
  <section class="card">
    <p class="muted">{phase === "listen" ? "Listen first" : "Listen and read"} · {at + 1}/{story.sentences.length}</p>
    {#if silent}<p class="muted">This device has no {LANG_NAMES[content.lang]} voice, so this story is text only: read along.</p>{/if}
    <div class="picture" aria-hidden="true">{s.picture}</div>
    {#if phase === "read"}
      <p class="sentence">
        {#each segments(s.text) as part, i (i)}{#if part.word}<button class="word" onclick={() => gloss(part.text)}>{part.text}</button>{:else}{part.text}{/if}{/each}
      </p>
      <div class="row"><button onclick={explain}>Explain this sentence</button></div>
      {#if tip}<p aria-live="polite">{tip}</p>{/if}
    {/if}
    <div class="row">
      <button onclick={() => step(-1)} disabled={at === 0}>◀</button>
      <button class="primary" onclick={() => { run++; say(); }}>▶ Play</button>
      <button onclick={playAll}>▶ Play all</button>
      <button onclick={() => step(1)} disabled={at === story.sentences.length - 1}>▶▶</button>
      <label class="row">Speed
        <select bind:value={rate}><option value={0.75}>0.75×</option><option value={1}>1×</option></select>
      </label>
    </div>
  </section>
  <div class="row">
    {#if phase === "listen"}
      <button class="primary" onclick={() => { run++; phase = "read"; at = 0; }}>Now read along</button>
    {:else}
      <button class="primary" onclick={toGaps}>Practise the new words</button>
    {/if}
  </div>
{:else}
  <Gaps {items} lang={content.lang} {mode} speed={rate} onDone={(r) => onDone(r, (Date.now() - started) / 60000)} />
{/if}
