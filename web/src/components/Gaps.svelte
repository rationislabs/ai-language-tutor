<script lang="ts">
  import { tick } from "svelte";
  import { check, type Verdict } from "../lib/answer";
  import { play } from "../lib/audio";
  import type { GapItem } from "../lib/session";
  import type { Outcome } from "../lib/srs";
  import { blankOut } from "../lib/text";
  import type { Lang } from "../lib/types";

  let {
    items,
    lang,
    mode,
    speed,
    onDone,
  }: {
    items: GapItem[];
    lang: Lang;
    mode: "type" | "choose";
    speed: number;
    onDone: (results: { lemma: string; outcome: Outcome }[]) => void;
  } = $props();

  let index = $state(0);
  let answer = $state("");
  let verdict = $state<Verdict | null>(null);
  let results: { lemma: string; outcome: Outcome }[] = [];
  let answerArea = $state<HTMLElement>();
  let nextButton = $state<HTMLButtonElement>();
  const item = $derived(items[index]);
  const shown = $derived(item ? blankOut(item.text, item.blank) : "");
  const LABEL: Record<Verdict, string> = { right: "Right!", almost: "Almost — mind the accents", wrong: "Not quite" };

  function listen() {
    play(item.audio, item.text, lang, speed);
  }

  async function submit(given: string) {
    if (verdict) return;
    answer = given;
    verdict = check(item.blank, given);
    const outcome: Outcome = mode === "choose" && verdict === "right" ? "chosen" : verdict;
    results.push({ lemma: item.lemma, outcome });
    await tick();
    nextButton?.focus(); // the Check button just got disabled: keep the keyboard on the page
  }

  async function next() {
    if (index + 1 >= items.length) return onDone(results);
    index += 1;
    answer = "";
    verdict = null;
    await tick();
    answerArea?.querySelector<HTMLElement>("input, button")?.focus();
  }
</script>

{#if item}
  <section class="card">
    <p class="muted">Gap {index + 1} of {items.length}</p>
    <div class="row"><button onclick={listen}>▶ Listen</button></div>
    <p class="sentence">{shown}</p>
    {#if mode === "type"}
      <form bind:this={answerArea} onsubmit={(e) => { e.preventDefault(); submit(answer); }} class="row">
        <input aria-label="Missing word" bind:value={answer} disabled={!!verdict} autocomplete="off" autocapitalize="off" spellcheck="false" />
        <button class="primary" type="submit" disabled={!!verdict}>Check</button>
      </form>
    {:else}
      <div class="row" bind:this={answerArea}>
        {#each item.choices as c (c)}
          <button onclick={() => submit(c)} disabled={!!verdict}>{c}</button>
        {/each}
      </div>
    {/if}
    <div aria-live="polite">
      {#if verdict}<p class={verdict}>{LABEL[verdict]}{verdict === "right" ? "" : ` — ${item.blank}`}</p>{/if}
    </div>
    {#if verdict}
      <p class="sentence">{item.text}</p>
      {#if item.credit}<p class="muted">{item.credit}</p>{/if}
      <button class="primary" bind:this={nextButton} onclick={next}>{index + 1 >= items.length ? "Finish" : "Next"}</button>
    {/if}
  </section>
{/if}
